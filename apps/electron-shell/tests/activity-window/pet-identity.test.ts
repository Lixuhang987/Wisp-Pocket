// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { PetThreadController } from "../../src/activity-window/petThreadController.ts";
import { readDroppedItems } from "../../src/activity-window/readDroppedItems.ts";
class Socket {
 static latest: Socket; readyState = 0; onopen: (()=>void)|null=null; onclose:(()=>void)|null=null; onmessage:((event:{data:string})=>void)|null=null;
 sent:any[]=[]; constructor(){Socket.latest=this;} send(raw:string){this.sent.push(JSON.parse(raw));} close(){} open(){this.readyState=1;this.onopen?.();} receive(value:object){this.onmessage?.({data:JSON.stringify(value)});}
}
const active:PetThreadController[]=[];
afterEach(()=>{active.forEach(c=>c.disconnect()); localStorage.clear();});
let seq=0;
const note=(type:string,payload:object,extra:object={})=>({type,payload,...extra,notificationId:String(++seq),timestamp:new Date().toISOString()});
it("固定宠物归属，后台创建不切选，草稿按对话恢复",()=>{
 const c=new PetThreadController({url:"ws://local/api/thread",WebSocketImpl:Socket,petId:"pet-a"});active.push(c);c.connect();const socket=Socket.latest;socket.open();
 socket.receive(note("thread.listed",{threads:[{id:"a",petId:"pet-a",createdAt:"2026",updatedAt:"2026",preview:"A"}]}));
 c.setDraft("A草稿");
 socket.receive(note("thread.started",{petId:"pet-b",preview:"B",createdAt:"2027"},{threadId:"b"}));
 expect(c.getSnapshot().threadId).toBe("a");expect(c.getSnapshot().draft).toBe("A草稿");
 c.newTopic();c.setDraft("新话题");c.selectThread("a");expect(c.getSnapshot().draft).toBe("A草稿");
 c.newTopic();expect(c.getSnapshot().draft).toBe("新话题");
 const accepted=c.respond("新话题"); void accepted?.catch(()=>{});
 expect(socket.sent.at(-1).payload.petId).toBe("pet-a");
});
it("真实路径作为文字交付，文件内容无需读取",async()=>{
 const file=new File(["secret body"],"资料.pdf",{type:"application/pdf"});
 const items=await readDroppedItems({files:[file],getData:()=>""} as unknown as DataTransfer,()=>"/Users/me/资料.pdf");
 expect(items).toEqual([{type:"text",id:expect.any(String),text:expect.stringContaining("/Users/me/资料.pdf")}]);
 expect(JSON.stringify(items)).not.toContain("secret body");
});

