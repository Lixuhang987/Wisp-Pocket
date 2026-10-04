// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsApp } from '../../src/SettingsApp.tsx';
import { MCPSettings } from '../../src/components/SettingsPages.tsx';

afterEach(() => { cleanup(); delete window.handAgentSettings; vi.unstubAllGlobals(); });

it('saves AI explicitly, retains a failed draft and preserves the hidden summarizer setting', async () => {
  const writes: unknown[] = [];
  let fail = true;
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, options?: RequestInit) => {
    if (options?.method === 'PUT') {
      writes.push(JSON.parse(String(options.body)));
      return new Response(JSON.stringify(fail ? {error:'配置保存失败'} : {...JSON.parse(String(options.body)),summarizerModel:'keep-summary'}), {status:fail?500:200});
    }
    if (String(_url).endsWith('/tools')) return new Response(JSON.stringify({tools:[]}));
    if (String(_url).endsWith('/mcp')) return new Response(JSON.stringify({version:1,servers:[]}));
    if (String(_url).endsWith('/permissions')) return new Response(JSON.stringify({rules:[]}));
    return new Response(JSON.stringify({provider:'openai-compatible',model:'old-model',api:'responses',baseUrl:'https://example.test/v1',apiKey:'secret',summarizerModel:'keep-summary'}));
  }));
  vi.stubGlobal('WebSocket', class { readyState=0; close(){} });
  render(<SettingsApp />);
  await screen.findByDisplayValue('old-model');
  expect(screen.getByLabelText('API Key').getAttribute('type')).toBe('password');
  fireEvent.change(screen.getByLabelText('模型'), {target:{value:'new-model'}});
  expect(writes).toHaveLength(0);
  fireEvent.change(screen.getByRole('searchbox', {name:'搜索设置'}), {target:{value:'MCP'}});
  fireEvent.click(screen.getByRole('button', {name:'MCP 服务器'}));
  expect(screen.getByRole('heading', {name:'MCP 服务器'})).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox', {name:'搜索设置'}), {target:{value:''}});
  fireEvent.click(screen.getByRole('button', {name:'模型服务'}));
  expect(screen.getByLabelText<HTMLInputElement>('模型').value).toBe('new-model');
  expect(writes).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', {name:'保存模型'}));
  await screen.findByRole('alert');
  expect(screen.getByLabelText<HTMLInputElement>('模型').value).toBe('new-model');
  fail = false;
  fireEvent.click(screen.getByRole('button', {name:'保存模型'}));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('已保存'));
  expect(writes).toHaveLength(2);
  expect(writes[1]).toMatchObject({model:'new-model'});
  expect(writes[1]).not.toHaveProperty('summarizerModel');
});

it('keeps MCP editing stable and locks changes until its save receipt arrives', async () => {
  let acknowledge!: (response:Response) => void;
  const write = vi.fn(() => new Promise<Response>(resolve => { acknowledge = resolve; }));
  vi.stubGlobal('fetch', vi.fn((_url:unknown,options?:RequestInit) => options?.method === 'PUT' ? write() : Promise.resolve(new Response(JSON.stringify({version:1,servers:[
    {id:'a',title:'A',transport:'stdio',command:'node'},
    {id:'b',title:'B',transport:'stdio',command:'node'},
  ]})))));
  render(<MCPSettings/>);
  await screen.findByText('A');
  fireEvent.click(screen.getAllByRole('button',{name:'编辑'})[1]);
  expect(screen.getAllByRole<HTMLButtonElement>('button',{name:'删除'}).every(button=>button.disabled)).toBe(true);
  fireEvent.change(screen.getByLabelText('标题'),{target:{value:'B edited'}});
  fireEvent.click(screen.getByRole('button',{name:'加入待保存配置'}));
  fireEvent.click(screen.getByRole('button',{name:'保存 MCP 配置'}));
  await waitFor(()=>expect(write).toHaveBeenCalledOnce());
  expect(screen.getByRole<HTMLButtonElement>('button',{name:'新增 MCP Server'}).disabled).toBe(true);
  expect(screen.getAllByRole<HTMLButtonElement>('button',{name:'编辑'}).every(button=>button.disabled)).toBe(true);
  expect(screen.getAllByRole<HTMLButtonElement>('button',{name:'删除'}).every(button=>button.disabled)).toBe(true);
  acknowledge(new Response(JSON.stringify({saved:true})));
  await screen.findByRole('status');
  expect(screen.getByText('B edited')).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>('button',{name:'新增 MCP Server'}).disabled).toBe(false);
});

