import type { ActivityWindowController } from './activityWindowController.js';
import type { HostTheme } from '../protocol/electronShellProtocol.js';
import { FrontendPetStore } from '../pets/frontendPetStore.js';

type WindowController = Pick<ActivityWindowController,'show'|'hide'|'close'|'reveal'|'updateTheme'|'currentWebContents'|'setLayout'|'setInteractiveRegions'|'beginMove'|'move'|'endMove'>;
export type PetAssignment={petId:string;workspaceId:string;threadId:string|null;activate?:boolean;expected?:{workspaceId:string|null;threadId:string|null}};
type Envelope = {type:string;commandId?:string;threadId?:string;requestId?:string;timestamp?:string;payload:any};
/** Owns frontend associations and native windows; backend facts are used only for validation. */
export class PetWindowCollection {
  private controllers=new Map<string,WindowController>();
  private pendingExplicit=new Map<string,number>();
  private visibilityGenerations=new Map<string,number>();
  private generations=new Map<string,number>();
  private receiving=new Set<string>();
  private showing=new Map<string,Promise<void>>();
  private visible=new Set<string>();
  private pending=new Map<string,{resolve(event:Envelope):void;reject(error:Error):void;timer:ReturnType<typeof setTimeout>}>();
  private requests=new Map<string,string>();
  private resolved=new Set<string>();
  private threads=new Map<string,{id:string;workspaceId:string}>();
  private socket?:WebSocket;
  private reconnect?:ReturnType<typeof setTimeout>;
  private stopped=false;
  private theme?:HostTheme;
  constructor(private readonly options:{url:string;store:FrontendPetStore;defaultWorkspaceRoot:string;createController(petId:string,index:number):WindowController;onError?(error:unknown):void;onNotice?(message:string):void}) {
    options.store.subscribe(()=>{void this.reconcile().catch(e=>options.onError?.(e));});
  }
  async show():Promise<void> {this.stopped=false;this.connect();await this.reconcile();}
  private connect():void {
    if(this.socket && this.socket.readyState<2)return;
    const url=new URL(this.options.url);url.searchParams.delete('acceptServerRequests');url.searchParams.set('observeRequests','1');
    const socket=this.socket=new WebSocket(url);
    socket.onopen=()=>{void this.bootstrap().catch(e=>this.options.onError?.(e));};
    socket.onmessage=event=>{try{void this.accept(JSON.parse(String(event.data))).catch(e=>this.options.onError?.(e));}catch(e){this.options.onError?.(e);}};
    socket.onclose=()=>{if(this.socket===socket)this.socket=undefined;this.requests.clear();for(const request of this.pending.values()){clearTimeout(request.timer);request.reject(new Error('服务连接中断，请重试'));}this.pending.clear();if(!this.stopped)this.reconnect=setTimeout(()=>this.connect(),1000);};
    socket.onerror=()=>{};
  }
  private async bootstrap():Promise<void> {
    const listed=await this.request('workspace.list');
    const workspace=listed.payload.workspaces[0] ?? (await this.request('workspace.create',{rootPath:this.options.defaultWorkspaceRoot})).payload.workspace;
    this.options.store.initialize(workspace.id);
    // Listing also asks the backend to replay still-pending requests after reconnect.
    let cursor:string|undefined;
    do {const page=await this.request('thread.list',{limit:100,...(cursor?{cursor}:{})});cursor=page.payload.nextCursor;}while(cursor);
  }
  private request(type:string,payload?:object,threadId?:string):Promise<Envelope> {
    if(this.socket?.readyState!==1)return Promise.reject(new Error('还没有连上服务，请稍后重试'));
    const commandId=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(commandId);reject(new Error('服务回执超时，请重试'));},30000);
      this.pending.set(commandId,{resolve,reject,timer});
      this.socket!.send(JSON.stringify({type,commandId,timestamp:new Date().toISOString(),...(payload?{payload}:{}),...(threadId?{threadId}:{})}));
    });
  }
  private async validate(workspaceId:string,threadId:string|null):Promise<void> {
    const listed=await this.request('workspace.list');
    if(!listed.payload.workspaces.some((workspace:{id:string})=>workspace.id===workspaceId))throw new Error('工作区不存在');
    if(threadId){const thread=await this.findThread(threadId,workspaceId);if(thread.workspaceId!==workspaceId)throw new Error('对话不属于所选工作区');}
  }
  private async findThread(threadId:string,workspaceId?:string):Promise<{id:string;workspaceId:string}> {
    let cursor:string|undefined;
    do {
      const page=await this.request('thread.list',{limit:100,...(workspaceId?{workspaceId}:{}),...(cursor?{cursor}:{})});
      const thread=page.payload.threads.find((item:{id:string})=>item.id===threadId);
      if(thread)return thread;
      cursor=page.payload.nextCursor;
    }while(cursor);
    throw new Error('对话不存在');
  }
  private advance(petId:string):number {const generation=(this.generations.get(petId)??0)+1;this.generations.set(petId,generation);return generation;}
  async assignPet(input:PetAssignment):Promise<void> {
    // A delayed creation acknowledgement may attach its Thread, but cannot replace a user's pending arrangement.
    if(input.expected && this.pendingExplicit.has(input.petId))return;
    const generation=input.expected ? this.generations.get(input.petId)??0 : this.advance(input.petId);
    if(!input.expected)this.pendingExplicit.set(input.petId,generation);
    const visibilityGeneration=this.visibilityGenerations.get(input.petId)??0;
    try {
      await this.validate(input.workspaceId,input.threadId);
      if((this.generations.get(input.petId)??0)!==generation || input.activate!==false && (this.visibilityGenerations.get(input.petId)??0)!==visibilityGeneration)return;
      const current=this.options.store.get(input.petId);
      if(input.expected && (current.workspaceId!==input.expected.workspaceId || current.threadId!==input.expected.threadId))return;
      this.options.store.assign(input.petId,input.workspaceId,input.threadId,input.activate!==false);
      if(this.options.store.get(input.petId).visible)await this.ensureVisible(input.petId);
    } finally {if(this.pendingExplicit.get(input.petId)===generation && !input.expected)this.pendingExplicit.delete(input.petId);}
  }
  async openWorkspaceThread(workspaceId:string,threadId:string|null):Promise<void> {await this.validate(workspaceId,threadId);const pet=this.options.store.open(workspaceId,threadId);this.advance(pet.id);await this.ensureVisible(pet.id);this.controllers.get(pet.id)?.reveal();}
  async summonPet(workspaceId:string):Promise<void> {await this.validate(workspaceId,null);const pet=this.options.store.summon(workspaceId);this.advance(pet.id);await this.ensureVisible(pet.id);}
  async accept(event:Envelope):Promise<void> {
    const reply=event.commandId?this.pending.get(event.commandId):undefined;
    if(reply){clearTimeout(reply.timer);this.pending.delete(event.commandId!);if(event.type.endsWith('.error'))reply.reject(new Error(event.payload.message));else reply.resolve(event);}
    if(event.type==='thread.listed')for(const thread of event.payload.threads)this.threads.set(thread.id,{id:thread.id,workspaceId:thread.workspaceId});
    if(event.type==='thread.started' && event.threadId)this.threads.set(event.threadId,{id:event.threadId,workspaceId:event.payload.workspaceId});
    if(event.type==='thread.deleted' && event.payload.status==='deleted'){
      this.threads.delete(event.payload.targetThreadId);this.options.store.clearThread(event.payload.targetThreadId);
      for(const [id,threadId] of this.requests)if(threadId===event.payload.targetThreadId)this.requests.delete(id);
    }
    if(event.type==='request.resolved'){
      const id=event.requestId ?? event.payload.requestId;this.requests.delete(id);this.resolved.add(id);
      // Requests use UUIDs; keep a bounded reconnect-local terminal ledger.
      if(this.resolved.size>10000)this.resolved.delete(this.resolved.values().next().value!);
    }
    if(event.type==='permission.requested' && event.threadId && event.requestId) {
      const id=event.requestId;
      if(this.requests.has(id) || this.resolved.has(id))return;
      const timeout=event.payload.timeoutMs??60000;
      if(event.timestamp && Date.now()-Date.parse(event.timestamp)>=timeout)return;
      this.requests.set(id,event.threadId);
      try {
        const thread=this.threads.get(event.threadId) ?? await this.findThread(event.threadId);
        if(!this.requests.has(id) || event.timestamp && Date.now()-Date.parse(event.timestamp)>=timeout)return;
        const pet=this.options.store.open(thread.workspaceId,event.threadId);this.advance(pet.id);
        await this.ensureVisible(pet.id);
        if(this.requests.has(id))this.controllers.get(pet.id)?.reveal();
      } catch(error){if(error instanceof Error && error.message.includes("没有隐藏伙伴"))this.options.onNotice?.("有任务等待授权，请新建 Pet");else this.options.onError?.(error);}
    }
  }
  private async reconcile():Promise<void> {
    if(this.stopped)return;
    const pets=this.options.store.list();
    for(const pet of pets) {
      if(pet.visible){if(!this.visible.has(pet.id)){this.visible.add(pet.id);void this.ensureVisible(pet.id).catch(e=>{this.visible.delete(pet.id);this.options.onError?.(e);});}}
      else if(this.visible.delete(pet.id)){const controller=this.controllers.get(pet.id);controller?.hide();if(!this.receiving.has(pet.id))controller?.close();}

    }
    await Promise.all(this.showing.values());
  }
  private ensureVisible(petId:string):Promise<void> {
    const previous=this.showing.get(petId);if(previous)return previous;
    const show=(async()=>{
      let controller=this.controllers.get(petId);
      if(!controller){controller=this.options.createController(petId,this.options.store.list().findIndex(p=>p.id===petId));this.controllers.set(petId,controller);if(this.theme)await controller.updateTheme(this.theme);}
      if(!this.options.store.get(petId).visible)return;
      await controller.show();
      if(!this.options.store.get(petId).visible){controller.hide();if(!this.receiving.has(petId))controller.close();}
    })();
    this.showing.set(petId,show);void show.finally(()=>this.showing.delete(petId)).catch(()=>{});return show;
  }
  async showPet(petId:string):Promise<void> {this.visibilityGenerations.set(petId,(this.visibilityGenerations.get(petId)??0)+1);this.options.store.show(petId);await this.ensureVisible(petId);}
  async hidePet(petId:string):Promise<void> {this.visibilityGenerations.set(petId,(this.visibilityGenerations.get(petId)??0)+1);this.options.store.hide(petId);}
  async recover(petId:string):Promise<void> {this.receiving.delete(petId);if(this.options.store.get(petId).visible)await this.ensureVisible(petId);}
  setReceiving(petId:string,value:boolean):void {if(value)this.receiving.add(petId);else {this.receiving.delete(petId);if(!this.options.store.get(petId).visible)this.controllers.get(petId)?.close();}}
  getVisibility():Record<string,boolean> {return Object.fromEntries(this.options.store.list().map(p=>[p.id,p.visible]));}
  controllerForSender(sender:unknown):WindowController|undefined {return [...this.controllers.values()].find(c=>c.currentWebContents()!==null&&c.currentWebContents()===sender);}
  petIdForSender(sender:unknown):string|undefined {return [...this.controllers.entries()].find(([,c])=>c.currentWebContents()!==null&&c.currentWebContents()===sender)?.[0];}
  async updateTheme(theme:HostTheme):Promise<void> {this.theme=theme;await Promise.all([...this.controllers.values()].map(c=>c.updateTheme(theme)));}
  stop():void {this.stopped=true;clearTimeout(this.reconnect);this.socket?.close();for(const controller of this.controllers.values())controller.close();}
}
