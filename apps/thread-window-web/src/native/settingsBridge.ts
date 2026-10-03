export type PetManagementBridge = {
  chooseDirectory?(): Promise<string | null>;
  chooseImage?(): Promise<{name:string;mimeType:string;bytesBase64:string} | null>;
  showPet(petId:string): Promise<void>;
  hidePet(petId:string): Promise<void>;
  getPetVisibility?(): Promise<Record<string,boolean>>;
};
declare global { interface Window { handAgentSettings?: PetManagementBridge; } }
