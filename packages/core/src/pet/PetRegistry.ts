import { WorkspaceRegistry } from '../workspace/WorkspaceRegistry.ts';
import type { WorkspaceStorage } from '../workspace/Workspace.ts';
import { PetError, type Pet, type PetCreateInput, type PetPatch, type PetStorage, type PetImageRef } from './Pet.ts';
export class PetRegistry {
  private readonly creating = new Map<string,Promise<Pet>>();
  readonly workspaces: WorkspaceRegistry;
  constructor(private readonly storage: PetStorage & WorkspaceStorage) { this.workspaces = new WorkspaceRegistry(storage); }
  async list() { return this.storage.listPets(); }
  async get(id: string) { return this.storage.getPet(id); }
  async ensureDefault(rootPath: string) {
    const existing = this.storage.listPets().find(p => p.isDefault);
    if (existing) return existing;
    return (await this.workspaces.create(rootPath, 'builtin-default-workspace')).basePet;
  }
  async create(input: PetCreateInput, commandId?: string) {
    if (!commandId) return this.createNew(input);
    const existing = this.storage.getPetByCommand(commandId);
    if (existing) return existing;
    const pending = this.creating.get(commandId);
    if (pending) return pending;
    const task = this.createNew(input,commandId);
    this.creating.set(commandId,task);
    try { return await task; }
    finally { if (this.creating.get(commandId) === task) this.creating.delete(commandId); }
  }
  private async createNew(input: PetCreateInput, commandId?: string) {
    this.validate(input);
    const {workspace} = await this.workspaces.create(input.rootPath);
    return this.storage.createPet({...input,name:input.name.trim(),rolePrompt:input.rolePrompt.trim(),description:input.description?.trim() ?? '',rootPath:workspace.rootPath,workspaceId:workspace.id},commandId);
  }
  async update(id: string, expectedRevision: number, patch: PetPatch) {
    if (Object.keys(patch).some(k => !['name','description','rolePrompt','imageRef','isDefault'].includes(k))) throw new PetError('invalid_input','桌宠文件根和身份创建后不可修改');
    this.validate(patch);
    return this.storage.updatePet(id,expectedRevision,{...patch,...(patch.name !== undefined ? {name:patch.name.trim()} : {}),...(patch.rolePrompt !== undefined ? {rolePrompt:patch.rolePrompt.trim()} : {})});
  }
  saveImage(image: Extract<PetImageRef,{type:'imported'}>) { this.storage.savePetImage(image); }
  private matchesImage(image: Extract<PetImageRef,{type:"imported"}>) {
    const saved=this.storage.getPetImage(image.blobId);
    return saved && saved.mimeType===image.mimeType && saved.width===image.width && saved.height===image.height;
  }
  private validate(input: Partial<PetCreateInput>) {
    for (const key of ['name','rolePrompt'] as const) if (input[key] !== undefined && !input[key]!.trim()) throw new PetError('invalid_input',`${key} 不能为空`);
    const image = input.imageRef;
    if (image && !(image.type === 'builtin' && image.id === 'yachiyo') && !(image.type === 'imported' && this.matchesImage(image))) throw new PetError('invalid_input','图片必须先成功导入');
  }
}
