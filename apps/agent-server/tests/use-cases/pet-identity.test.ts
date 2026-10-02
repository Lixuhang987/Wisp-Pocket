import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ThreadStore } from '@handagent/thread-store/index.ts';
import { PetRegistry } from '@handagent/core/pet/PetRegistry.ts';
import { ThreadPersistence } from '../../src/thread/ThreadPersistence.ts';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, {recursive:true, force:true}))); });

describe('Pet identity and durable role snapshots', () => {
  it('keeps duplicate roots distinct, edits roles optimistically and restores the original Thread role', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pet-identity-')); roots.push(dir);
    const dbPath = join(dir, 'threads.sqlite');
    let store = new ThreadStore({dbPath});
    let pets = new PetRegistry(store);
    const initial = await pets.ensureDefault(join(dir, 'files'));
    const create = {name:'同名', rolePrompt:'角色一', imageRef:{type:'builtin', id:'yachiyo'} as const, rootPath:initial.rootPath};
    const a = await pets.create(create, 'create-a');
    const b = await pets.create({...create, rolePrompt:'角色二'}, 'create-b');
    expect(a.id).not.toBe(b.id);
    expect((await pets.create(create, 'create-a')).id).toBe(a.id);
    const persistence = new ThreadPersistence(store);
    const old = await persistence.createThread({petId:a.id, commandId:'thread-a'});
    await pets.update(a.id, a.revision, {rolePrompt:'新版角色', isDefault:true});
    await expect(pets.update(a.id,a.revision,{name:'过期'})).rejects.toMatchObject({code:'conflict'});
    const fresh = await persistence.createThread({petId:a.id, commandId:'thread-b'});
    expect(old.metadata.petSnapshot.rolePrompt).toBe('角色一');
    expect(fresh.metadata.petSnapshot.rolePrompt).toBe('新版角色');
    expect((await pets.list()).filter(p => p.isDefault).map(p => p.id)).toEqual([a.id]);
    store.close(); store = new ThreadStore({dbPath}); pets = new PetRegistry(store);
    try {
      const restored = await new ThreadPersistence(store).getThread(old.metadata.id);
      expect(restored?.metadata.petSnapshot).toEqual(old.metadata.petSnapshot);
      expect((await pets.get(a.id))?.rootPath).toBe(initial.rootPath);
      expect((await new ThreadPersistence(store).createThread({petId:a.id,commandId:'thread-a'})).metadata.id).toBe(old.metadata.id);
      await expect(pets.update(a.id,2,{rootPath:dir} as never)).rejects.toMatchObject({code:'invalid_input'});
    } finally { store.close(); }
  });
});

import { threadHarness, input } from '../support/threadHarness.ts';
import { vi } from 'vitest';
import type { AgentMessage } from '@handagent/core/runtime/types/AgentMessage.ts';

it('distinguishes a deleted resume target from storage failure without declaring valid drafts deleted', async () => {
  const h = threadHarness({complete: async () => ({message:{role:'assistant',content:'ok'}})});
  try {
    await h.router.receive({type:'thread.resume',commandId:'missing',timestamp:new Date().toISOString(),threadId:'deleted'},'client');
    expect(h.events.at(-1)).toMatchObject({type:'thread.error',commandId:'missing',threadId:'deleted',payload:{code:'not_found'}});
    const existing = await h.threads.create({petId:h.pet.id});
    vi.spyOn(h.persistence,'getThread').mockRejectedValueOnce(new Error('database unavailable'));
    await h.router.receive({type:'thread.resume',commandId:'unavailable',timestamp:new Date().toISOString(),threadId:'unloaded'},'client');
    expect(h.events.at(-1)).toMatchObject({type:'thread.error',commandId:'unavailable',payload:{message:'database unavailable'}});
    expect((h.events.at(-1) as any).payload).not.toHaveProperty('code');
    expect(await h.persistence.getThread(existing.id)).not.toBeNull();
  } finally { await h.close(); }
});