function openPet(petId:string, threads:string[] = []) {
 const c=new PetThreadController({url:"ws://local/api/thread",WebSocketImpl:Socket,petId});active.push(c);c.connect();const socket=Socket.latest;socket.open();
 socket.receive(note("thread.listed",{threads:threads.map(id=>({id,petId,petRevision:1,rootPath:"/tmp",status:"idle",createdAt:"2026",updatedAt:"2026",preview:id,messageCount:0}))}));
 return {c,socket};
}
it("五宠的两段历史与新话题草稿在 renderer 重建后分别恢复",()=>{
 for(let i=0;i<5;i++){
  const {c}=openPet(`pet-${i}`,[`a-${i}`,`b-${i}`]);c.setDraft(`A${i}`);c.selectThread(`b-${i}`);c.setDraft(`B${i}`);c.newTopic();c.setDraft(`New${i}`);c.hideBubble();c.disconnect();
 }
 for(let i=0;i<5;i++){
  const {c}=openPet(`pet-${i}`,[`a-${i}`,`b-${i}`]);expect(c.getSnapshot().draft).toBe(`New${i}`);expect(c.getSnapshot().threadId).toBeNull();
  c.selectThread(`a-${i}`);expect(c.getSnapshot().draft).toBe(`A${i}`);c.selectThread(`b-${i}`);expect(c.getSnapshot().draft).toBe(`B${i}`);
 }
});
it.each([false,true])("ACK 不确定后重建并重试，沿用 commandId / opId，已创建=%s",async started=>{
 const {c,socket}=openPet("pet-a");c.setDraft("保留输入");const first=c.respond("保留输入")!;const caught=first.catch(error=>error);
 const command=socket.sent.at(-1);
 if(started)socket.receive(note("thread.started",{petId:"pet-a",petRevision:1,rootPath:"/tmp",preview:"保留输入"},{threadId:"a",commandId:command.commandId}));
 c.disconnect();expect(await caught).toBeInstanceOf(Error);
 const restored=openPet("pet-a",started?["a"]:[]);const accepted=restored.c.respond("保留输入")!;
 if(!started){expect(restored.socket.sent.at(-1).commandId).toBe(command.commandId);restored.socket.receive(note("thread.started",{petId:"pet-a",petRevision:1,rootPath:"/tmp",preview:"保留输入"},{threadId:"a",commandId:command.commandId}));}
 const op=restored.socket.sent.at(-1);expect(op.type).toBe("op.submit");expect(op.payload.op.opId).toBe(command.commandId);
 restored.c.setDraft("确认期间新增内容");restored.socket.receive(note("user.message.recorded",{messageId:command.commandId,text:"保留输入",items:op.payload.op.payload.items},{threadId:"a"}));
 await accepted;expect(restored.c.getSnapshot().draft).toBe("确认期间新增内容");
});
it("草稿存储失败明确提示并保留内存输入",()=>{
 const {c}=openPet("pet-a");const storage=vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("full");});
 c.setDraft("不能丢");expect(c.getSnapshot().draft).toBe("不能丢");expect(c.getSnapshot().error).toContain("保存失败");storage.mockRestore();
});
it("另一段对话的 Permission 唤出对话但不改选择和草稿",()=>{
 const {c,socket}=openPet("pet-a",["a","b"]);c.setDraft("A draft");c.hideBubble();
 socket.receive({type:"permission.requested",threadId:"b",requestId:"r",timestamp:new Date().toISOString(),payload:{toolName:"file.write",toolCallId:"write",arguments:{}}});
 expect(c.getSnapshot()).toMatchObject({threadId:"a",draft:"A draft",bubbleVisible:true});expect(c.store.getState().threadsById.a?.permissionRequests??[]).toHaveLength(0);
 c.selectThread("b");expect(c.store.getState().threadsById.b.permissionRequests).toHaveLength(1);
});
it("离线删除所选历史后重连只回本宠剩余历史并清除已删草稿",()=>{
 const {c}=openPet("pet-a",["a","b"]);c.setDraft("删掉的草稿");c.disconnect();c.connect();const socket=Socket.latest;socket.open();
 socket.receive(note("thread.listed",{threads:[{id:"b",petId:"pet-a",updatedAt:"2026",createdAt:"2026",preview:"B"}]}));
 expect(c.getSnapshot().threadId).toBe("b");expect(c.getSnapshot().draft).toBe("");expect(JSON.parse(localStorage.getItem("handagent.pet-ui.v1.pet-a")!).drafts.a).toBeUndefined();
});
it("分页保留已列出历史，下一页不切选当前输入",()=>{
 const {c,socket}=openPet("pet-a",["a"]);c.setDraft("A");
 socket.receive(note("thread.listed",{threads:[{id:"a",petId:"pet-a",updatedAt:"2026",createdAt:"2026",preview:"A"}],nextCursor:"page2"}));c.listMore();expect(socket.sent.at(-1).payload.cursor).toBe("page2");
 socket.receive(note("thread.listed",{threads:[{id:"b",petId:"pet-a",updatedAt:"2025",createdAt:"2025",preview:"B"}]}));
 expect(c.getSnapshot().history.map(t=>t.id)).toEqual(["a","b"]);expect(c.getSnapshot()).toMatchObject({threadId:"a",draft:"A"});
});
it("本宠超过一页时，离线删除的旧选择通过 resume not_found 回到本宠历史",()=>{
 const {c}=openPet("pet-a",["deleted","remaining"]);c.setDraft("deleted draft");c.disconnect();c.connect();const socket=Socket.latest;socket.open();
 socket.receive(note("thread.listed",{threads:Array.from({length:50},(_,i)=>({id:`a-${i}`,petId:"pet-a",updatedAt:"2026",createdAt:"2026",preview:`A${i}`})),nextCursor:"next"}));
 expect(socket.sent.at(-1)).toMatchObject({type:"thread.resume",threadId:"deleted"});
 socket.receive(note("thread.error",{code:"not_found",message:"Thread not found"},{threadId:"deleted"}));
 expect(c.getSnapshot().threadId).toBe("a-0");expect(c.getSnapshot().draft).toBe("");expect(JSON.parse(localStorage.getItem("handagent.pet-ui.v1.pet-a")!).drafts.deleted).toBeUndefined();
});
it("点击显隐在每宠 renderer 重建后独立恢复",()=>{
 const a=openPet("pet-a"),b=openPet("pet-b");a.c.revealBubble();b.c.hideBubble();a.c.disconnect();b.c.disconnect();
 expect(openPet("pet-a").c.getSnapshot().bubbleVisible).toBe(true);expect(openPet("pet-b").c.getSnapshot().bubbleVisible).toBe(false);
});
it("运行通知更新历史弹层中的同一 Thread 状态",()=>{
 const {c,socket}=openPet("pet-a",["a"]);
 socket.receive(note("turn.started",{},{threadId:"a",turnId:"turn"}));expect(c.getSnapshot().history[0].status).toBe("running");
 socket.receive(note("turn.completed",{status:"completed"},{threadId:"a",turnId:"turn"}));expect(c.getSnapshot().history[0].status).toBe("idle");
});
