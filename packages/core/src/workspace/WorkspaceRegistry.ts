import { mkdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { PetError } from '../pet/Pet.ts';
import type { WorkspaceCreation, WorkspaceStorage } from './Workspace.ts';

export class WorkspaceRegistry {
  private readonly creating = new Map<string, Promise<WorkspaceCreation>>();
  constructor(private readonly storage: WorkspaceStorage) {}
  async list() { return this.storage.listWorkspaces(); }
  async get(id: string) { return this.storage.getWorkspace(id); }
  async create(rootPath: string, commandId?: string) {
    if (!commandId) return this.createNew(rootPath);
    const existing = this.storage.getWorkspaceByCommand(commandId);
    if (existing) return existing;
    const pending = this.creating.get(commandId);
    if (pending) return pending;
    const task = this.createNew(rootPath,commandId);
    this.creating.set(commandId,task);
    try { return await task; }
    finally { if (this.creating.get(commandId) === task) this.creating.delete(commandId); }
  }
  private async createNew(rootPath: string, commandId?: string) {
    if (!isAbsolute(rootPath)) throw new PetError('invalid_input', '项目目录必须是绝对路径');
    let canonical: string;
    try {
      await mkdir(rootPath, { recursive: true });
      canonical = await realpath(rootPath);
      if (!(await stat(canonical)).isDirectory()) throw new Error('不是目录');
    } catch { throw new PetError('invalid_input', '无法使用项目目录'); }
    return this.storage.createWorkspace(canonical, commandId);
  }
}
