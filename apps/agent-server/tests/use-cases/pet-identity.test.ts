import { afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { FilesystemBlobStore } from '@handagent/core/adapters/filesystem/FilesystemBlobStore.ts';
import type { AgentMessage } from '@handagent/core/runtime/types/AgentMessage.ts';
import { ThreadCommandRouter } from '../../src/thread/ThreadCommandRouter.ts';
import { attachThreadSocketHandlers } from '../../src/server/server.ts';
import { threadHarness, input } from '../support/threadHarness.ts';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

class Socket extends EventEmitter {
  frames: any[] = [];
  send(text: string) { this.frames.push(JSON.parse(text)); }
}

it('creates same-root Pets through the socket and preserves their images and isolated role snapshots across restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pet-management-'));
  roots.push(dir);
  const dbPath = join(dir, 'threads.sqlite');
  const requests: AgentMessage[][] = [];
  const model = { complete: async (messages: AgentMessage[]) => {
    requests.push(structuredClone(messages));
    return { message: { role: 'assistant' as const, content: '完成' } };
  } };
  let h = threadHarness(model, {}, dbPath);
  const blobPath = join(dir, 'blobs');
  let blobs = new FilesystemBlobStore({ rootPath: blobPath });
  const sockets: Socket[] = [];
  const connect = () => {
    const socket = new Socket();
    const router = new ThreadCommandRouter(h.threads, h.publisher, h.pets, undefined, undefined, blobs);
    attachThreadSocketHandlers(socket, { commandRouter: router, eventPublisher: h.publisher });
    sockets.push(socket);
    return socket;
  };
  let a = connect();
  const observer = connect();
  let serial = 0;
  const send = async (type: string, payload?: unknown, threadId?: string) => {
    const commandId = `management-${++serial}`;
    a.emit('message', JSON.stringify({ type, commandId, timestamp: 'now', ...(payload === undefined ? {} : { payload }), ...(threadId ? { threadId } : {}) }));
    await vi.waitFor(() => expect(a.frames.some(frame => frame.commandId === commandId)).toBe(true));
    return a.frames.find(frame => frame.commandId === commandId);
  };
  const submit = async (threadId: string, text: string) => {
    const before = requests.length;
    a.emit('message', JSON.stringify({ type: 'op.submit', commandId: `input-${++serial}`, timestamp: 'now', threadId, payload: { op: input(text) } }));
    await vi.waitFor(() => {
      expect(requests).toHaveLength(before + 1);
      expect(h.threads.get(threadId)?.status).toBe('idle');
    });
    return JSON.stringify(requests.at(-1));
  };
  try {
    const png = await sharp({ create: { width: 8, height: 7, channels: 4, background: '#ddccff' } }).png().toBuffer();
    const imported = await send('pet.image.import', { mimeType: 'image/png', base64: png.toString('base64') });
    expect(imported.type).toBe('pet.image.imported');
    const imageRef = imported.payload.imageRef;
    expect(await blobs.readContent(imageRef.blobId)).toEqual(png);
    expect(observer.frames.some(frame => frame.type === 'pet.image.imported')).toBe(false);
    const pets = [];
    for (let index = 0; index < 5; index++) {
      const created = await send('pet.create', { name: '同名', rolePrompt: `角色 ${index}`, rootPath: join(dir, 'shared'), imageRef });
      expect(created.type).toBe('pet.created');
      pets.push(created.payload.pet);
    }
    expect(new Set(pets.map(pet => pet.id)).size).toBe(5);
    expect(observer.frames.filter(frame => frame.type === 'pet.created')).toHaveLength(5);
    const pet = pets[0];
    const old = await send('thread.start', { petId: pet.id });
    await submit(old.threadId, '只属于第一宠的资料');
    const other = await send('thread.start', { petId: pets[1].id });
    const otherContext = await submit(other.threadId, '只属于第二宠的资料');
    expect(otherContext).toContain('角色 1');
    expect(otherContext).not.toContain('只属于第一宠的资料');
    const changedRoot = await send('pet.update', { id: pet.id, expectedRevision: pet.revision, patch: { rootPath: join(dir, 'other') } });
    expect(changedRoot).toMatchObject({ type: 'pet.error', payload: { code: 'invalid_input' } });
    const updated = await send('pet.update', { id: pet.id, expectedRevision: pet.revision, patch: { name: '新名字', rolePrompt: '新版角色', isDefault: true } });
    expect(updated.payload.pet).toMatchObject({ name: '新名字', rolePrompt: '新版角色', revision: 2, rootPath: pet.rootPath });
    const staleEdit = await send('pet.update', { id: pet.id, expectedRevision: pet.revision, patch: { rolePrompt: '过期表单角色' } });
    expect(staleEdit).toMatchObject({ type: 'pet.error', payload: { code: 'conflict', currentRevision: 2 } });
    const listed = await send('pet.list');
    expect(listed.payload.pets.filter((value: any) => value.isDefault).map((value: any) => value.id)).toEqual([pet.id]);
    const oldContext = await submit(old.threadId, '旧对话继续');
    expect(oldContext).toContain('角色 0');
    expect(oldContext).not.toContain('新版角色');
    const fresh = await send('thread.start', { petId: pet.id });
    const newContext = await submit(fresh.threadId, '新对话');
    expect(newContext).toContain('新版角色');
    expect(newContext).not.toContain('只属于第一宠的资料');

    for (const socket of sockets.splice(0)) socket.emit('close');
    await h.close();
    h = threadHarness(model, {}, dbPath);
    blobs = new FilesystemBlobStore({ rootPath: blobPath });
    a = connect();
    const restored = (await send('pet.list')).payload.pets.find((value: any) => value.id === pet.id);
    expect(restored).toMatchObject({ name: '新名字', rolePrompt: '新版角色', rootPath: pet.rootPath, imageRef, isDefault: true });
    expect(await blobs.readContent(imageRef.blobId)).toEqual(png);
    const snapshot = await send('thread.resume', undefined, old.threadId);
    expect(snapshot.payload).toMatchObject({ petId: pet.id, rootPath: pet.rootPath, petSnapshot: { revision: 1, rolePrompt: '角色 0' } });
    const restoredContext = await submit(old.threadId, '重启后继续');
    expect(restoredContext).toContain('角色 0');
    expect(restoredContext).toContain('只属于第一宠的资料');
    expect(restoredContext).not.toContain('新版角色');
    expect(restoredContext).not.toContain('只属于第二宠的资料');
  } finally {
    for (const socket of sockets) socket.emit('close');
    await h.close();
  }
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
