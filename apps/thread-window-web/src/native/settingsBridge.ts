import type { Pet, PetImageRef, SavePetInput } from './petTypes.ts';

export type PetImageInput = { name: string; mimeType: string; bytesBase64: string };
export type PetManagementBridge = {
  chooseDirectory?(): Promise<string | null>;
  chooseImage?(): Promise<PetImageInput | null>;
  listPets(): Promise<Pet[]>;
  savePet(input: SavePetInput, commandId?: string): Promise<Pet>;
  onPetsChanged(handler: (pets: Pet[]) => void): () => void;
  assignPet(input: { petId: string; workspaceId: string; threadId: string | null; activate?: boolean; expected?: { workspaceId: string | null; threadId: string | null } }): Promise<void>;
  openWorkspaceThread(workspaceId: string, threadId: string | null): Promise<void>;
  summonPet(workspaceId: string): Promise<void>;
  importPetImage(image: PetImageInput): Promise<PetImageRef>;
  setPetSize(petId: string, size: number): Promise<void>;
  showPet(petId: string): Promise<void>;
  hidePet(petId: string): Promise<void>;
  getPetVisibility?(): Promise<Record<string, boolean>>;
};
declare global { interface Window { handAgentSettings?: PetManagementBridge; } }
