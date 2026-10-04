import { Bot, Blocks, Folder, PawPrint, Search, ShieldCheck, Wrench, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AISettings, MCPSettings, PermissionsSettings, ToolsSettings } from './components/SettingsPages.tsx';
import { PetManager } from './components/PetManager.tsx';
import { WorkspaceManager, type WorkspaceCommand } from './components/WorkspaceManager.tsx';
import type { Pet } from './native/petTypes.ts';
import { getThreadWebSocketURL } from './native/nativeConfig.ts';
import './native/settingsBridge.ts';
import { applyThemeToDocument, getInitialTheme, installThemeSubscription } from './native/themeConfig.ts';
import { makeThreadWindowStore } from './store/threadWindowStore.ts';
import { ThreadSocketClient } from './thread/threadSocketClient.ts';
import type { ThreadNotification } from './protocol/threadProtocol.ts';
import './styles/settings.css';

const settingsPages = [
  { id: 'AI', label: '模型服务', group: '个人', icon: Bot, keywords: 'AI provider api 模型 接口 密钥' },
  { id: 'Pets', label: '桌面伙伴', group: '个人', icon: PawPrint, keywords: 'Pets 桌宠 虚拟宠物 角色' },
  { id: 'Tools', label: 'Codex 执行', group: '集成', icon: Wrench, keywords: 'Codex CLI Agent Tools 工具' },
  { id: 'MCP', label: 'MCP 服务器', group: '集成', icon: Blocks, keywords: 'Agent 插件 扩展' },
  { id: 'Permissions', label: '权限', group: '集成', icon: ShieldCheck, keywords: 'Agent Permissions 授权' },
  { id: 'Workspaces', label: '工作区', group: '项目', icon: Folder, keywords: 'Workspaces 项目 目录 历史' },
] as const;
type SettingsPage = typeof settingsPages[number]['id'];

export function SettingsApp() {
  const [page,setPage]=useState<SettingsPage>('AI');
  const [search,setSearch]=useState('');
  const filteredPages=settingsPages.filter(item=>`${item.label} ${item.keywords}`.toLowerCase().includes(search.trim().toLowerCase()));
  const [store]=useState(makeThreadWindowStore);
  const [pets,setPets]=useState<Pet[]>([]);
  const [petError,setPetError]=useState('');
  const workspaces=store(state=>state.workspaces);
  const threads=store(state=>state.history);
  useEffect(()=>{const bridge=window.handAgentSettings;if(!bridge)return;let active=true;const dispose=bridge.onPetsChanged(value=>{if(active)setPets(value);});void bridge.listPets().then(value=>{if(active)setPets(value);}).catch(error=>{if(active)setPetError(error instanceof Error?error.message:'伙伴加载失败');});return()=>{active=false;dispose();};},[]);
  const [connection,setConnection]=useState('disconnected');
  const clientRef=useRef<ThreadSocketClient|null>(null);
  const pending=useRef(new Map<string,{resolve:(notification:ThreadNotification)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>());
  useEffect(()=>{applyThemeToDocument(getInitialTheme());return installThemeSubscription(applyThemeToDocument);},[]);
  useEffect(()=>{const commands=pending.current;const client=new ThreadSocketClient({url:getThreadWebSocketURL(),listWorkspaces:true,onConnectionState:state=>{setConnection(state);if(state==='disconnected'){for(const request of commands.values()){clearTimeout(request.timer);request.reject(new Error('后端连接已断开，请重试'));}commands.clear();}},onRequest:()=>{},onNotification:notification=>{
    store.getState().handleNotification(notification);
    if(!('commandId' in notification)||!notification.commandId)return;
    const request=commands.get(notification.commandId);if(!request)return;
    commands.delete(notification.commandId);clearTimeout(request.timer);
    if(notification.type==='workspace.error'||notification.type==='thread.error')request.reject(new Error(notification.payload.message));else request.resolve(notification);
  }});clientRef.current=client;client.connect();return()=>{client.disconnect();clientRef.current=null;for(const request of commands.values()){clearTimeout(request.timer);request.reject(new Error('设置窗口已关闭'));}commands.clear();};},[store]);
  const command:WorkspaceCommand=(type,payload,commandId=crypto.randomUUID())=>new Promise((resolve,reject)=>{
    if(connection!=='connected'||!clientRef.current){reject(new Error('后端尚未连接'));return;}
    const timer=setTimeout(()=>{pending.current.delete(commandId);reject(new Error('保存回执超时，请重试'));},30000);
    pending.current.set(commandId,{resolve,reject,timer});
    try{clientRef.current.sendRaw(JSON.stringify({type,commandId,timestamp:new Date().toISOString(),payload}));}catch(error){clearTimeout(timer);pending.current.delete(commandId);reject(error);}
  });
  return <main className="settings-app">
    <nav className="settings-nav" aria-label="设置导航">
      <h1>设置</h1>
      <div className="settings-search"><Search size={16} aria-hidden="true"/>
        <input type="search" aria-label="搜索设置" placeholder="搜索设置" value={search} onChange={event=>setSearch(event.target.value)}/>
        {search && <button className="settings-search-clear" aria-label="清除搜索" onClick={()=>setSearch('')}><X size={14}/></button>}
      </div>
      <div className="settings-nav-groups">
        {(['个人','集成','项目'] as const).map(group=>{
          const items=filteredPages.filter(item=>item.group===group);
          return items.length ? <div className="settings-nav-group" key={group}><p>{group}</p>{items.map(({id,label,icon:Icon})=>
            <button key={id} aria-current={page===id?'page':undefined} onClick={()=>setPage(id)}><Icon size={18} aria-hidden="true"/><span>{label}</span></button>
          )}</div> : null;
        })}
        {filteredPages.length===0 && <p className="settings-note" role="status">未找到相关设置</p>}
      </div>
      <div className="settings-nav-footer">Wisp Pocket<span>你的桌面伙伴</span></div>
    </nav>
    <section className="settings-page" aria-label={settingsPages.find(item=>item.id===page)?.label}><div className="settings-page-inner">
      <div hidden={page!=='AI'}><AISettings /></div>
      <div hidden={page!=='Tools'}><ToolsSettings/></div>
      <div hidden={page!=='MCP'}><MCPSettings/></div>
      <div hidden={page!=='Permissions'}><PermissionsSettings/></div>
      <div hidden={page!=='Pets'}><h2>桌面伙伴</h2><p className="settings-page-description">选择陪伴你的桌宠，为它设置角色并安排工作区。</p>{petError&&<p className="settings-error" role="alert">{petError}</p>}<PetManager layout="gallery" pets={pets} workspaces={workspaces} threads={threads} bridge={window.handAgentSettings}/></div>
      <div hidden={page!=='Workspaces'}><WorkspaceManager workspaces={workspaces} threads={threads} bridge={window.handAgentSettings} command={command}/></div>
    </div></section>
  </main>;
}
