import { useEffect, useState } from 'react';
import type { ModelSettings } from '@handagent/core/config/ModelSettings.ts';
import type { MCPConfig, MCPServerConfig } from '@handagent/core/mcp/MCPConfig.ts';
import { getThreadWebSocketURL } from '../native/nativeConfig.ts';

export async function settingsRequest<T>(path:string,method='GET',body?:unknown):Promise<T> {
  const url=new URL(getThreadWebSocketURL());url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname=`/api/settings/${path}`;url.search='';
  const response=await fetch(url,{method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const result=await response.json();if(!response.ok)throw new Error(typeof result.error==='string'?result.error:'配置操作失败');return result as T;
}
function errorText(error:unknown) {return error instanceof Error?error.message:'配置操作失败';}
export function AISettings() {
  const [draft,setDraft]=useState<ModelSettings|null>(null),[error,setError]=useState(''),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;void settingsRequest<ModelSettings>('model').then(value=>{if(active)setDraft(value);}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[]);
  function update(key:keyof ModelSettings,value:string){setDraft(current=>current?{...current,[key]:value}:current);setSaved(false);}
  async function save(){if(!draft)return;setBusy(true);setSaved(false);setError('');try{setDraft(await settingsRequest<ModelSettings>('model','PUT',{provider:draft.provider,model:draft.model,api:draft.api,baseUrl:draft.baseUrl??'',apiKey:draft.apiKey??''}));setSaved(true);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
  return <><h2>模型服务</h2><p className="settings-page-description">连接你使用的模型，让伙伴按你的偏好工作。</p>{draft?<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset className="settings-form settings-model-form" disabled={busy}>
    <label className="settings-field">Provider<select value={draft.provider} onChange={e=>update('provider',e.target.value)}><option value="openai-compatible">OpenAI Compatible</option><option value="anthropic">Anthropic</option></select></label>
    <label className="settings-field">模型<input required value={draft.model} onChange={e=>update('model',e.target.value)}/></label>
    <label className="settings-field">接口<select value={draft.api} onChange={e=>update('api',e.target.value)}><option value="responses">Responses</option><option value="chat">Chat</option><option value="completion">Completion</option></select></label>
    <label className="settings-field">Base URL<input value={draft.baseUrl??''} onChange={e=>update('baseUrl',e.target.value)}/></label>
    <label className="settings-field">API Key<input type="password" autoComplete="off" value={draft.apiKey??''} onChange={e=>update('apiKey',e.target.value)}/></label>
    <div className="settings-actions"><button className="primary" disabled={busy} type="submit">{busy?'正在保存…':'保存模型'}</button></div>
  </fieldset></form>:!error&&<p className="settings-note">正在读取配置…</p>}{error&&<p role="alert" className="settings-error">{error}</p>}{saved&&<p role="status" className="settings-success">模型配置已保存</p>}</>;
}

type ToolList={tools:Array<{name:string;title:string;enabled:boolean}>};
export function ToolsSettings(){const [list,setList]=useState<ToolList>({tools:[]}),[error,setError]=useState(''),[busy,setBusy]=useState('');
 useEffect(()=>{let active=true;void settingsRequest<ToolList>('tools').then(value=>{if(active)setList(value);}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[]);
 async function toggle(name:string,enabled:boolean){setBusy(name);setError('');try{setList(await settingsRequest<ToolList>('tools','PUT',{name,enabled}));}catch(e){setError(errorText(e));}finally{setBusy('');}}
 return <><h2>内置工具</h2><p className="settings-page-description">文件与历史读取默认开放。内置工具开关即时保存。</p>{list.tools.map(tool=><label className="settings-row" key={tool.name}><span>{tool.title}<small>{tool.name}</small></span><input aria-label={tool.title} type="checkbox" checked={tool.enabled} disabled={busy!==''} onChange={e=>void toggle(tool.name,e.target.checked)}/></label>)}{error&&<p role="alert" className="settings-error">{error}</p>}</>;
}
type Rules={rules:Array<{toolName:string;decision:'allow'|'deny';createdAt:string|number}>};
export function PermissionsSettings(){const [list,setList]=useState<Rules>({rules:[]}),[error,setError]=useState('');
 useEffect(()=>{let active=true;void settingsRequest<Rules>('permissions').then(value=>{if(active)setList(value);}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[]);
 async function revoke(name:string){setError('');try{setList(await settingsRequest<Rules>(`permissions/${encodeURIComponent(name)}`,'DELETE'));}catch(e){setError(errorText(e));}}
 return <><h2>权限</h2><p className="settings-page-description">永久规则按工具名称在所有伙伴间生效；撤销后按原权限策略处理。</p>{list.rules.length===0&&<p className="settings-note">暂无永久规则</p>}{list.rules.map(rule=><div className="settings-row" key={rule.toolName}><span>{rule.toolName}<small>{rule.decision==='allow'?'永久允许':'永久拒绝'} · {new Date(rule.createdAt).toLocaleString()}</small></span><button onClick={()=>void revoke(rule.toolName)}>撤销</button></div>)}{error&&<p role="alert" className="settings-error">{error}</p>}</>;
}

type ServerDraft={id:string;title:string;transport:'stdio'|'streamableHttp';command:string;args:string;env:string;cwd:string;timeout:string;autoAccept:boolean;url:string;headers:string};
function serverDraft(server?:MCPServerConfig):ServerDraft{return {id:server?.id??'',title:server?.title??'',transport:server?.transport??'stdio',command:server?.transport==='stdio'?server.command:'',args:server?.transport==='stdio'?JSON.stringify(server.args??[]):'[]',env:server?.transport==='stdio'?JSON.stringify(server.env??{},null,2):'{}',cwd:server?.transport==='stdio'?server.cwd??'':'',timeout:server?.transport==='stdio'?String(server.requestTimeoutMs??''):'',autoAccept:server?.transport==='stdio'?server.elicitation?.autoAcceptEmptyForm??false:false,url:server?.transport==='streamableHttp'?server.url:'',headers:server?.transport==='streamableHttp'?JSON.stringify(server.headers??{},null,2):'{}'};}
function stringRecord(raw:string){const value:unknown=JSON.parse(raw);if(typeof value!=='object'||value===null||Array.isArray(value)||!Object.values(value).every(item=>typeof item==='string'))throw new Error('请输入字符串键值对象');return value as Record<string,string>;}
const exampleServers:MCPServerConfig[]=[
 {id:'filesystem',title:'Filesystem',transport:'stdio',command:'npx',args:['--yes','@modelcontextprotocol/server-filesystem','/tmp/handagent-mcp-example'],requestTimeoutMs:60000},
 {id:'computer_use',title:'Computer Use',transport:'stdio',command:'computer-use',args:[],requestTimeoutMs:60000,elicitation:{autoAcceptEmptyForm:true}},
];
export function MCPSettings(){const [config,setConfig]=useState<MCPConfig|null>(null),[draft,setDraft]=useState<ServerDraft|null>(null),[editing,setEditing]=useState<number|null>(null),[error,setError]=useState(''),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;void settingsRequest<MCPConfig>('mcp').then(value=>{if(active)setConfig(value);}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[]);
 function field(key:keyof ServerDraft,value:string|boolean){setDraft(current=>current?{...current,[key]:value}:current);setSaved(false);}
 function applyDraft(){if(!draft||!config)return;try{let server:MCPServerConfig;if(draft.transport==='stdio'){const args:unknown=JSON.parse(draft.args);if(!Array.isArray(args)||!args.every(item=>typeof item==='string'))throw new Error('Args 请输入字符串数组');const timeout=draft.timeout?Number(draft.timeout):undefined;if(timeout!==undefined&&(!Number.isInteger(timeout)||timeout<=0))throw new Error('Timeout 请输入正整数');server={id:draft.id,title:draft.title,transport:'stdio',command:draft.command,args,env:stringRecord(draft.env),...(draft.cwd?{cwd:draft.cwd}:{}),...(timeout?{requestTimeoutMs:timeout}:{}),elicitation:{autoAcceptEmptyForm:draft.autoAccept}};}else server={id:draft.id,title:draft.title,transport:'streamableHttp',url:draft.url,headers:stringRecord(draft.headers)};setConfig({...config,servers:editing===null?[...config.servers,server]:config.servers.map((item,index)=>index===editing?server:item)});setDraft(null);setSaved(false);setError('');}catch(e){setError(errorText(e));}}
 async function save(){if(!config)return;setBusy(true);setError('');setSaved(false);try{await settingsRequest('mcp','PUT',config);setSaved(true);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 return <><h2>MCP 服务器</h2><p className="settings-page-description">配置在服务启动时读取；保存后重启 App 生效。</p>{config&&<>{config.servers.map((server,index)=><div className="settings-row" key={`${server.id}-${index}`}><span>{server.title}<small>{server.id} · {server.transport}</small></span><button disabled={busy||draft!==null} onClick={()=>{setDraft(serverDraft(server));setEditing(index);setError('');}}>编辑</button><button disabled={busy||draft!==null} onClick={()=>{setConfig({...config,servers:config.servers.filter((_,i)=>i!==index)});setSaved(false);}}>删除</button></div>)}{config.servers.length===0&&<p className="settings-note">暂无 MCP Server</p>}
 <div className="settings-actions"><button disabled={busy||draft!==null} onClick={()=>{setDraft(serverDraft());setEditing(null);setError('');}}>新增 MCP Server</button><button disabled={busy||draft!==null} onClick={()=>{setConfig({...config,servers:[...config.servers,...exampleServers.filter(example=>!config.servers.some(server=>server.id===example.id))]});setSaved(false);}}>添加示例</button></div>
 {draft&&<form className="settings-form" onSubmit={e=>{e.preventDefault();applyDraft();}}><label className="settings-field">Transport<select value={draft.transport} onChange={e=>field('transport',e.target.value)}><option value="stdio">stdio</option><option value="streamableHttp">streamableHttp</option></select></label>
 {(['id','title'] as const).map(key=><label className="settings-field" key={key}>{key==='id'?'Server ID':'标题'}<input required value={draft[key]} onChange={e=>field(key,e.target.value)}/></label>)}
 {draft.transport==='stdio'?<>{(['command','args','cwd','timeout'] as const).map(key=><label className="settings-field" key={key}>{({command:'Command',args:'Args（JSON 数组）',cwd:'CWD',timeout:'Timeout（ms）'})[key]}<input required={key==='command'} value={draft[key]} onChange={e=>field(key,e.target.value)}/></label>)}<label className="settings-field">Env（JSON 对象）<textarea value={draft.env} onChange={e=>field('env',e.target.value)}/></label><label><input type="checkbox" checked={draft.autoAccept} onChange={e=>field('autoAccept',e.target.checked)}/> autoAcceptEmptyForm</label></>:<><label className="settings-field">URL<input required value={draft.url} onChange={e=>field('url',e.target.value)}/></label><label className="settings-field">Headers（JSON 对象）<textarea value={draft.headers} onChange={e=>field('headers',e.target.value)}/></label></>}
 <div className="settings-actions"><button type="submit">加入待保存配置</button><button type="button" onClick={()=>setDraft(null)}>取消编辑</button></div></form>}
 <div className="settings-actions"><button className="primary" disabled={busy||draft!==null} onClick={()=>void save()}>{busy?'正在保存…':'保存 MCP 配置'}</button></div></>}{error&&<p className="settings-error" role="alert">{error}</p>}{saved&&<p className="settings-success" role="status">MCP 配置已保存，重启 App 后生效</p>}</>;
}
