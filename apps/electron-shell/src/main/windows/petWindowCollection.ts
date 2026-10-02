import type { ActivityWindowController } from "./activityWindowController.js";
import type { HostTheme } from "../protocol/electronShellProtocol.js";

type WindowController = Pick<ActivityWindowController,"show"|"hide"|"close"|"reveal"|"updateTheme"|"currentWebContents"|"setLayout"|"setInteractiveRegions"|"beginMove"|"move"|"endMove">;
/** Window lifecycle only. This connection consumes identity and request facts, never messages. */
export class PetWindowCollection {
  private readonly controllers = new Map<string,WindowController>();
  private readonly petIds = new Set<string>();
  private readonly owners = new Map<string,string>();
  private readonly receiving = new Set<string>();
  private readonly visibility: Record<string,boolean>;
  private socket?: WebSocket;
  private reconnect?: ReturnType<typeof setTimeout>;
  private stopped=false;
  private theme?:HostTheme;
  constructor(private readonly options:{url:string;createController(petId:string,index:number):WindowController;preferences:{load():Record<string,boolean>;save(value:Record<string,boolean>):void};onError?(error:unknown):void}) {this.visibility=options.preferences.load();}
  async show():Promise<void> {this.stopped=false;this.connect();await Promise.all([...this.petIds].filter(id=>this.visibility[id]!==false).map(id=>this.showPet(id)));}
  private connect():void {
    if(this.socket && this.socket.readyState<2)return;
    const url=new URL(this.options.url);url.searchParams.delete("acceptServerRequests");url.searchParams.set("observeRequests","1");
    const socket=this.socket=new WebSocket(url);
    socket.onopen=()=>{this.send("pet.list");this.send("thread.list",{limit:100});};
    socket.onmessage=event=>{try{void this.accept(JSON.parse(String(event.data))).catch(e=>this.options.onError?.(e));}catch(e){this.options.onError?.(e);}};
    socket.onclose=()=>{if(this.socket===socket)this.socket=undefined;if(!this.stopped)this.reconnect=setTimeout(()=>this.connect(),1000);};
    socket.onerror=()=>{};
  }
  private send(type:string,payload?:object,threadId?:string):void {if(this.socket?.readyState===1)this.socket.send(JSON.stringify({type,commandId:crypto.randomUUID(),timestamp:new Date().toISOString(),...(payload?{payload}:{}),...(threadId?{threadId}:{})}));}
  async accept(event:any):Promise<void> {
    if(event.type==="pet.listed") {for(const pet of event.payload.pets){this.petIds.add(pet.id);if(this.visibility[pet.id]!==false)await this.showPet(pet.id);}}
    else if(event.type==="pet.created") {this.petIds.add(event.payload.pet.id);await this.showPet(event.payload.pet.id);}
    else if(event.type==="thread.listed") {for(const thread of event.payload.threads){this.owners.set(thread.id,thread.petId);}if(event.payload.nextCursor)this.send("thread.list",{limit:100,cursor:event.payload.nextCursor});}
    else if(event.type==="thread.started") {this.owners.set(event.threadId,event.payload.petId);}
    else if(event.type==="thread.deleted") this.owners.delete(event.payload.targetThreadId);
    else if(event.type==="permission.requested") {
      const petId=this.owners.get(event.threadId);
      if(petId && Date.now()-Date.parse(event.timestamp)<60_000){await this.showPet(petId);this.controllers.get(petId)?.reveal();}
    }
  }
  async showPet(petId:string):Promise<void> {
    if(!this.petIds.has(petId)) {this.send("pet.list");throw new Error("桌宠尚未载入或不存在，请稍后重试。");}
    this.visibility[petId]=true;this.options.preferences.save(this.visibility);
    let controller=this.controllers.get(petId);
    if(!controller){controller=this.options.createController(petId,[...this.petIds].indexOf(petId));this.controllers.set(petId,controller);if(this.theme)await controller.updateTheme(this.theme);}
    await controller.show();
  }
  async hidePet(petId:string):Promise<void> {
    if(!this.petIds.has(petId))throw new Error("桌宠不存在。");
    this.visibility[petId]=false;this.options.preferences.save(this.visibility);
    const controller=this.controllers.get(petId);controller?.hide();if(!this.receiving.has(petId))controller?.close();
  }
  async recover(petId:string):Promise<void> { this.receiving.delete(petId); if (this.visibility[petId] !== false) await this.showPet(petId); }
  setReceiving(petId:string,value:boolean):void {if(value)this.receiving.add(petId);else {this.receiving.delete(petId);if(this.visibility[petId]===false)this.controllers.get(petId)?.close();}}
  controllerForSender(sender:unknown):WindowController|undefined {return [...this.controllers.values()].find(c=>c.currentWebContents()!==null&&c.currentWebContents()===sender);}
  petIdForSender(sender:unknown):string|undefined {return [...this.controllers.entries()].find(([,c])=>c.currentWebContents()!==null&&c.currentWebContents()===sender)?.[0];}
  async updateTheme(theme:HostTheme):Promise<void> {this.theme=theme;await Promise.all([...this.controllers.values()].map(c=>c.updateTheme(theme)));}
  stop():void {this.stopped=true;clearTimeout(this.reconnect);this.socket?.close();for(const controller of this.controllers.values())controller.close();}
}
