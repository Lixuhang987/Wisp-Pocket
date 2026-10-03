// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsApp } from '../../src/SettingsApp.tsx';
import { MCPSettings } from '../../src/components/SettingsPages.tsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