it('creates a hidden partner and retains compact project and history selection', async () => {
  const { PetManager } = await import('../../src/components/PetManager.tsx');
  const timestamp = '2026-10-04T00:00:00.000Z';
  const pet = { id: 'pet-new', name: '新伙伴', description: '', rolePrompt: '协助完成任务', imageRef: { type: 'builtin' as const, id: 'yachiyo' }, revision: 1, isDefault: false, createdAt: timestamp, updatedAt: timestamp, workspaceId: null, threadId: null, visible: false, size: 180 };
  const savePet = vi.fn(async (_input: unknown, _commandId?: string) => pet);
  const assignPet = vi.fn(async (_input: unknown) => {});
  const bridge = { listPets: async () => [pet], savePet, onPetsChanged: () => () => {}, assignPet, openWorkspaceThread: async () => {}, summonPet: async () => {}, importPetImage: async () => pet.imageRef, setPetSize: async () => {}, showPet: async () => {}, hidePet: async () => {} };
  const workspaces = [{ id: 'workspace-a', name: '项目 A', rootPath: '/tmp/a', createdAt: timestamp }, { id: 'workspace-b', name: '项目 B', rootPath: '/tmp/b', createdAt: timestamp }];
  const threads = [{ id: 'thread-b', workspaceId: 'workspace-b', preview: '已有任务', rootPath: '/tmp/b', createdAt: timestamp, updatedAt: timestamp, messageCount: 2, status: 'idle' as const }];
  const view = render(<PetManager pets={[]} workspaces={workspaces} threads={threads} bridge={bridge} />);
  fireEvent.click(screen.getByRole('button', { name: '添加桌宠' }));
  fireEvent.change(screen.getByLabelText('名称'), { target: { value: pet.name } });
  fireEvent.change(screen.getByLabelText('角色提示'), { target: { value: pet.rolePrompt } });
  fireEvent.click(screen.getByRole('button', { name: '保存伙伴' }));
  await waitFor(() => expect(savePet).toHaveBeenCalledOnce());
  expect(savePet.mock.calls[0]?.[0]).toMatchObject({ name: pet.name });
  view.rerender(<PetManager pets={[pet]} workspaces={workspaces} threads={threads} bridge={bridge} />);
  fireEvent.click(await screen.findByRole('button', { name: '选择工作区' }));
  fireEvent.click(screen.getByRole('button', { name: '项目 B' }));
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(assignPet).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '选择工作区' }));
  fireEvent.click(screen.getByRole('button', { name: '项目 B' }));
  assignPet.mockRejectedValueOnce(new Error('该 Thread 正在由可见伙伴处理'));
  fireEvent.click(screen.getByRole('button', { name: '已有任务' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('alert').textContent).toContain('可见伙伴');
  fireEvent.click(screen.getByRole('button', { name: '已有任务' }));
  await waitFor(() => expect(assignPet).toHaveBeenCalledTimes(2));
  expect(assignPet.mock.calls[1]?.[0]).toEqual({ petId: pet.id, workspaceId: 'workspace-b', threadId: 'thread-b' });
});


