import { expect, it, vi } from "vitest";
import { PetWindowCollection } from "../../src/main/windows/petWindowCollection.ts";
it("五宠分别建窗，隐藏等待持久接收，Permission 召回不聚焦",async()=>{
 const windows=new Map<string,any>();
 const collection=new PetWindowCollection({url:"ws://local",preferences:{load:()=>({}),save:vi.fn()},createController:(id)=>{
  const c={show:vi.fn(async()=>{}),hide:vi.fn(),close:vi.fn(),updateTheme:vi.fn(),currentWebContents:()=>id,reveal:vi.fn()};windows.set(id,c);return c;
 }});
 await collection.accept({type:"pet.listed",payload:{pets:Array.from({length:5},(_,i)=>({id:`p${i}`}))}});
 expect(windows.size).toBe(5);
 collection.setReceiving("p1",true);await collection.hidePet("p1");expect(windows.get("p1").close).not.toHaveBeenCalled();
 collection.setReceiving("p1",false);expect(windows.get("p1").close).toHaveBeenCalled();
 await collection.accept({type:"thread.started",threadId:"t1",payload:{petId:"p1"}});
 await collection.accept({type:"permission.requested",threadId:"t1",requestId:"r1",timestamp:new Date().toISOString(),payload:{}});
 expect(windows.get("p1").reveal).toHaveBeenCalled();
 expect(collection.controllerForSender("p2")).toBe(windows.get("p2"));expect(collection.controllerForSender("bad")).toBeUndefined();
});

it("两个已登记 sender 只能移动和隐藏自己的窗口",async()=>{
 const callbacks=new Map<string,(event:{sender:unknown},...args:unknown[])=>void>();
 const windows=new Map<string,any>();
 const collection=new PetWindowCollection({url:"ws://local",preferences:{load:()=>({}),save:vi.fn()},createController:id=>{
  const c={show:vi.fn(async()=>{}),hide:vi.fn(),close:vi.fn(),updateTheme:vi.fn(),currentWebContents:()=>id,reveal:vi.fn(),beginMove:vi.fn(),move:vi.fn(),endMove:vi.fn(),setLayout:vi.fn(),setInteractiveRegions:vi.fn()};windows.set(id,c);return c;
 }});
 await collection.accept({type:"pet.listed",payload:{pets:[{id:"a"},{id:"b"}]}});
 const {registerPetWindowIpc}=await import("../../src/main/petWindowIpc.ts");
 const dispose=registerPetWindowIpc({on:(channel,listener)=>callbacks.set(channel,listener),removeListener:channel=>callbacks.delete(channel)},collection);
 callbacks.get("pet-window:move")!({sender:"a"},"b");expect(windows.get("b").move).not.toHaveBeenCalled();expect(windows.get("a").move).not.toHaveBeenCalled();
 callbacks.get("pet-window:move")!({sender:"a"});expect(windows.get("a").move).toHaveBeenCalledOnce();
 callbacks.get("pet-window:hide")!({sender:"a"},"b");expect(windows.get("b").hide).not.toHaveBeenCalled();
 callbacks.get("pet-window:hide")!({sender:"unknown"});expect(windows.get("a").hide).not.toHaveBeenCalled();
 callbacks.get("pet-window:hide")!({sender:"a"});expect(windows.get("a").hide).toHaveBeenCalledOnce();expect(windows.get("b").hide).not.toHaveBeenCalled();dispose();
});