it('routes multiple Pet Threads, keeps role history isolated and pages stable ownership', async () => {
  const requests:AgentMessage[][]=[];
  const h=threadHarness({complete:async messages=>{requests.push(structuredClone(messages));return {message:{role:'assistant',content:'完成'}};}});
  try {
    const b=await h.pets.create({name:'第二宠',rolePrompt:'第二个角色',imageRef:{type:'builtin',id:'yachiyo'},rootPath:'/tmp'});
    const aThread=await h.threads.create({petId:h.pet.id});
    const bThread=await h.threads.create({petId:b.id});
    await aThread.submit(input('只属于A的资料'));
    await vi.waitFor(()=>expect(aThread.status).toBe('idle'));
    await bThread.submit(input('只属于B的资料'));
    await vi.waitFor(()=>expect(bThread.status).toBe('idle'));
    expect(requests[1].filter(m=>m.role==='system').map(m=>m.content).join()).toContain('第二个角色');
    expect(JSON.stringify(requests[1])).not.toContain('只属于A的资料');
    await h.pets.update(b.id,b.revision,{rolePrompt:'第三版角色'});
    await bThread.submit(input('旧对话继续'));
    await vi.waitFor(()=>expect(bThread.status).toBe('idle'));
    expect(JSON.stringify(requests.at(-1))).toContain('第二个角色');
    expect(JSON.stringify(requests.at(-1))).not.toContain('第三版角色');
    const fresh=await h.threads.create({petId:b.id});
    await fresh.submit(input('新对话'));
    await vi.waitFor(()=>expect(fresh.status).toBe('idle'));
    expect(JSON.stringify(requests.at(-1))).toContain('第三版角色');
    const frames:any[]=[];h.publisher.attachConnection('ui',frame=>frames.push(frame));
    await h.router.receive({type:'thread.list',commandId:'page1',timestamp:'now',payload:{petId:b.id,limit:1}},'ui');
    const page=frames.at(-1).payload;
    expect(page.threads).toHaveLength(1);expect(page.threads[0].petId).toBe(b.id);expect(page.nextCursor).toBeTruthy();
    await h.router.receive({type:'thread.list',commandId:'page2',timestamp:'now',payload:{petId:b.id,limit:1,cursor:page.nextCursor}},'ui');
    expect(frames.at(-1).payload.threads[0].id).not.toBe(page.threads[0].id);
    expect(frames.at(-1).payload.threads[0].petId).toBe(b.id);
  } finally {await h.close();}
});

import { EventEmitter } from 'node:events';
import { ThreadCommandRouter } from '../../src/thread/ThreadCommandRouter.ts';
import { attachThreadSocketHandlers } from '../../src/server/server.ts';
import { FilesystemBlobStore } from '@handagent/core/adapters/filesystem/FilesystemBlobStore.ts';
import sharp from 'sharp';

