import { afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentMessage } from '@handagent/core/runtime/types/AgentMessage.ts';
import { attachThreadSocketHandlers } from '../../src/server/server.ts';
import { ThreadTools } from "@handagent/core/thread/ThreadTools.ts";
import { threadHarness, input } from '../support/threadHarness.ts';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

class Socket extends EventEmitter {
  frames: any[] = [];
  send(text: string) { this.frames.push(JSON.parse(text)); }
}

it('reuses real-directory Workspaces and preserves ordinary role inputs and isolated Thread history across restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workspace-management-')); roots.push(dir);
  const dbPath = join(dir, 'threads.sqlite');
  const requests: AgentMessage[][] = [];
  const model = { complete: async (messages: AgentMessage[]) => {
    requests.push(structuredClone(messages));
    const latestUser = messages.filter(message => message.role === 'user').at(-1);
    if (latestUser?.content === '同轮规则固定' && !messages.some(message => message.role === 'tool')) {
      await writeFile(join(dir, 'shared', 'AGENTS.md'), '模型调用中改写的第三版');
      return {message:{role:'assistant' as const,content:''},toolCalls:[{id:'read-once',name:'test.read',arguments:{}}]};
    }
    return { message: { role: 'assistant' as const, content: '完成' } };
  } };
  let h = threadHarness(model, {createTools:()=>new ThreadTools({resolveTools:()=>[{name:"test.read",description:"读取",inputSchema:{type:"object"},requiresPermission:false,call:async()=>"当前内容"}]})}, dbPath);
  const sockets: Socket[] = [];
  const connect = () => {
    const socket = new Socket();
    attachThreadSocketHandlers(socket, { commandRouter: h.router, eventPublisher: h.publisher });
    sockets.push(socket); return socket;
  };
  let a = connect(); let serial = 0;
  const send = async (type: string, payload?: unknown, threadId?: string, identity?: string) => {
    const commandId = identity ?? `management-${++serial}`;
    const before = a.frames.filter(frame=>frame.commandId===commandId).length;
    a.emit('message', JSON.stringify({ type, commandId, timestamp: 'now', ...(payload === undefined ? {} : { payload }), ...(threadId ? { threadId } : {}) }));
    await vi.waitFor(() => expect(a.frames.filter(frame => frame.commandId === commandId)).toHaveLength(before+1));
    return a.frames.filter(frame=>frame.commandId===commandId).at(-1);
  };
  const submit = async (threadId: string, text: string, role?: string, opId = `input-${++serial}`) => {
    const before = requests.length;
    const op = input(text); op.opId = opId;
    const payload = {items:[...op.payload.items,...(role ? [{type:'skill',id:'ordinary-role',actionId:'ordinary-role',title:'角色习惯',prompt:role}]:[])]};
    a.emit('message', JSON.stringify({type:'op.submit',commandId:`submit-${++serial}`,timestamp:'now',threadId,payload:{op:{...op,payload}}}));
    await vi.waitFor(() => { expect(requests).toHaveLength(before+(text==='同轮规则固定'?2:1)); expect(h.threads.get(threadId)?.status).toBe('idle'); });
    return JSON.stringify(requests.at(-1));
  };
  try {
    const created = await send('workspace.create',{rootPath:join(dir,'shared')});
    expect(created.type).toBe('workspace.created');
    const workspace = created.payload.workspace;
    expect(created.payload).toEqual({workspace,created:true});
    await symlink(workspace.rootPath,join(dir,'alias'));
    expect((await send('workspace.create',{rootPath:join(dir,'alias')})).payload).toEqual({workspace,created:false});
    const concurrent = await Promise.all(['concurrent-a','concurrent-b'].map(commandId=>send('workspace.create',{rootPath:join(dir,'concurrent')},undefined,commandId)));
    expect(concurrent[0].payload.workspace.id).toBe(concurrent[1].payload.workspace.id);
    expect((await send('workspace.create',{rootPath:join(dir,'must-not-create')},undefined,'concurrent-a')).payload.workspace.id).toBe(concurrent[0].payload.workspace.id);
    await rm(concurrent[0].payload.workspace.rootPath,{recursive:true});
    await writeFile(concurrent[0].payload.workspace.rootPath,'目录暂时不可用');
    expect((await send('workspace.create',{rootPath:concurrent[0].payload.workspace.rootPath},undefined,'concurrent-a')).payload.workspace.id).toBe(concurrent[0].payload.workspace.id);
    await writeFile(join(workspace.rootPath,'AGENTS.md'),'项目规则第一版');
    const old = await send('thread.start',{workspaceId:workspace.id},undefined,'stable-start');
    expect(old.payload).toMatchObject({workspaceId:workspace.id,rootPath:workspace.rootPath});
    expect((await send('thread.start',{workspaceId:workspace.id},undefined,'stable-start')).threadId).toBe(old.threadId);
    await submit(old.threadId,'只属于第一对话的资料','首轮普通角色','stable-first-input');
    const original = await h.persistence.getThread(old.threadId);
    expect(original?.messages[0]).toMatchObject({role:'user',inputItems:[{type:'text',text:'只属于第一对话的资料'},{type:'skill',prompt:'首轮普通角色'}]});
    expect(requests.at(-1)?.filter(message=>message.role==='system').map(message=>message.content).join('')).not.toContain('首轮普通角色');
    const beforeDuplicate = requests.length;
    const replay = input('只属于第一对话的资料'); replay.opId='stable-first-input';
    a.emit('message',JSON.stringify({type:'op.submit',commandId:'replay-input',timestamp:'now',threadId:old.threadId,payload:{op:replay}}));
    await vi.waitFor(()=>expect(a.frames.filter(frame=>frame.type==='user.message.recorded'&&frame.payload.messageId==='stable-first-input')).toHaveLength(2));
    expect(requests).toHaveLength(beforeDuplicate);
    const other = await send('thread.start',{workspaceId:workspace.id});
    const otherContext = await submit(other.threadId,'只属于第二对话的资料');
    expect(otherContext).toContain('项目规则第一版'); expect(otherContext).not.toContain('只属于第一对话的资料');
    await writeFile(join(workspace.rootPath,'AGENTS.md'),'项目规则第二版');
    const fixedRules = await submit(other.threadId,'同轮规则固定');
    expect(fixedRules).toContain('项目规则第二版'); expect(fixedRules).not.toContain('模型调用中改写的第三版');
    const page = await send('thread.list',{workspaceId:workspace.id,limit:1});
    const next = await send('thread.list',{workspaceId:workspace.id,limit:1,cursor:page.payload.nextCursor});
    expect(new Set([...page.payload.threads,...next.payload.threads].map(row=>row.id))).toEqual(new Set([old.threadId,other.threadId]));
    for(const socket of sockets.splice(0))socket.emit('close'); await h.close();
    h = threadHarness(model,{},dbPath); a=connect();
    expect((await send('workspace.list')).payload.workspaces).toContainEqual(workspace);
    expect((await send('thread.resume',undefined,old.threadId)).payload).toMatchObject({workspaceId:workspace.id,rootPath:workspace.rootPath});
    const restored = await submit(old.threadId,'重启后继续');
    expect(restored).toContain('首轮普通角色'); expect(restored).toContain('只属于第一对话的资料'); expect(restored).not.toContain('只属于第二对话的资料');
    await rm(join(workspace.rootPath,'AGENTS.md'));
    expect(await submit(old.threadId,'缺失规则继续')).not.toContain('模型调用中改写的第三版');
    await rm(workspace.rootPath,{recursive:true}); const beforeFailure = requests.length;
    a.emit('message',JSON.stringify({type:'op.submit',commandId:'unavailable-root',timestamp:'now',threadId:old.threadId,payload:{op:input('目录不可用')}}));
    await vi.waitFor(()=>expect(h.threads.get(old.threadId)?.status).toBe('failed'));
    expect(requests).toHaveLength(beforeFailure);
    expect(JSON.stringify(h.threads.get(old.threadId)?.snapshot().messages)).toContain('无法读取项目根目录 AGENTS.md');
    expect((await send('workspace.list')).payload.workspaces).toContainEqual(workspace);
  } finally { for(const socket of sockets)socket.emit('close'); await h.close(); }
});

it('preserves a deleted creation identity across owner restarts while allowing genuinely new Threads', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pet-deleted-create-')); roots.push(dir);
  const dbPath = join(dir, 'threads.sqlite');
  const requests: AgentMessage[][] = [];
  const model = { complete: async (messages: AgentMessage[]) => {
    requests.push(structuredClone(messages));
    return { message: {role:'assistant' as const,content:'完成'} };
  } };
  let h = threadHarness(model, {createTools:()=>new ThreadTools({resolveTools:()=>[{name:"test.read",description:"读取",inputSchema:{type:"object"},requiresPermission:false,call:async()=>"当前内容"}]})}, dbPath);
  const frames:any[]=[];
  const attach = () => h.publisher.attachConnection('pet-window',frame=>frames.push(frame));
  attach();
  const command = {type:'thread.start' as const,commandId:'lost-created-ack',timestamp:'now',payload:{workspaceId:h.workspace.id}};
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
    h = threadHarness(model, {createTools:()=>new ThreadTools({resolveTools:()=>[{name:"test.read",description:"读取",inputSchema:{type:"object"},requiresPermission:false,call:async()=>"当前内容"}]})}, dbPath); attach();
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
