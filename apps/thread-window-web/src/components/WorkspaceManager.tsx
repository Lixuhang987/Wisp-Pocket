import { useState } from 'react';
import type { Workspace } from '@handagent/core/workspace/Workspace.ts';
import type { PetManagementBridge } from '../native/settingsBridge.ts';
import type { ThreadListEntry, ThreadNotification } from '../protocol/threadProtocol.ts';

export type WorkspaceCommand = (type: string, payload: unknown, commandId?: string) => Promise<ThreadNotification>;
export function WorkspaceManager({ workspaces, threads, bridge, command }: {
  workspaces: Workspace[];
  threads: ThreadListEntry[];
  bridge?: PetManagementBridge;
  command: WorkspaceCommand;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  async function action(operation: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); }
    finally { setBusy(false); }
  }
  function host() { if (!bridge) throw new Error('桌宠窗口暂不可用'); return bridge; }
  return <section aria-label="工作区管理"><h2>工作区</h2>
    <p className="settings-page-description">同一实际目录只有一个工作区。话题按项目保存，召唤伙伴只安排前端接续。</p>
    <button className="primary" disabled={busy} onClick={() => void action(async () => {
      const picker = host().chooseDirectory;
      if (!picker) throw new Error('目录选择暂不可用');
      const rootPath = await picker();
      if (rootPath) await command('workspace.create', { rootPath });
    })}>添加工作区</button>
    {workspaces.map(workspace => <section key={workspace.id} className="settings-workspace">
      <div className="settings-workspace-header"><button className="settings-workspace-title" aria-expanded={expanded === workspace.id} onClick={() => setExpanded(expanded === workspace.id ? null : workspace.id)}>{workspace.name}<small>{workspace.rootPath}</small></button>
        <button disabled={busy} onClick={() => void action(() => host().summonPet(workspace.id))}>召唤桌宠</button>
        <button disabled={busy} onClick={() => void action(() => host().openWorkspaceThread(workspace.id, null))}>新建话题</button></div>
      {expanded === workspace.id && <div className="settings-workspace-history">{threads.filter(thread => thread.workspaceId === workspace.id).map(thread => <button disabled={busy} key={thread.id} onClick={() => void action(() => host().openWorkspaceThread(workspace.id, thread.id))}>{thread.preview || '未命名话题'}{thread.status === 'running' ? ' · 运行中' : ''}</button>)}
        {!threads.some(thread => thread.workspaceId === workspace.id) && <p className="settings-note">暂无历史话题，首次发送才创建新话题。</p>}
      </div>}
    </section>)}
    {workspaces.length === 0 && <p className="settings-note">暂无工作区，选择本地目录开始。</p>}
    {error && <p className="settings-error" role="alert">{error}</p>}
  </section>;
}
