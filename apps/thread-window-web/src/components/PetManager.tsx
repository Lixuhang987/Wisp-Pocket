import { useEffect, useState } from 'react';
import type { Pet, PetImageRef } from '@handagent/core/pet/Pet.ts';
import type { ThreadNotification } from '../protocol/threadProtocol.ts';
import type { PetManagementBridge } from '../native/settingsBridge.ts';
import { attachmentUrl } from '../thread/attachmentUrl.ts';
import '../styles/settings.css';

export type PetCommand = (type:string,payload:unknown,commandId?:string)=>Promise<ThreadNotification>;
export function PetManager({pets,command,threadURL,bridge,onClose}:{pets:Pet[];command:PetCommand;threadURL:string;bridge?:PetManagementBridge;onClose?:()=>void}) {
  const [search,setSearch]=useState('');
  const [editing,setEditing]=useState<Pet|null|undefined>();
  const [name,setName]=useState(''),[description,setDescription]=useState(''),[role,setRole]=useState(''),[root,setRoot]=useState('');
  const [image,setImage]=useState<PetImageRef>({type:'builtin',id:'yachiyo'});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [visibility,setVisibility]=useState<Record<string,boolean>>({});
  const [commandId,setCommandId]=useState(()=>crypto.randomUUID());
  useEffect(()=>{let active=true;const refresh=()=>{void bridge?.getPetVisibility?.().then(value=>{if(active)setVisibility(value);}).catch(()=>{});};refresh();window.addEventListener('focus',refresh);return()=>{active=false;window.removeEventListener('focus',refresh);};},[bridge,pets]);
  function edit(pet:Pet|null) {setEditing(pet);setName(pet?.name??'');setDescription(pet?.description??'');setRole(pet?.rolePrompt??'根据用户交付的材料，清晰、务实地协助完成任务。');setRoot(pet?.rootPath??'');setImage(pet?.imageRef??{type:'builtin',id:'yachiyo'});setError('');setCommandId(crypto.randomUUID());}
  async function action(operation:()=>Promise<unknown>) {setError('');try{await operation();}catch(e){setError(e instanceof Error?e.message:'操作失败');}}
  async function save() {setBusy(true);setError('');try {
    await command(editing?'pet.update':'pet.create',editing?{id:editing.id,expectedRevision:editing.revision,patch:{name,description,rolePrompt:role,imageRef:image}}:{name,description,rolePrompt:role,rootPath:root,imageRef:image},commandId);
    setEditing(undefined);
  }catch(e){setError(e instanceof Error?e.message:'伙伴保存失败');}finally{setBusy(false);}}
  async function importImage(file?:File) {setBusy(true);setError('');try {
    let picked:{mimeType:string;bytesBase64:string}|null;
    if (bridge?.chooseImage) picked=await bridge.chooseImage();
    else {if(!file)return;if(file.size>20*1024*1024)throw new Error('图片不能超过 20 MiB。');const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('无法读取角色图片'));reader.readAsDataURL(file);});picked={mimeType:file.type,bytesBase64:data};}
    if(!picked)return;const result=await command('pet.image.import',{mimeType:picked.mimeType,base64:picked.bytesBase64});if(result.type==='pet.image.imported')setImage(result.payload.imageRef);
  }catch(e){setError(e instanceof Error?e.message:'图片导入失败');}finally{setBusy(false);}}
  async function setVisible(petId:string,visible:boolean) {await action(async()=>{if(!bridge)throw new Error('桌宠窗口暂不可用');await (visible?bridge.showPet(petId):bridge.hidePet(petId));setVisibility(current=>({...current,[petId]:visible}));});}
  return <section className="pet-management" aria-label="伙伴管理"><header><span>伙伴</span>{onClose&&<button onClick={onClose}>关闭</button>}</header>
    {editing===undefined?<><div className="settings-actions"><input aria-label="搜索伙伴" placeholder="搜索名称" value={search} onChange={e=>setSearch(e.target.value)}/><button className="primary" onClick={()=>edit(null)}>添加桌宠</button></div>
      {pets.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).map(p=><div className="pet-management-row" key={p.id}>
        {p.imageRef.type==='imported'?<img alt="" src={attachmentUrl({...p.imageRef,type:'image',id:p.id},threadURL)}/>:<span aria-hidden>✦</span>}
        <span className="pet-management-name">{p.name}{p.isDefault?' · 默认':''}<small>{p.description||p.rootPath}</small></span><button onClick={()=>edit(p)}>编辑</button>
        <button onClick={()=>void setVisible(p.id,visibility[p.id]!==true)}>{visibility[p.id]?'隐藏':'显示'}</button>
        {!p.isDefault&&<button onClick={()=>void action(()=>command('pet.update',{id:p.id,expectedRevision:p.revision,patch:{isDefault:true}}))}>设为默认</button>}
      </div>)}{pets.length===0&&<p className="settings-note">暂无伙伴</p>}</>:<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset className="settings-form" disabled={busy}>
      <label className="settings-field">名称<input required value={name} onChange={e=>setName(e.target.value)}/></label>
      <label className="settings-field">描述<input value={description} onChange={e=>setDescription(e.target.value)}/></label>
      <label className="settings-field">角色提示<textarea required value={role} onChange={e=>setRole(e.target.value)}/></label>
      <label className="settings-field">项目目录<input required readOnly={!!editing} value={root} placeholder="本地绝对目录" onChange={e=>setRoot(e.target.value)}/></label>
      {!editing&&bridge?.chooseDirectory&&<button type="button" onClick={()=>void action(async()=>{const path=await bridge.chooseDirectory!();if(path)setRoot(path);})}>选择项目目录</button>}
      <p className="settings-note">项目目录和伙伴归属创建后固定。新项目会同时添加一只基础伙伴；已有项目复用目录。共用项目共享文件，各自聊天独立。</p>
      <div className="pet-management-preview">{image.type==='imported'?<img alt="角色预览" src={attachmentUrl({...image,type:'image',id:'preview'},threadURL)}/>:<span>✦ 内置形象</span>}
        <button type="button" disabled={busy} onClick={()=>setImage({type:'builtin',id:'yachiyo'})}>使用内置形象</button></div>
      {bridge?.chooseImage?<button type="button" disabled={busy} onClick={()=>void importImage()}>选择角色图片</button>:<label className="settings-field">角色图片<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>void importImage(e.target.files?.[0])}/></label>}
      {editing&&<p className="settings-note">名称和图片更新；角色提示仅用于新对话。</p>}
      <div className="settings-actions"><button className="primary" type="submit" disabled={busy}>{busy?'正在保存…':'保存伙伴'}</button><button type="button" disabled={busy} onClick={()=>setEditing(undefined)}>取消</button></div>
    </fieldset></form>}{error&&<p className="settings-error" role="alert">{error}</p>}
  </section>;
}
