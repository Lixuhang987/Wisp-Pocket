import type { Pet, PetImageRef, PetErrorCode } from "../../pet/Pet.ts";
import type { InputItem } from "./Op.ts";
import type {
  RunStatus,
  ThreadListEntry,
  ThreadSnapshotPayload,
} from "./ThreadProtocolShared.ts";

export type ThreadStartedNotification = {
  type: "thread.started";
  threadId: string;
  notificationId: string;
  commandId?: string;
  timestamp: string;
  payload: {
    petId: string;
    petRevision: number;
    rootPath: string;
    preview: string | null;
    createdAt?: string;
  };
};

export type ThreadSnapshotNotification = {
  type: "thread.snapshot";
  threadId: string;
  notificationId: string;
  commandId?: string;
  timestamp: string;
  payload: ThreadSnapshotPayload;
};

export type UserMessageRecordedNotification = {
  type: "user.message.recorded";
  threadId: string;
  notificationId: string;
  timestamp: string;
  payload: {
    messageId: string;
    text: string;
    items?: InputItem[];
    pending?: boolean;
  };
};

export type TurnStartedNotification = {
  type: "turn.started";
  threadId: string;
  notificationId: string;
  turnId: string;
  timestamp: string;
  payload: {};
};

export type AssistantDeltaNotification = {
  type: "assistant.delta";
  threadId: string;
  notificationId: string;
  turnId: string;
  itemId: string;
  timestamp: string;
  payload: {
    text: string;
    suggestedReplies?: string[];
    awaitingReply?: boolean;
  };
};

export type ToolStartedNotification = {
  type: "tool.started";
  threadId: string;
  notificationId: string;
  turnId: string;
  itemId: string;
  timestamp: string;
  payload: {
    name: string;
    input: Record<string, unknown>;
  };
};

export type ToolFinishedNotification = {
  type: "tool.finished";
  threadId: string;
  notificationId: string;
  turnId: string;
  itemId: string;
  timestamp: string;
  payload: {
    name: string;
    status: "completed" | "failed";
    output: string;
    durationMs: number;
  };
};

export type TurnCompletedNotification = {
  type: "turn.completed";
  threadId: string;
  notificationId: string;
  turnId: string;
  timestamp: string;
  payload: {
    status: "completed" | "interrupted" | "failed";
  };
};

export type ThreadStatusChangedNotification = {
  type: "thread.status.changed";
  threadId: string;
  notificationId: string;
  timestamp: string;
  payload: {
    value: RunStatus;
  };
};

export type ThreadListedNotification = {
  type: "thread.listed";
  notificationId: string;
  commandId?: string;
  timestamp: string;
  payload: {
    threads: ThreadListEntry[];
    nextCursor?: string;
  };
};

export type ThreadDeletedNotification = {
  type: "thread.deleted";
  notificationId: string;
  commandId?: string;
  timestamp: string;
  payload: {
    targetThreadId: string;
    status: "deleted" | "not_found";
  };
};

export type ThreadErrorNotification = {
  type: "thread.error";
  threadId?: string;
  notificationId: string;
  commandId?: string;
  timestamp: string;
  payload: {
    code?: string;
    message: string;
  };
};

type PetNotificationBase = {notificationId:string;commandId?:string;timestamp:string};
export type PetListedNotification = PetNotificationBase & {type:'pet.listed';payload:{pets:Pet[]}};
export type PetCreatedNotification = PetNotificationBase & {type:'pet.created';payload:{pet:Pet}};
export type PetUpdatedNotification = PetNotificationBase & {type:'pet.updated';payload:{pet:Pet}};
export type PetImageImportedNotification = PetNotificationBase & {type:'pet.image.imported';payload:{imageRef:PetImageRef}};
export type PetErrorNotification = PetNotificationBase & {type:'pet.error';payload:{code:PetErrorCode;message:string;currentRevision?:number}};
export type PetNotification = PetListedNotification | PetCreatedNotification | PetUpdatedNotification | PetImageImportedNotification | PetErrorNotification;

export type RequestResolvedNotification = {
  type: "request.resolved";
  threadId: string;
  notificationId: string;
  timestamp: string;
  payload: { requestId: string };
};

export type ThreadNotification =
  | ThreadStartedNotification
  | ThreadSnapshotNotification
  | UserMessageRecordedNotification
  | TurnStartedNotification
  | AssistantDeltaNotification
  | ToolStartedNotification
  | ToolFinishedNotification
  | TurnCompletedNotification
  | ThreadStatusChangedNotification
  | ThreadListedNotification
  | ThreadDeletedNotification
  | ThreadErrorNotification
  | PetNotification
  | RequestResolvedNotification;
