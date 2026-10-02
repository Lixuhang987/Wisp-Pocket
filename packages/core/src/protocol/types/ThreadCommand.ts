import type { PetCreateInput, PetPatch } from "../../pet/Pet.ts";
import type { RuntimeOp } from "./Op.ts";
import type { DynamicToolSpec } from "./DynamicTool.ts";

export type ThreadStartCommand = {
  type: "thread.start";
  commandId: string;
  timestamp: string;
  payload: {
    petId: string;
    dynamicTools?: DynamicToolSpec[];
  };
};

export type ThreadResumeCommand = {
  type: "thread.resume";
  threadId: string;
  commandId: string;
  timestamp: string;
};

export type ThreadListCommand = {
  payload?: {petId?: string; limit?: number; cursor?: string};
  type: "thread.list";
  commandId: string;
  timestamp: string;
};

export type ThreadDeleteCommand = {
  type: "thread.delete";
  commandId: string;
  timestamp: string;
  payload: {
    targetThreadId: string;
  };
};

export type OpSubmitCommand = {
  type: "op.submit";
  threadId: string;
  commandId: string;
  timestamp: string;
  payload: {
    op: RuntimeOp;
  };
};

type PetCommandBase = {commandId:string; timestamp:string};
export type PetListCommand = PetCommandBase & {type:'pet.list'};
export type PetCreateCommand = PetCommandBase & {type:'pet.create'; payload:PetCreateInput};
export type PetUpdateCommand = PetCommandBase & {type:'pet.update'; payload:{id:string;expectedRevision:number;patch:PetPatch}};
export type PetImageImportCommand = PetCommandBase & {type:'pet.image.import';payload:{mimeType:'image/png'|'image/jpeg'|'image/webp';base64:string}};
export type PetCommand = PetListCommand | PetCreateCommand | PetUpdateCommand | PetImageImportCommand;

export type ThreadCommand =
  | ThreadStartCommand
  | ThreadResumeCommand
  | ThreadListCommand
  | ThreadDeleteCommand
  | OpSubmitCommand
  | PetCommand;
