export type PetImageRef = { type: 'builtin'; id: 'yachiyo' } | {
  type: 'imported'; blobId: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; width: number; height: number;
};
export type Pet = {
  id: string; name: string; description: string; rolePrompt: string; revision: number;
  imageRef: PetImageRef; workspaceId: string; rootPath: string; isDefault: boolean; createdAt: string; updatedAt: string;
};
export type PetSnapshot = Pick<Pet, 'revision' | 'name' | 'rolePrompt'> & { petId: string };
export type PetCreateInput = Pick<Pet, 'name' | 'rolePrompt' | 'imageRef' | 'rootPath'> & {description?: string; isDefault?: boolean};
export type PetPatch = Partial<Pick<Pet, 'name' | 'description' | 'rolePrompt' | 'imageRef' | 'isDefault'>>;
export type PetErrorCode = 'invalid_input' | 'not_found' | 'conflict' | 'storage_failed';
export class PetError extends Error {
  constructor(readonly code: PetErrorCode, message: string, readonly currentRevision?: number) { super(message); }
}
export interface PetStorage {
  listPets(): Pet[];
  getPet(id: string): Pet | null;
  getPetByCommand(commandId: string): Pet | null;
  createPet(input: PetCreateInput & {workspaceId?: string}, commandId?: string): Pet;
  updatePet(id: string, expectedRevision: number, patch: PetPatch): Pet;
  savePetImage(image: Extract<PetImageRef, {type:'imported'}>): void;
  getPetImage(blobId: string): Extract<PetImageRef, {type:'imported'}> | null;
}

export const BASE_PET_PROFILE = {
  name: '八千代',
  description: '项目基础伙伴',
  rolePrompt: '你是用户的桌面助手，根据用户的实际任务提供清晰、可靠的帮助。',
  imageRef: {type:'builtin',id:'yachiyo'} as const,
};
