import { useState } from 'react';
import type { Workspace } from '@handagent/core/workspace/Workspace.ts';
import type { Pet, PetImageRef } from '../native/petTypes.ts';
import type { PetManagementBridge, PetImageInput } from '../native/settingsBridge.ts';
import type { ThreadListEntry } from '../protocol/threadProtocol.ts';
import { WorkspaceThreadPicker } from './WorkspaceThreadPicker.tsx';
import '../styles/settings.css';

const spriteURL = new URL('../../../electron-shell/src/activity-window/assets/yachiyo.webp', import.meta.url).href;

function PetPortrait({ image }: { image: PetImageRef }) {
  return image.type === 'imported' ? <img className="pet-portrait" alt="" src={image.url}/> :
    <span className="pet-portrait pet-portrait-builtin" aria-hidden="true" style={{backgroundImage:`url(${spriteURL})`}}/>;
}

export function PetManager({ pets, workspaces, threads, bridge, onClose, chooseWorkspace, layout = 'list' }: {
  pets: Pet[];
  workspaces: Workspace[];
  threads: ThreadListEntry[];
  bridge?: PetManagementBridge;
  onClose?: () => void;
  chooseWorkspace?: () => Promise<Workspace | null>;
  layout?: 'list' | 'gallery';
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewPet = pets.find(pet => pet.id === previewId) ?? pets.find(pet => pet.visible) ?? pets[0];
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Pet | null | undefined>();
  const [assigningPetId, setAssigningPetId] = useState<string | null>(null);
  const [name, setName] = useState(''), [description, setDescription] = useState(''), [role, setRole] = useState('');
  const [image, setImage] = useState<PetImageRef>({ type: 'builtin', id: 'yachiyo' });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [commandId, setCommandId] = useState(() => crypto.randomUUID());

  function edit(pet: Pet | null) {
    setEditing(pet); setName(pet?.name ?? ''); setDescription(pet?.description ?? '');
    setRole(pet?.rolePrompt ?? '根据用户交付的材料，清晰、务实地协助完成任务。');
    setImage(pet?.imageRef ?? { type: 'builtin', id: 'yachiyo' }); setError(''); setCommandId(crypto.randomUUID());
  }
  function requireBridge() { if (!bridge) throw new Error('桌宠窗口暂不可用'); return bridge; }
  async function action(operation: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); }
    finally { setBusy(false); }
  }
  function save() { return action(async () => {
    await requireBridge().savePet({ ...(editing ? { id: editing.id, expectedRevision: editing.revision } : {}), name, description, rolePrompt: role, imageRef: image }, commandId);
    setEditing(undefined);
  }); }
  function selectWorkspace(pet: Pet) {
    if (!chooseWorkspace) { setError(''); setAssigningPetId(pet.id); return; }
    void action(async () => {
      const workspace = await chooseWorkspace();
      if (!workspace) return;
      await requireBridge().assignPet({
        petId: pet.id, workspaceId: workspace.id,
        threadId: workspace.id === pet.workspaceId ? pet.threadId : null,
      });
    });
  }
  function importImage(file?: File) { return action(async () => {
    const host = requireBridge();
    let picked: PetImageInput | null;
    if (host.chooseImage) picked = await host.chooseImage();
    else {
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) throw new Error('图片不能超过 20 MiB。');
      const bytesBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('无法读取角色图片')); reader.readAsDataURL(file);
      });
      picked = { name: file.name, mimeType: file.type, bytesBase64 };
    }
    if (picked) setImage(await host.importPetImage(picked));
  }); }
  const filteredPets = pets.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  return <section className={`pet-management ${layout === 'gallery' ? 'pet-gallery' : ''}`} aria-label="伙伴管理">
    {onClose && <header><span>伙伴</span><button onClick={onClose}>关闭</button></header>}
    {editing === undefined ? <>
      {layout === 'gallery' && previewPet && <div className="pet-gallery-preview">
        <span className="pet-preview-label">伙伴预览</span><PetPortrait image={previewPet.imageRef}/>
        <strong>{previewPet.name}</strong><span className="settings-note">{previewPet.visible ? '已显示在桌面' : '暂未显示'}</span>
        <button disabled={busy} onClick={() => edit(previewPet)}>自定义</button>
      </div>}
      <div className="pet-gallery-heading"><h3>我的伙伴 <span>{pets.length}</span></h3><button disabled={busy} onClick={() => edit(null)}>添加桌宠</button></div>
      <div className="settings-actions"><input type="search" aria-label="搜索伙伴" placeholder="搜索伙伴名称" value={search} onChange={e => setSearch(e.target.value)} /></div>
      {assigningPetId && <p className="settings-note">正在为 {pets.find(pet => pet.id === assigningPetId)?.name} 选择工作区</p>}
      {assigningPetId && <WorkspaceThreadPicker key={assigningPetId} workspaces={workspaces} threads={threads} busy={busy} onCancel={() => { setAssigningPetId(null); setError(''); }} onSelect={(workspaceId, threadId) => void action(async () => {
        await requireBridge().assignPet({ petId: assigningPetId, workspaceId, threadId }); setAssigningPetId(null);
      })} />}
      <div className={layout === 'gallery' ? 'pet-gallery-grid' : 'pet-management-list'}>
        {filteredPets.map(p => <article className={`pet-management-row ${previewPet?.id === p.id ? 'is-previewed' : ''}`} key={p.id} aria-label={p.name}>
          {layout === 'gallery' ? <button className="pet-card-preview" aria-label={`预览 ${p.name}`} aria-pressed={previewPet?.id === p.id} onClick={() => setPreviewId(p.id)}>
            <span className="pet-card-status">{p.visible ? '已显示' : '未显示'}</span><PetPortrait image={p.imageRef}/>
            <strong>{p.name}</strong><span className="pet-card-description">{p.description || '准备好陪你开始下一件事。'}</span>
          </button> : <><PetPortrait image={p.imageRef}/><span className="pet-management-name">{p.name}{p.isDefault ? ' · 默认' : ''}</span></>}
          <small className="pet-card-workspace">{workspaces.find(workspace => workspace.id === p.workspaceId)?.name ?? '未分配工作区'}{layout === 'list' ? ` · ${p.visible ? '已显示' : '隐藏库存'}` : ''}</small>
          <div className="pet-card-actions">
            <button disabled={busy} onClick={() => edit(p)}>编辑</button>
            <button disabled={busy} onClick={() => selectWorkspace(p)}>选择工作区</button>
            <button disabled={busy} onClick={() => p.visible ? void action(() => requireBridge().hidePet(p.id)) : chooseWorkspace || !p.workspaceId ? selectWorkspace(p) : void action(() => requireBridge().showPet(p.id))}>{p.visible ? '隐藏' : '显示'}</button>
          </div>
        </article>)}
      </div>
      {filteredPets.length === 0 && <p className="settings-note">{pets.length === 0 ? '暂无伙伴，添加一位桌面伙伴开始。' : '没有找到匹配的伙伴'}</p>}
    </> : <form onSubmit={e => { e.preventDefault(); void save(); }}><fieldset className="settings-form" disabled={busy}>
      <label className="settings-field">名称<input required value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="settings-field">描述<input value={description} onChange={e => setDescription(e.target.value)} /></label>
      <label className="settings-field">角色提示<textarea required value={role} onChange={e => setRole(e.target.value)} /></label>
      <p className="settings-note">新伙伴加入隐藏库存；{chooseWorkspace ? '选择工作区文件夹后即可显示。' : '选择工作区与话题后再显示。'}角色提示只在首次发送新话题时加入普通历史，旧话题不会重新注入。</p>
      <div className="pet-management-preview"><PetPortrait image={image}/>
        <button type="button" onClick={() => setImage({ type: 'builtin', id: 'yachiyo' })}>使用内置形象</button></div>
      {bridge?.chooseImage ? <button type="button" onClick={() => void importImage()}>选择角色图片</button> : <label className="settings-field">角色图片<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void importImage(e.target.files?.[0])} /></label>}
      <div className="settings-actions"><button className="primary" type="submit">{busy ? '正在保存…' : '保存伙伴'}</button><button type="button" onClick={() => { setEditing(undefined); setError(''); }}>取消</button></div>
    </fieldset></form>}
    {error && <p className="settings-error" role="alert">{error}</p>}
  </section>;
}
