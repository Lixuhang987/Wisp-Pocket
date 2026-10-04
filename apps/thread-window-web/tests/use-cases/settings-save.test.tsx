// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsApp } from '../../src/SettingsApp.tsx';
import { MCPSettings } from '../../src/components/SettingsPages.tsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('saves AI explicitly, retains a failed draft and preserves the hidden summarizer setting', async () => {
  const writes: unknown[] = [];
  let fail = true;
  let codexReady = false;
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, options?: RequestInit) => {
    if (options?.method === 'PUT') {
      writes.push(JSON.parse(String(options.body)));
      return new Response(JSON.stringify(fail ? {error:'配置保存失败'} : {...JSON.parse(String(options.body)),summarizerModel:'keep-summary'}), {status:fail?500:200});
    }
    if (String(_url).endsWith('/tools')) return new Response(JSON.stringify({codex:{state:codexReady?'ready':'not_logged_in',message:codexReady?'Codex CLI 已安装并登录':'请运行 codex login',version:'codex-cli fixture'}}));
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
  fireEvent.click(screen.getByRole('button', {name:'Codex 执行'}));
  await screen.findByText('请运行 codex login');
  codexReady = true;
  fireEvent.click(screen.getByRole('button', {name:'重新检查'}));
  await screen.findByText('Codex CLI 已安装并登录');
  fireEvent.click(screen.getByRole('button', {name:'模型服务'}));
  expect(screen.getByLabelText<HTMLInputElement>('模型').value).toBe('new-model');
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

it('creates a hidden partner without a directory and assigns it through project and history selection', async () => {
  const { PetManager } = await import('../../src/components/PetManager.tsx');
  const timestamp = '2026-10-04T00:00:00.000Z';
  const pet = { id: 'pet-new', name: '新伙伴', description: '', rolePrompt: '协助完成任务', imageRef: { type: 'builtin' as const, id: 'yachiyo' }, revision: 1, isDefault: false, createdAt: timestamp, updatedAt: timestamp, workspaceId: null, threadId: null, visible: false, size: 180 };
  const savePet = vi.fn(async (_input: unknown, _commandId?: string) => pet);
  const assignPet = vi.fn(async (_input: unknown) => {});
  const bridge = { listPets: async () => [pet], savePet, onPetsChanged: () => () => {}, assignPet, openWorkspaceThread: async () => {}, summonPet: async () => {}, importPetImage: async () => pet.imageRef, setPetSize: async () => {}, showPet: async () => {}, hidePet: async () => {} };
  const workspaces = [{ id: 'workspace-a', name: '项目 A', rootPath: '/tmp/a', createdAt: timestamp }, { id: 'workspace-b', name: '项目 B', rootPath: '/tmp/b', createdAt: timestamp }];
  const threads = [{ id: 'thread-b', workspaceId: 'workspace-b', preview: '已有任务', rootPath: '/tmp/b', createdAt: timestamp, updatedAt: timestamp, messageCount: 2, status: 'idle' as const }];
  const view = render(<PetManager layout="gallery" pets={[]} workspaces={workspaces} threads={threads} bridge={bridge} />);
  fireEvent.click(screen.getByRole('button', { name: '添加桌宠' }));
  fireEvent.change(screen.getByLabelText('名称'), { target: { value: pet.name } });
  fireEvent.change(screen.getByLabelText('角色提示'), { target: { value: pet.rolePrompt } });
  fireEvent.click(screen.getByRole('button', { name: '保存伙伴' }));
  await waitFor(() => expect(savePet).toHaveBeenCalledOnce());
  expect(savePet.mock.calls[0]?.[0]).toMatchObject({ name: pet.name });
  view.rerender(<PetManager layout="gallery" pets={[pet]} workspaces={workspaces} threads={threads} bridge={bridge} />);
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