it('imports durable images and manages five duplicate Pets through the public socket with targeted failures', async () => {
  const dir=await mkdtemp(join(tmpdir(),'pet-management-'));roots.push(dir);
  const h=threadHarness({complete:async()=>({message:{role:'assistant',content:'ok'}})}, {},join(dir,'threads.sqlite'));
  const blobs=new FilesystemBlobStore({rootPath:join(dir,'blobs')});
  const router=new ThreadCommandRouter(h.threads,h.publisher,h.pets,undefined,undefined,blobs);
  class Socket extends EventEmitter {frames:any[]=[];send(text:string){this.frames.push(JSON.parse(text));}}
  const a=new Socket(),b=new Socket();
  attachThreadSocketHandlers(a,{commandRouter:router,eventPublisher:h.publisher});attachThreadSocketHandlers(b,{commandRouter:router,eventPublisher:h.publisher});
  let serial=0;
  const send=async(type:string,payload?:unknown)=>{
    const commandId=`management-${++serial}`;
    a.emit('message',JSON.stringify({type,commandId,timestamp:new Date().toISOString(),...(payload!==undefined?{payload}:{})}));
    await vi.waitFor(()=>expect(a.frames.some(f=>f.commandId===commandId)).toBe(true));
    return a.frames.find(f=>f.commandId===commandId);
  };
  try {
    const png=await sharp({create:{width:8,height:7,channels:4,background:'#ddccff'}}).png().toBuffer();
    const imported=await send('pet.image.import',{mimeType:'image/png',base64:png.toString('base64')});
    expect(imported.type).toBe('pet.image.imported');const imageRef=imported.payload.imageRef;
    expect(await blobs.readContent(imageRef.blobId)).toEqual(png);
    expect(b.frames.some(f=>f.type==='pet.image.imported')).toBe(false);
    const ids:string[]=[];
    for(let index=0;index<5;index++) {
      const created=await send('pet.create',{name:'同名',rolePrompt:`角色 ${index}`,rootPath:join(dir,'shared'),imageRef});
      expect(created.type).toBe('pet.created');ids.push(created.payload.pet.id);
    }
    expect(new Set(ids).size).toBe(5);expect(b.frames.filter(f=>f.type==='pet.created')).toHaveLength(5);
    const pet=(await h.pets.get(ids[0]))!;
    const changed=await send('pet.update',{id:pet.id,expectedRevision:pet.revision,patch:{name:'新名字',isDefault:true}});
    expect(changed.payload.pet).toMatchObject({name:'新名字',revision:2,isDefault:true});
    const conflict=await send('pet.update',{id:pet.id,expectedRevision:pet.revision,patch:{name:'旧窗口'}});
    expect(conflict).toMatchObject({type:'pet.error',payload:{code:'conflict',currentRevision:2}});
    expect(b.frames.some(f=>f.commandId===conflict.commandId)).toBe(false);
    expect((await send('pet.update',{id:pet.id,expectedRevision:2,patch:{rootPath:'/tmp'}})).payload.code).toBe('invalid_input');
    expect((await send('pet.image.import',{mimeType:'image/png',base64:Buffer.from('invalid image').toString('base64')})).payload.code).toBe('invalid_input');
    const oversized=await sharp({create:{width:4097,height:1,channels:3,background:'#ffffff'}}).png().toBuffer();
    expect((await send('pet.image.import',{mimeType:'image/png',base64:oversized.toString('base64')})).payload.code).toBe('invalid_input');
    expect((await send('pet.image.import',{mimeType:'image/png',base64:Buffer.alloc(20*1024*1024+1).toString('base64')})).payload.code).toBe('invalid_input');
    const commandId='stable-thread';
    for(let index=0;index<3;index++)a.emit('message',JSON.stringify({type:'thread.start',commandId,timestamp:'now',payload:{petId:pet.id}}));
    await vi.waitFor(()=>expect(a.frames.filter(f=>f.commandId===commandId)).toHaveLength(3));
    expect(a.frames.filter(f=>f.commandId===commandId).every(f=>f.type==='thread.started')).toBe(true);
    expect(new Set(a.frames.filter(f=>f.commandId===commandId).map(f=>f.threadId)).size).toBe(1);
    expect((await send('thread.start',{petId:'missing'})).type).toBe('thread.error');
    expect((await send('thread.start',{petId:pet.id,petSnapshot:{rolePrompt:'spoofed'}})).payload.code).toBe('invalid_input');
    await h.close();
    const restored=new ThreadStore({dbPath:join(dir,'threads.sqlite')});
    try {
      expect(restored.getPet(pet.id)?.imageRef).toEqual(imageRef);
      expect(await new FilesystemBlobStore({rootPath:join(dir,'blobs')}).readContent(imageRef.blobId)).toEqual(png);
    } finally {restored.close();}
  } finally {a.emit('close');b.emit('close');await h.threads.close();}
});


