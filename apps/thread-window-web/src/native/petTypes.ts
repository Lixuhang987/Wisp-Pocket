/** Electron 前端拥有的伙伴资料；不属于 Conversation Runtime 协议。 */
export type PetImageRef =
  | { type: 'builtin'; id: string }
  | { type: 'imported'; url: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; width: number; height: number };

export type Pet = {
  id: string;
  name: string;
  description: string;
  rolePrompt: string;
  imageRef: PetImageRef;
  revision: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  workspaceId: string | null;
  threadId: string | null;
  visible: boolean;
  size: number;
  position?: { right: number; bottom: number; display?: { id: string; x: number; y: number } };
};

export type SavePetInput = Partial<Pick<Pet, 'name' | 'description' | 'rolePrompt' | 'imageRef' | 'isDefault'>> & {
  id?: string;
  expectedRevision?: number;
};
