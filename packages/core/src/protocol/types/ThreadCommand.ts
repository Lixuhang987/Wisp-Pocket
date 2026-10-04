import type { RuntimeOp } from "./Op.ts";
import type { DynamicToolSpec } from "./DynamicTool.ts";

export type ThreadStartCommand = {
  type: "thread.start";
  commandId: string;
  timestamp: string;
  payload: {
    workspaceId: string;
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
  payload?: {workspaceId?: string; limit?: number; cursor?: string};
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

type CommandBase = {commandId:string; timestamp:string};
export type WorkspaceCommand = CommandBase & ({type:'workspace.list'} | {type:'workspace.create';payload:{rootPath:string}});

export type ThreadCommand =
  | ThreadStartCommand
  | ThreadResumeCommand
  | ThreadListCommand
  | ThreadDeleteCommand
  | OpSubmitCommand
  | WorkspaceCommand;