it('picks a directory directly for partner assignment and showing, preserving cancellation and current history', async () => {
  const timestamp = '2026-10-04T00:00:00.000Z';
  const workspaceA = {id:'workspace-a',name:'项目 A',rootPath:'/tmp/a',createdAt:timestamp};
  const workspaceB = {id:'workspace-b',name:'项目 B',rootPath:'/tmp/b',createdAt:timestamp};
  let pets = [{id:'pet-a',name:'小晴',description:'',rolePrompt:'协助完成任务',imageRef:{type:'builtin' as const,id:'yachiyo'},revision:1,isDefault:false,createdAt:timestamp,updatedAt:timestamp,workspaceId:'workspace-a',threadId:'thread-a' as string|null,visible:false,size:180}];
  let notifyPets = (_pets:typeof pets) => {};
  let finishPicker!: (path:string|null) => void;
  const chooseDirectory = vi.fn(() => new Promise<string|null>(resolve => {finishPicker=resolve;}));
  const assignPet = vi.fn(async (input:{petId:string;workspaceId:string;threadId:string|null}) => {
    pets=pets.map(pet=>({...pet,workspaceId:input.workspaceId,threadId:input.threadId,visible:true}));notifyPets(pets);
  });
  window.handAgentSettings = {
    chooseDirectory,assignPet,listPets:async()=>pets,savePet:async()=>pets[0],
    onPetsChanged:handler=>{notifyPets=handler;return()=>{};},
    hidePet:async()=>{pets=pets.map(pet=>({...pet,visible:false}));notifyPets(pets);},
    showPet:async()=>{throw new Error('Use the confirmed directory assignment');},
    openWorkspaceThread:async()=>{},summonPet:async()=>{},importPetImage:async()=>pets[0].imageRef,setPetSize:async()=>{},
  };
  vi.stubGlobal('fetch',vi.fn(async (url:unknown)=>new Response(JSON.stringify(
    String(url).endsWith('/tools') ? {tools:[]} : String(url).endsWith('/mcp') ? {version:1,servers:[]} : String(url).endsWith('/permissions') ? {rules:[]} : {provider:'openai-compatible',model:'test-model',api:'responses'}
  ))));
  let socket!: FakeSocket;
  class FakeSocket {
    readyState=0;onopen:(()=>void)|null=null;onclose:(()=>void)|null=null;onmessage:((event:{data:string})=>void)|null=null;
    sent:Array<{type:string;commandId:string;payload?:unknown}>=[];
    constructor(){socket=this;}
    send(raw:string){this.sent.push(JSON.parse(raw));}
    close(){}
  }
  vi.stubGlobal('WebSocket',FakeSocket);
  render(<SettingsApp/>);
  let sequence=0;
  function receive(type:string,payload:unknown,commandId?:string) {
    act(()=>socket.onmessage?.({data:JSON.stringify({type,notificationId:`picker-${++sequence}`,timestamp,payload,...(commandId?{commandId}:{})})}));
  }
  const creates=()=>socket.sent.filter(command=>command.type==='workspace.create');
  act(()=>{socket.readyState=1;socket.onopen?.();});
  receive('workspace.listed',{workspaces:[workspaceA]});
  fireEvent.click(screen.getByRole('button',{name:'桌面伙伴'}));
  await screen.findByRole('article',{name:'小晴'});

  fireEvent.click(screen.getByRole('button',{name:'选择工作区'}));
  expect(chooseDirectory).toHaveBeenCalledOnce();
  expect(screen.getByRole<HTMLButtonElement>('button',{name:'显示'}).disabled).toBe(true);
  await act(async()=>finishPicker(null));
  expect(creates()).toHaveLength(0);
  expect(assignPet).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button',{name:'显示'}));
  expect(chooseDirectory).toHaveBeenCalledTimes(2);
  await act(async()=>finishPicker('/tmp/a'));
  await waitFor(()=>expect(creates()).toHaveLength(1));
  expect(creates()[0].payload).toEqual({rootPath:'/tmp/a'});
  expect(assignPet).not.toHaveBeenCalled();
  receive('workspace.created',{workspace:workspaceA,created:false},creates()[0].commandId);
  await screen.findByRole('button',{name:'隐藏'});
  expect(assignPet.mock.calls[0][0]).toEqual({petId:'pet-a',workspaceId:'workspace-a',threadId:'thread-a'});
  fireEvent.click(screen.getByRole('button',{name:'隐藏'}));
  await screen.findByRole('button',{name:'显示'});

  fireEvent.click(screen.getByRole('button',{name:'选择工作区'}));
  await act(async()=>finishPicker('/tmp/b'));
  receive('workspace.error',{code:'invalid_input',message:'目录无法访问'},creates().at(-1)!.commandId);
  expect((await screen.findByRole('alert')).textContent).toContain('目录无法访问');
  expect(assignPet).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole('button',{name:'选择工作区'}));
  await act(async()=>finishPicker('/tmp/b'));
  assignPet.mockRejectedValueOnce(new Error('安排失败，请重试'));
  receive('workspace.created',{workspace:workspaceB,created:true},creates().at(-1)!.commandId);
  expect((await screen.findByRole('alert')).textContent).toContain('安排失败');
  expect(pets[0]).toMatchObject({workspaceId:'workspace-a',threadId:'thread-a',visible:false});
  fireEvent.click(screen.getByRole('button',{name:'选择工作区'}));
  await act(async()=>finishPicker('/tmp/b'));
  receive('workspace.created',{workspace:workspaceB,created:false},creates().at(-1)!.commandId);
  await screen.findByRole('button',{name:'隐藏'});
  expect(assignPet.mock.calls.at(-1)![0]).toEqual({petId:'pet-a',workspaceId:'workspace-b',threadId:null});
  expect(within(screen.getByRole('article',{name:'小晴'})).getByText('项目 B')).toBeTruthy();
});
