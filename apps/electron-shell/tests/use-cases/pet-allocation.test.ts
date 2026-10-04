import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PetWindowCollection } from "../../src/main/windows/petWindowCollection.ts";
import { FrontendPetStore } from "../../src/main/pets/frontendPetStore.ts";

describe("frontend partner allocation through public operations", () => {
  it("restores inventory and desktop choices without reseeding or stealing visible threads", () => {
    const directory = mkdtempSync(join(tmpdir(), "wisp-pets-"));
    try {
      const store = new FrontendPetStore(join(directory, "pets.json"));
      store.initialize("workspace-a");
      const pets = store.list();
      expect(pets.filter(pet => pet.visible)).toHaveLength(1);
      expect(pets.length).toBeGreaterThanOrEqual(12);
      const a = pets[0], b = pets[1], c = pets[2];
      store.assign(a.id, "workspace-a", "thread-a");
      expect(store.open("workspace-a", "thread-a").id).toBe(a.id);
      expect(() => store.assign(b.id, "workspace-a", "thread-a")).toThrow("Thread 正在运行");
      store.hide(a.id);
      store.assign(b.id, "workspace-a", "thread-a");
      expect(store.get(a.id)).toMatchObject({threadId:null,workspaceId:"workspace-a",visible:false});
      expect(store.get(b.id)).toMatchObject({threadId:"thread-a",visible:true});
      store.setSize(b.id, 125);
      store.setPosition(b.id, {right:800,bottom:600});
      store.hide(b.id);
      expect(store.open("workspace-a", "thread-a").id).toBe(b.id);
      store.hide(b.id);
      store.assign(c.id,"workspace-b",null);
      store.hide(c.id);
      store.assign(c.id,"workspace-c",null);
      for (const pet of store.list()) if (pet.visible) store.hide(pet.id);
      const restored = new FrontendPetStore(join(directory, "pets.json"));
      restored.initialize("workspace-a");
      expect(restored.list()).toHaveLength(pets.length);
      expect(restored.list().filter(pet=>pet.visible)).toEqual([]);
      expect(restored.get(b.id)).toMatchObject({threadId:"thread-a",size:125,position:{right:800,bottom:600}});
    } finally {rmSync(directory,{recursive:true,force:true});}
  });

  it("converges automatic history allocation and preserves both partners on an occupied manual selection", async () => {
    const directory = mkdtempSync(join(tmpdir(), "wisp-pets-"));
    try {
      const store = new FrontendPetStore(join(directory, "pets.json"));
      store.initialize("workspace-a");
      class Socket {
        readyState=1;
        onopen?:()=>void;onmessage?:(event:{data:string})=>void;onclose?:()=>void;onerror?:()=>void;
        constructor(){queueMicrotask(()=>this.onopen?.());}
        send(raw:string){const command=JSON.parse(raw);const payload=command.type==='workspace.list' ? {workspaces:[{id:'workspace-a'},{id:'workspace-b'},{id:'workspace-c'}]} : {threads:command.payload?.workspaceId==='workspace-c' ? [] : [{id:'thread-b',workspaceId:'workspace-b'}]};queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({type:command.type==='workspace.list'?'workspace.listed':'thread.listed',commandId:command.commandId,payload})}));}
        close(){this.readyState=3;this.onclose?.();}
      }
      vi.stubGlobal('WebSocket',Socket);
      const windows=new Map<string,{show:ReturnType<typeof vi.fn>;reveal:ReturnType<typeof vi.fn>}>();
      const collection=new PetWindowCollection({url:'ws://localhost/api/thread',store,defaultWorkspaceRoot:directory,createController:id=>{
        const controller={show:vi.fn(async()=>{}),reveal:vi.fn(),hide:vi.fn(),close:vi.fn(),updateTheme:vi.fn(async()=>{}),currentWebContents:()=>null,setLayout:vi.fn(),setInteractiveRegions:vi.fn(),beginMove:vi.fn(),move:vi.fn(),endMove:vi.fn()};windows.set(id,controller);return controller;
      }});
      try {
        await collection.show();
        await Promise.all([collection.openWorkspaceThread('workspace-b','thread-b'),collection.accept({type:'permission.requested',threadId:'thread-b',requestId:'request-b',timestamp:new Date().toISOString(),payload:{}})]);
        const owners=store.list().filter(pet=>pet.threadId==='thread-b');
        expect(owners).toHaveLength(1);
        const first=owners[0];
        expect(windows.has(first.id)).toBe(true);
        await collection.accept({type:'request.resolved',threadId:'thread-b',payload:{requestId:'request-b'}});
        for(const pet of store.list())store.hide(pet.id);
        await collection.accept({type:'permission.requested',threadId:'thread-b',requestId:'request-b',timestamp:new Date().toISOString(),payload:{}});
        expect(store.list().every(pet=>!pet.visible)).toBe(true);
        // A request resolved while metadata is being queried must never recall a partner.
        const requesting=collection.accept({type:'permission.requested',threadId:'missing',requestId:'ended',timestamp:new Date().toISOString(),payload:{}});
        await collection.accept({type:'request.resolved',threadId:'missing',payload:{requestId:'ended'}});
        await requesting;
        expect(store.list().every(pet=>!pet.visible)).toBe(true);
        const initialOwner=store.get(first.id);
        const attaching=collection.assignPet({petId:first.id,workspaceId:'workspace-b',threadId:'thread-b',activate:false,expected:{workspaceId:initialOwner.workspaceId,threadId:initialOwner.threadId}});
        await collection.hidePet(first.id);
        await attaching;
        expect(store.get(first.id)).toMatchObject({visible:false,threadId:'thread-b'});
        const delayed=collection.assignPet({petId:first.id,workspaceId:'workspace-b',threadId:'thread-b',activate:false});
        const newTopic=collection.assignPet({petId:first.id,workspaceId:'workspace-b',threadId:null,activate:false});
        await Promise.all([delayed,newTopic]);
        expect(store.get(first.id)).toMatchObject({visible:false,threadId:null});
        const chosenWorkspace=collection.assignPet({petId:first.id,workspaceId:'workspace-c',threadId:null});
        const lateCreation=collection.assignPet({petId:first.id,workspaceId:'workspace-b',threadId:'thread-b',activate:false,expected:{workspaceId:'workspace-b',threadId:null}});
        await Promise.all([chosenWorkspace,lateCreation]);
        expect(store.get(first.id)).toMatchObject({workspaceId:'workspace-c',threadId:null});
        await collection.openWorkspaceThread('workspace-b','thread-b');
      const candidate=store.list().find(pet=>!pet.visible)!;
      const before=store.list();
      await expect(collection.assignPet({petId:candidate.id,workspaceId:"workspace-b",threadId:"thread-b"})).rejects.toThrow("Thread 正在运行");
      expect(store.list()).toEqual(before);
      await expect(collection.assignPet({petId:candidate.id,workspaceId:"workspace-c",threadId:"thread-b"})).rejects.toThrow("对话不存在");
      expect(store.list()).toEqual(before);
      await collection.assignPet({petId:first.id,workspaceId:"workspace-c",threadId:null});
      expect(store.get(first.id)).toMatchObject({workspaceId:"workspace-c",threadId:null,visible:true});
      expect(store.open("workspace-b","thread-b").threadId).toBe("thread-b");
      } finally {collection.stop();vi.unstubAllGlobals();}
    } finally {rmSync(directory,{recursive:true,force:true});}
  });
});
