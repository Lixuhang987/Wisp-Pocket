import { useState } from "react";
import type { Pet, PetImageRef } from "@handagent/core/pet/Pet.ts";
import { attachmentUrl } from "../../../thread-window-web/src/thread/attachmentUrl.ts";
import { PetSprite } from "./PetSprite.tsx";
import type { PetThreadController } from "./petThreadController.ts";

export function PetManager({controller,threadURL,onClose}:{controller:PetThreadController;threadURL:string;onClose():void}) {
  const [search,setSearch]=useState("");
  const [editing,setEditing]=useState<Pet|null|undefined>();
  const [name,setName]=useState(""),[role,setRole]=useState(""),[root,setRoot]=useState("");
  const [image,setImage]=useState<PetImageRef>({type:"builtin",id:"yachiyo"});
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const [commandId,setCommandId]=useState(()=>crypto.randomUUID());
  const pets=controller.store.getState().pets;
  function edit(pet:Pet|null) { setEditing(pet);setName(pet?.name??"");setRole(pet?.rolePrompt??"根据用户交付的材料，清晰、务实地协助完成任务。");setRoot(pet?.rootPath??"");setImage(pet?.imageRef??{type:"builtin",id:"yachiyo"});setError("");setCommandId(crypto.randomUUID()); }
  async function save() { setBusy(true);setError("");try {
    const payload=editing ? {id:editing.id,expectedRevision:editing.revision,patch:{name,rolePrompt:role,imageRef:image}} : {name,rolePrompt:role,rootPath:root,imageRef:image};
    await controller.command(editing?"pet.update":"pet.create",payload,commandId);setEditing(undefined);
  } catch(e){setError(String(e));}finally{setBusy(false);} }
  async function importImage(file?:File) {if(!file)return;setBusy(true);setError("");try{
    if(file.size>20*1024*1024)throw new Error("图片不能超过 20 MiB。");
    const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(new Error("无法读取角色图片"));reader.readAsDataURL(file);});
    const result=await controller.command("pet.image.import",{mimeType:file.type,base64});if(result.type==="pet.image.imported")setImage(result.payload.imageRef);
  }catch(e){setError(String(e));}finally{setBusy(false);} }
  return <section className="pet-popover pet-manager" data-pet-interactive aria-label="伙伴管理">
    <header><span>伙伴</span><button onClick={onClose}>关闭</button></header>
    {editing===undefined ? <><input aria-label="搜索伙伴" placeholder="搜索名称" value={search} onChange={e=>setSearch(e.target.value)}/><button onClick={()=>edit(null)}>添加桌宠</button>
      {pets.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).map(p=><div className="pet-manager-row" key={p.id}>
        {p.imageRef.type==="imported" ? <img alt="" src={attachmentUrl({...p.imageRef,type:"image",id:p.id},threadURL)}/> : <span>✦</span>}
        <span>{p.name}<small>{p.id.slice(-6)}{p.isDefault?" · 默认":""}</small></span>
        <button onClick={()=>edit(p)}>编辑</button><button onClick={()=>void window.handAgentPet?.showPet(p.id).catch(e=>setError(String(e)))}>显示</button>
        {!p.isDefault&&<button onClick={()=>void controller.command("pet.update",{id:p.id,expectedRevision:p.revision,patch:{isDefault:true}}).catch(e=>setError(String(e)))}>设为默认</button>}
      </div>)}</> : <form onSubmit={e=>{e.preventDefault();void save();}}>
      <label>名称<input required value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>角色提示<textarea required value={role} onChange={e=>setRole(e.target.value)}/></label>
      <label>文件目录<input required readOnly={!!editing} value={root} placeholder="本地绝对目录" onChange={e=>setRoot(e.target.value)}/></label>
      <p>文件目录创建后固定。共用目录共享文件，各自聊天仍独立。</p>
      <div className="pet-image-preview">{image.type==="imported" ? <img alt="角色预览" src={attachmentUrl({...image,type:"image",id:"preview"},threadURL)}/> : <PetSprite state="idle" scale={0.3}/>}</div>
      <label>角色图片<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>void importImage(e.target.files?.[0])}/></label>
      <button type="button" onClick={()=>setImage({type:"builtin",id:"yachiyo"})}>使用内置形象</button>
      {editing&&<p>名字与图片立即更新；角色提示仅用于新对话。</p>}
      <button type="submit" disabled={busy}>{busy?"正在保存…":"保存"}</button><button type="button" onClick={()=>setEditing(undefined)}>取消</button>
    </form>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
