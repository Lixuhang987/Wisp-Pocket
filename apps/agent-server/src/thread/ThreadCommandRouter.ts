import type { ThreadCommand, PetCommand, WorkspaceCommand } from '@handagent/core/protocol/types/ThreadCommand.ts';
import type { ClientResponse } from '@handagent/core/protocol/types/ClientResponse.ts';
import type { ThreadNotification } from '@handagent/core/protocol/types/ThreadNotification.ts';
import type { DynamicToolSpec } from '@handagent/core/protocol/types/DynamicTool.ts';
import type { BlobStore } from '@handagent/core/blob/types/BlobStore.ts';
import { PetRegistry } from '@handagent/core/pet/PetRegistry.ts';
import { PetError } from '@handagent/core/pet/Pet.ts';
import { ThreadRegistry, ThreadNotFoundError } from '@handagent/core/thread/ThreadRegistry.ts';
import { ThreadNotificationPublisher } from './ThreadNotificationPublisher.ts';
import { decodeImage } from '../actions/ReadImage.ts';

export class ThreadCommandRouter {
  private readonly creating = new Map<string,Promise<void>>();
  constructor(
    private readonly threads: ThreadRegistry,
    private readonly publisher: ThreadNotificationPublisher,
    private readonly pets?: PetRegistry,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly defaultDynamicTools: () => DynamicToolSpec[] = () => [],
    private readonly blobStore?: BlobStore,
  ) {}
  async receive(command: ThreadCommand, connectionId: string): Promise<void> {
    try {
      if (command.type.startsWith('workspace.')) return await this.manageWorkspace(command as WorkspaceCommand,connectionId);
      if (command.type.startsWith('pet.')) return await this.managePet(command as PetCommand,connectionId);
      switch(command.type) {
        case 'thread.start': {
          const pending = this.creating.get(command.commandId);
          if (pending) await pending;
          const task = (async () => {
            const thread = await this.threads.create({petId:command.payload.petId,workspaceId:command.payload.workspaceId,commandId:command.commandId,dynamicTools:command.payload.dynamicTools ?? this.defaultDynamicTools()});
            this.publisher.subscribe(connectionId,thread.id);
            this.publisher.publish({type:'thread.started',threadId:thread.id,...this.meta(command.commandId),payload:{preview:null,createdAt:thread.createdAt,petId:thread.petId,workspaceId:thread.workspaceId,petRevision:thread.petSnapshot.revision,rootPath:thread.rootPath}});
          })();
          this.creating.set(command.commandId,task);
          try { await task; } finally { if(this.creating.get(command.commandId)===task)this.creating.delete(command.commandId); }
          return;
        }
        case 'thread.resume': {
          const thread = await this.threads.load(command.threadId);
          this.publisher.subscribe(connectionId,thread.id);
          this.publisher.publishToConnection(connectionId,{type:'thread.snapshot',threadId:thread.id,...this.meta(command.commandId),payload:thread.snapshot()}); return;
        }
        case 'op.submit': {
          const thread = await this.threads.load(command.threadId);
          if(this.pets && !await this.pets.get(thread.petId)) throw new PetError('not_found','所属桌宠不存在');
          await thread.submit(command.payload.op); return;
        }
        case 'thread.list': {
          const filter=command.payload;
          let rows=(await this.threads.list()).filter(row=>(!filter?.petId || row.petId===filter.petId) && (!filter?.workspaceId || row.workspaceId===filter.workspaceId));
          rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.id.localeCompare(a.id));
          if(filter?.cursor) {
            let cursor:unknown; try { cursor=JSON.parse(Buffer.from(filter.cursor,'base64url').toString()); } catch { throw new Error('无效分页游标'); }
            if(!Array.isArray(cursor)||cursor.length!==4||cursor.some(v=>typeof v!=='string')) throw new Error('无效分页游标');
            const [updatedAt,id,petId,workspaceId]=cursor as string[];
            if (petId !== (filter.petId ?? '') || workspaceId !== (filter.workspaceId ?? '')) throw new Error('分页游标不属于当前查询范围');
            rows=rows.filter(row=>row.updatedAt<updatedAt || row.updatedAt===updatedAt && row.id<id);
          }
          const limit=Math.max(1,Math.min(100,filter?.limit ?? 50));
          const page=rows.slice(0,limit); const last=page.at(-1);
          this.publisher.publishToConnection(connectionId,{type:'thread.listed',...this.meta(command.commandId),payload:{threads:page.map(row=>({id:row.id,preview:row.preview,createdAt:row.createdAt,updatedAt:row.updatedAt,messageCount:row.messageCount,petId:row.petId,workspaceId:row.workspaceId,petRevision:row.petSnapshot.revision,rootPath:row.rootPath,status:this.threads.get(row.id)?.status ?? row.status ?? 'idle'})),...(rows.length>limit && last ? {nextCursor:Buffer.from(JSON.stringify([last.updatedAt,last.id,filter?.petId ?? '',filter?.workspaceId ?? ''])).toString('base64url')}:{})}});
          if (this.publisher.isRequestObserver(connectionId)) {
            for (const row of page) for (const request of this.threads.get(row.id)?.requests.snapshot() ?? []) {
              this.publisher.publishToConnection(connectionId, request);
            }
          }
          return;
        }
        case 'thread.delete': {
          const id=command.payload.targetThreadId; const deleted=await this.threads.delete(id);
          const event:ThreadNotification={type:'thread.deleted',...this.meta(command.commandId),payload:{targetThreadId:id,status:deleted?'deleted':'not_found'}};
          if(deleted)this.publisher.publish(event);else this.publisher.publishToConnection(connectionId,event); return;
        }
      }
    } catch(error) {
      const message=error instanceof Error?error.message:String(error);
      if (command.type.startsWith('workspace.')) { this.publisher.publishToConnection(connectionId,{type:'workspace.error',...this.meta(command.commandId),payload:{code:error instanceof PetError?error.code:'storage_failed',message}}); return; }
      this.publisher.publishToConnection(connectionId,command.type.startsWith('pet.')
        ? {type:'pet.error',...this.meta(command.commandId),payload:{code:error instanceof PetError?error.code:'storage_failed',message,...(error instanceof PetError && error.currentRevision ? {currentRevision:error.currentRevision}:{})}}
        : {type:'thread.error',...this.meta(command.commandId),...('threadId'in command?{threadId:command.threadId}:{}),payload:{message, ...(error instanceof PetError || error instanceof ThreadNotFoundError?{code:error.code}:{})}});
    }
  }
  private async manageWorkspace(command:WorkspaceCommand,connectionId:string) {
    if (!this.pets) throw new PetError('storage_failed','项目注册表不可用');
    if (command.type === 'workspace.list') {
      this.publisher.publishToConnection(connectionId,{type:'workspace.listed',...this.meta(command.commandId),payload:{workspaces:await this.pets.workspaces.list()}});
    } else {
      const result = await this.pets.workspaces.create(command.payload.rootPath,command.commandId);
      this.publisher.publish({type:'workspace.created',...this.meta(command.commandId),payload:result});
      if (result.created) this.publisher.publish({type:'pet.created',...this.meta(),payload:{pet:result.basePet}});
    }
  }
  private async managePet(command:PetCommand,connectionId:string) {
    if(!this.pets)throw new PetError('storage_failed','Pet registry is not configured');
    switch(command.type) {
      case 'pet.list': this.publisher.publishToConnection(connectionId,{type:'pet.listed',...this.meta(command.commandId),payload:{pets:(await this.pets.list()).filter(pet => !command.payload?.workspaceId || pet.workspaceId === command.payload.workspaceId),...(command.payload?.workspaceId ? {workspaceId:command.payload.workspaceId}:{})}}); return;
      case 'pet.create': {
        const before=await this.pets.list();
        const pet=await this.pets.create(command.payload,command.commandId);
        this.publisher.publish({type:'pet.created',...this.meta(command.commandId),payload:{pet}});
        for(const updated of await this.pets.list()) if(updated.id!==pet.id && before.find(p=>p.id===updated.id)?.revision!==updated.revision) this.publisher.publish({type:before.some(p=>p.id===updated.id)?'pet.updated':'pet.created',...this.meta(),payload:{pet:updated}});
        const workspace = await this.pets.workspaces.get(pet.workspaceId);
        if (workspace) this.publisher.publish({type:'workspace.created',...this.meta(),payload:{workspace,basePet:(await this.pets.list()).find(p=>p.id===`base-${workspace.id}`)!,created:!before.some(p=>p.workspaceId===workspace.id)}});
        return;
      }
      case 'pet.update': {
        const {id,expectedRevision,patch}=command.payload;
        const before=await this.pets.list(); const pet=await this.pets.update(id,expectedRevision,patch);
        this.publisher.publish({type:'pet.updated',...this.meta(command.commandId),payload:{pet}});
        for(const updated of await this.pets.list()) if(updated.id!==id && before.find(p=>p.id===updated.id)?.revision!==updated.revision) this.publisher.publish({type:'pet.updated',...this.meta(),payload:{pet:updated}});
        return;
      }
      case 'pet.image.import': {
        if(!this.blobStore)throw new PetError('storage_failed','图片存储不可用');
        const {base64,mimeType}=command.payload;
        if(base64.length > Math.ceil(20*1024*1024/3)*4) throw new PetError('invalid_input','图片超过 20 MiB');
        if(base64.length%4!==0 || /[^A-Za-z0-9+/=]/.test(base64))throw new PetError('invalid_input','图片编码无效');
        const bytes=Buffer.from(base64,'base64');
        if(bytes.toString('base64')!==base64)throw new PetError('invalid_input','图片编码无效');
        if(!bytes.length||bytes.length>20*1024*1024)throw new PetError('invalid_input','图片必须介于 1 byte 与 20 MiB');
        let decoded:Awaited<ReturnType<typeof decodeImage>>;
        try { decoded=await decodeImage(bytes,mimeType,4096); } catch(error) {throw new PetError('invalid_input',error instanceof Error?error.message:String(error));}
        const blob=await this.blobStore.put({kind:'image',bytes,extension:mimeType==='image/jpeg'?'jpg':mimeType==='image/png'?'png':'webp'});
        const imageRef={type:'imported' as const,blobId:blob.id,...decoded}; this.pets.saveImage(imageRef);
        this.publisher.publishToConnection(connectionId,{type:'pet.image.imported',...this.meta(command.commandId),payload:{imageRef}}); return;
      }
    }
  }
  async handleResponse(response:ClientResponse,connectionId:string) {
    const threadId=response.requestId.slice(0,response.requestId.lastIndexOf(':'));
    if(this.publisher.canAnswer(connectionId,threadId))this.threads.get(threadId)?.requests.answer(response);
  }
  async interruptThread(threadId:string) {await this.threads.get(threadId)?.interrupt();}
  private meta(commandId?:string) {return {notificationId:crypto.randomUUID(),...(commandId?{commandId}:{}),timestamp:this.now()};}
}