it('rebuilds the service owners with the saved role and accepts a retried input only once', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pet-role-restart-')); roots.push(dir);
  const dbPath = join(dir, 'threads.sqlite');
  const requests: AgentMessage[][] = [];
  const model = { complete: async (messages: AgentMessage[]) => {
    requests.push(structuredClone(messages));
    return { message: { role: 'assistant' as const, content: '已收到' } };
  } };
  let h = threadHarness(model, {}, dbPath);
  const pet = await h.pets.create({name:'角色宠', rolePrompt:'旧角色约定', imageRef:{type:'builtin',id:'yachiyo'}, rootPath:join(dir,'fixed-root')});
  const thread = await h.threads.create({petId:pet.id,commandId:'restart-thread'});
  const first = input('已经接收的输入');
  try {
    await thread.submit(first);
    await vi.waitFor(() => expect(thread.status).toBe('idle'));
    await h.pets.update(pet.id,pet.revision,{rolePrompt:'新角色约定'});
    await h.close();
    h = threadHarness(model, {}, dbPath);
    const resumed = await h.threads.load(thread.id);
    expect(resumed.snapshot()).toMatchObject({petId:pet.id,rootPath:pet.rootPath,petSnapshot:{revision:1,rolePrompt:'旧角色约定'}});
    await Promise.all([resumed.submit(first),resumed.submit(first)]);
    expect(requests).toHaveLength(1);
    expect((await h.persistence.getThread(thread.id))?.messages.filter(m=>m.role==='user')).toHaveLength(1);
    await resumed.submit(input('重启后继续'));
    await vi.waitFor(() => expect(resumed.status).toBe('idle'));
    expect(JSON.stringify(requests.at(-1))).toContain('旧角色约定');
    expect(JSON.stringify(requests.at(-1))).not.toContain('新角色约定');
    expect(JSON.stringify(requests.at(-1))).toContain('已经接收的输入');
    const fresh = await h.threads.create({petId:pet.id});
    await fresh.submit(input('重启后的新对话'));
    await vi.waitFor(() => expect(fresh.status).toBe('idle'));
    expect(JSON.stringify(requests.at(-1))).toContain('新角色约定');
    expect(JSON.stringify(requests.at(-1))).not.toContain('已经接收的输入');
    const frames:any[]=[]; h.publisher.attachConnection('restored-ui',frame=>frames.push(frame));
    await h.router.receive({type:'thread.delete',commandId:'delete-restored',timestamp:'now',payload:{targetThreadId:thread.id}},'restored-ui');
    await h.router.receive({type:'op.submit',commandId:'retry-deleted',threadId:thread.id,timestamp:'now',payload:{op:first}},'restored-ui');
    expect(frames.at(-1)).toMatchObject({type:'thread.error',commandId:'retry-deleted',threadId:thread.id});
    expect(requests).toHaveLength(3);
  } finally { await h.close(); }
});


it('recalls hidden Pets from live Permission facts without loading conversation snapshots or allowing observer answers', async () => {
  let finishModel!: (value:any) => void;
  const h = threadHarness({complete: () => new Promise(resolve => {finishModel=resolve;})});
  const thread = await h.threads.create({petId:h.pet.id});
  class Socket extends EventEmitter {frames:any[]=[];send(text:string){this.frames.push(JSON.parse(text));}}
  const observer = new Socket();
  try {
    await thread.submit(input('等待中的工作'));
    await vi.waitFor(() => expect(finishModel).toBeTypeOf('function'));
    const decision = thread.requests.askPermission({threadId:thread.id,toolName:'file.write',toolCallId:'pending-write',arguments:{path:'memo.txt'}});
    attachThreadSocketHandlers(observer,{commandRouter:h.router,eventPublisher:h.publisher,observeRequests:true});
    observer.emit('message',JSON.stringify({type:'thread.list',commandId:'observe-list',timestamp:'now',payload:{petId:h.pet.id}}));
    await vi.waitFor(() => expect(observer.frames.some(f=>f.type==='permission.requested')).toBe(true));
    expect(observer.frames[0].type).toBe('thread.listed');
    expect(observer.frames.some(f=>f.type==='thread.snapshot')).toBe(false);
    const request=observer.frames.find(f=>f.type==='permission.requested');
    observer.emit('message',JSON.stringify({type:'permission.answered',requestId:request.requestId,payload:{decision:'allow',scope:'once'}}));
    expect(thread.requests.snapshot()).toHaveLength(1);
    h.publisher.attachConnection('interactive',()=>{}); h.publisher.subscribe('interactive',thread.id);h.publisher.acceptServerRequests('interactive');
    await h.router.handleResponse({type:'permission.answered',requestId:request.requestId,payload:{decision:'deny',scope:'once'}},'interactive');
    expect(await decision).toMatchObject({decision:'deny'});
    await h.router.receive({type:'thread.start',commandId:'new-owner-notice',timestamp:'now',payload:{petId:h.pet.id}},'interactive');
    expect(observer.frames.some(f=>f.type==='thread.started')).toBe(true);
    h.publisher.publish({type:'user.message.recorded',threadId:thread.id,notificationId:'private-content',timestamp:'now',payload:{messageId:'private',text:'正文不可进入后台窗口管理器'}});
    expect(observer.frames.some(f=>f.type==='user.message.recorded')).toBe(false);
    const again=thread.requests.askPermission({threadId:thread.id,toolName:'file.write',toolCallId:'live-write',arguments:{path:'next.txt'}});
    expect(observer.frames.filter(f=>f.type==='permission.requested')).toHaveLength(2);
    await thread.interrupt();await again;
    finishModel({message:{role:'assistant',content:'结束'}});
  } finally {observer.emit('close');await h.close();}
});

