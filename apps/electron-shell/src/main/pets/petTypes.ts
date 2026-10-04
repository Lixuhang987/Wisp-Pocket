import type { PetPosition } from "../windows/petPositionStore.js";

export type PetImageRef = {type:"builtin";id:string} | {
  type:"imported";url:string;mimeType:"image/png"|"image/jpeg"|"image/webp";width:number;height:number;
};
export type Pet = {
  id:string;name:string;description:string;rolePrompt:string;revision:number;
  imageRef:PetImageRef;isDefault:boolean;createdAt:string;updatedAt:string;
  workspaceId:string|null;threadId:string|null;visible:boolean;size:number;position?:PetPosition;
};
export type SavePetInput = Partial<Pick<Pet,"name"|"description"|"rolePrompt"|"imageRef"|"isDefault">> & {id?:string;expectedRevision?:number};
