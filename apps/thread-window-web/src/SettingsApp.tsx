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

export function SettingsApp() {
  const [page,setPage]=useState<'AI'|'Agent'|'Pets'|'Workspaces'>('AI');
  const [agentPage,setAgentPage]=useState<'Tools'|'MCP'|'Permissions'>('Tools');
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
  return <main className="settings-app"><nav className="settings-nav" aria-label="设置导航"><h1>设置</h1>{(['AI','Agent','Pets','Workspaces'] as const).map(item=><button key={item} aria-current={page===item?'page':undefined} onClick={()=>setPage(item)}>{item}</button>)}</nav><section className="settings-page"><div className="settings-page-inner">
    <div hidden={page!=='AI'}><AISettings /></div>
    <div hidden={page!=='Agent'}><div className="settings-tabs" role="tablist" aria-label="Agent 设置">{(['Tools','MCP','Permissions'] as const).map(item=><button role="tab" key={item} aria-selected={agentPage===item} onClick={()=>setAgentPage(item)}>{item}</button>)}</div><div hidden={agentPage!=='Tools'}><ToolsSettings/></div><div hidden={agentPage!=='MCP'}><MCPSettings/></div><div hidden={agentPage!=='Permissions'}><PermissionsSettings/></div></div>
    <div hidden={page!=='Pets'}><h2>Pets</h2>{petError&&<p className="settings-error" role="alert">{petError}</p>}<PetManager pets={pets} workspaces={workspaces} threads={threads} bridge={window.handAgentSettings}/></div>
    <div hidden={page!=='Workspaces'}><WorkspaceManager workspaces={workspaces} threads={threads} bridge={window.handAgentSettings} command={command}/></div>
  </div></section></main>;
}
