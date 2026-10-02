import { mkdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { PetError, type PetCreateInput, type PetPatch, type PetStorage, type PetImageRef } from './Pet.ts';
export class PetRegistry {
  constructor(private readonly storage: PetStorage) {}
  async list() { return this.storage.listPets(); }
  async get(id: string) { return this.storage.getPet(id); }
  async ensureDefault(rootPath: string) {
    const existing = this.storage.listPets().find(p => p.isDefault);
    if (existing) return existing;
    return this.create({name:'八千代', description:'默认桌宠', rolePrompt:'你是用户的桌面助手，根据用户的实际任务提供清晰、可靠的帮助。', imageRef:{type:'builtin', id:'yachiyo'},rootPath,isDefault:true}, 'builtin-default-pet');
  }
  async create(input: PetCreateInput, commandId?: string) {
    this.validate(input);
    if (!isAbsolute(input.rootPath)) throw new PetError('invalid_input','文件根必须是绝对目录');
    let rootPath: string;
    try { await mkdir(input.rootPath,{recursive:true}); rootPath = await realpath(input.rootPath); if (!(await stat(rootPath)).isDirectory()) throw new Error('不是目录'); }
    catch (error) { throw new PetError('invalid_input',`无法使用文件根：${error instanceof Error ? error.message : error}`); }
    return this.storage.createPet({...input,name:input.name.trim(),rolePrompt:input.rolePrompt.trim(),description:input.description?.trim() ?? '',rootPath},commandId);
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
