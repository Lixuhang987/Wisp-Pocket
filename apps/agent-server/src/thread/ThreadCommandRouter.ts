import type { ThreadCommand, WorkspaceCommand } from '@handagent/core/protocol/types/ThreadCommand.ts';
import type { ClientResponse } from '@handagent/core/protocol/types/ClientResponse.ts';
import type { ThreadNotification } from '@handagent/core/protocol/types/ThreadNotification.ts';
import type { DynamicToolSpec } from '@handagent/core/protocol/types/DynamicTool.ts';
import { WorkspaceRegistry } from '@handagent/core/workspace/WorkspaceRegistry.ts';
import { WorkspaceError } from '@handagent/core/workspace/Workspace.ts';
import { ThreadRegistry, ThreadNotFoundError } from '@handagent/core/thread/ThreadRegistry.ts';
import { ThreadNotificationPublisher } from './ThreadNotificationPublisher.ts';

export class ThreadCommandRouter {
  private readonly creating = new Map<string,Promise<void>>();
  constructor(
    private readonly threads: ThreadRegistry,
    private readonly publisher: ThreadNotificationPublisher,
    private readonly workspaces?: WorkspaceRegistry,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly defaultDynamicTools: () => DynamicToolSpec[] = () => [],
  ) {}
  async receive(command: ThreadCommand, connectionId: string): Promise<void> {
    try {
      if (command.type.startsWith('workspace.')) return await this.manageWorkspace(command as WorkspaceCommand,connectionId);
      switch(command.type) {
        case 'thread.start': {
          const pending = this.creating.get(command.commandId);
          if (pending) await pending;
          const task = (async () => {
            const thread = await this.threads.create({workspaceId:command.payload.workspaceId,commandId:command.commandId,dynamicTools:command.payload.dynamicTools ?? this.defaultDynamicTools()});
            this.publisher.subscribe(connectionId,thread.id);
            this.publisher.publish({type:'thread.started',threadId:thread.id,...this.meta(command.commandId),payload:{preview:null,createdAt:thread.createdAt,workspaceId:thread.workspaceId,rootPath:thread.rootPath}});
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
          await thread.submit(command.payload.op); return;
        }
        case 'thread.list': {
          const filter=command.payload;
          let rows=(await this.threads.list()).filter(row=>(!filter?.workspaceId || row.workspaceId===filter.workspaceId));
          rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.id.localeCompare(a.id));
          if(filter?.cursor) {
            let cursor:unknown; try { cursor=JSON.parse(Buffer.from(filter.cursor,'base64url').toString()); } catch { throw new Error('无效分页游标'); }
            if(!Array.isArray(cursor)||cursor.length!==3||cursor.some(v=>typeof v!=='string')) throw new Error('无效分页游标');
            const [updatedAt,id,workspaceId]=cursor as string[];
            if (workspaceId !== (filter.workspaceId ?? '')) throw new Error('分页游标不属于当前查询范围');
            rows=rows.filter(row=>row.updatedAt<updatedAt || row.updatedAt===updatedAt && row.id<id);
          }
          const limit=Math.max(1,Math.min(100,filter?.limit ?? 50));
          const page=rows.slice(0,limit); const last=page.at(-1);
          this.publisher.publishToConnection(connectionId,{type:'thread.listed',...this.meta(command.commandId),payload:{threads:page.map(row=>({id:row.id,preview:row.preview,createdAt:row.createdAt,updatedAt:row.updatedAt,messageCount:row.messageCount,workspaceId:row.workspaceId,rootPath:row.rootPath,status:this.threads.get(row.id)?.status ?? row.status ?? 'idle'})),...(rows.length>limit && last ? {nextCursor:Buffer.from(JSON.stringify([last.updatedAt,last.id,filter?.workspaceId ?? ''])).toString('base64url')}:{})}});
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
      if (command.type.startsWith('workspace.')) { this.publisher.publishToConnection(connectionId,{type:'workspace.error',...this.meta(command.commandId),payload:{code:error instanceof WorkspaceError?error.code:'storage_failed',message}}); return; }
      this.publisher.publishToConnection(connectionId,{type:'thread.error',...this.meta(command.commandId),...('threadId'in command?{threadId:command.threadId}:{}),payload:{message, ...(error instanceof WorkspaceError || error instanceof ThreadNotFoundError?{code:error.code}:{})}});
    }
  }
  private async manageWorkspace(command:WorkspaceCommand,connectionId:string) {
    if (!this.workspaces) throw new WorkspaceError('storage_failed','项目注册表不可用');
    if (command.type === 'workspace.list') {
      this.publisher.publishToConnection(connectionId,{type:'workspace.listed',...this.meta(command.commandId),payload:{workspaces:await this.workspaces.list()}});
    } else {
      const result = await this.workspaces.create(command.payload.rootPath,command.commandId);
      this.publisher.publish({type:'workspace.created',...this.meta(command.commandId),payload:result});
    }
  }
  async handleResponse(response:ClientResponse,connectionId:string) {
    const threadId=response.requestId.slice(0,response.requestId.lastIndexOf(':'));
    if(this.publisher.canAnswer(connectionId,threadId))this.threads.get(threadId)?.requests.answer(response);
  }
  async interruptThread(threadId:string) {await this.threads.get(threadId)?.interrupt();}
  private meta(commandId?:string) {return {notificationId:crypto.randomUUID(),...(commandId?{commandId}:{}),timestamp:this.now()};}
}
