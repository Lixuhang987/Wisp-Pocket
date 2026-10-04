import { useState } from 'react';
import type { Workspace } from '@handagent/core/workspace/Workspace.ts';
import type { ThreadListEntry } from '../protocol/threadProtocol.ts';

/** 两级选择只提交最后的确定操作；浏览与取消不修改伙伴。 */
export function WorkspaceThreadPicker({ workspaces, threads, busy, onSelect, onCancel }: {
  workspaces: Workspace[];
  threads: ThreadListEntry[];
  busy: boolean;
  onSelect(workspaceId: string, threadId: string | null): void;
  onCancel(): void;
}) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const workspace = workspaces.find(item => item.id === workspaceId);
  return <section className="settings-selection" aria-label="选择工作区与话题" onKeyDown={event => { if (event.key === 'Escape' && !busy) onCancel(); }}>
    <header><h3>{workspace ? `${workspace.name} · 选择话题` : '选择工作区'}</h3><button type="button" disabled={busy} onClick={onCancel}>取消</button></header>
    <fieldset disabled={busy}>
      {workspace ? <>
        <button type="button" onClick={() => setWorkspaceId(null)}>返回工作区</button>
        <button type="button" className="primary" onClick={() => onSelect(workspace.id, null)}>新建话题</button>
        {threads.filter(thread => thread.workspaceId === workspace.id).map(thread => <button type="button" key={thread.id} onClick={() => onSelect(workspace.id, thread.id)}>{thread.preview || '未命名话题'}</button>)}
        {!threads.some(thread => thread.workspaceId === workspace.id) && <p className="settings-note">暂无历史话题，首次发送才创建新话题。</p>}
      </> : workspaces.map(item => <button type="button" key={item.id} onClick={() => setWorkspaceId(item.id)}>{item.name}</button>)}
      {workspaces.length === 0 && <p className="settings-note">请先在 Workspaces 中添加项目。</p>}
    </fieldset>
  </section>;
}