it('preserves a deleted creation identity across owner restarts while allowing genuinely new Threads', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pet-deleted-create-')); roots.push(dir);
  const dbPath = join(dir, 'threads.sqlite');
  const requests: AgentMessage[][] = [];
  const model = { complete: async (messages: AgentMessage[]) => {
    requests.push(structuredClone(messages));
    return { message: {role:'assistant' as const,content:'完成'} };
  } };
  let h = threadHarness(model, {}, dbPath);
  const frames:any[]=[];
  const attach = () => h.publisher.attachConnection('pet-window',frame=>frames.push(frame));
  attach();
  const command = {type:'thread.start' as const,commandId:'lost-created-ack',timestamp:'now',payload:{petId:h.pet.id}};
  try {
    await h.router.receive(command,'pet-window');
    const deletedId = frames.at(-1).threadId;
    expect(frames.at(-1).type).toBe('thread.started');
    // The original renderer missed this ACK; another interface deletes the empty Thread.
    await h.router.receive({type:'thread.delete',commandId:'delete-empty',timestamp:'now',payload:{targetThreadId:deletedId}},'pet-window');
    expect(frames.at(-1).payload.status).toBe('deleted');
    await h.router.receive(command,'pet-window');
    expect(frames.at(-1)).toMatchObject({type:'thread.error',commandId:command.commandId,payload:{code:'not_found'}});
    expect(await h.persistence.listThreads()).toEqual([]);
    await h.close();
    h = threadHarness(model, {}, dbPath); attach();
    await h.router.receive(command,'pet-window');
    expect(frames.at(-1)).toMatchObject({type:'thread.error',commandId:command.commandId,payload:{code:'not_found'}});
    await h.router.receive({type:'op.submit',commandId:'retry-first-input',timestamp:'now',threadId:deletedId,payload:{op:input('旧接收动作不可复活')}},'pet-window');
    expect(frames.at(-1)).toMatchObject({type:'thread.error',payload:{code:'not_found'}});
    expect(await h.persistence.listThreads()).toEqual([]);
    expect(requests).toHaveLength(0);
    await h.router.receive({...command,commandId:'genuinely-new-thread'},'pet-window');
    const newId = frames.at(-1).threadId;
    expect(frames.at(-1).type).toBe('thread.started');
    expect(newId).not.toBe(deletedId);
    await h.router.receive({...command,commandId:'genuinely-new-thread'},'pet-window');
    expect(frames.at(-1).threadId).toBe(newId);
    const fresh = h.threads.get(newId)!;
    await fresh.submit(input('新的用户操作可以执行'));
    await vi.waitFor(() => expect(fresh.status).toBe('idle'));
    expect(requests).toHaveLength(1);
    expect(await h.persistence.listThreads()).toHaveLength(1);
  } finally { await h.close(); }
});
