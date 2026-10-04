import type { AgentMessage } from "../../runtime/types/AgentMessage.ts";
import type { AgentRunResult, AgentRuntimeEvent, AgentRuntimeRunOptions } from "../../runtime/AgentRuntime.ts";
import type { UserInput } from "../../protocol/types/Op.ts";
import type { ThreadNotification } from "../../protocol/types/ThreadNotification.ts";
import type { ServerRequest } from "../../protocol/types/ServerRequest.ts";
import type { DynamicToolSpec } from "../../protocol/types/DynamicTool.ts";
import type { ConversationMessage } from "../../conversation/types/ConversationMessage.ts";
import type { PersistedThread, ThreadAuditEvent, ThreadSummary } from "./ThreadHistory.ts";
import type { ThreadTools } from "../ThreadTools.ts";

export type CreateThreadInput = { preview?: string | null; workspaceId: string; commandId?: string; dynamicTools?: DynamicToolSpec[] };
export interface ThreadStorage {
  createThread(input: CreateThreadInput): Promise<PersistedThread>;
  getThread(id: string): Promise<PersistedThread | null>;
  listThreads(): Promise<ThreadSummary[]>;
  deleteThread(id: string): Promise<void>;
  recoverIncompleteTurnForSnapshot(id: string): Promise<"failed" | "interrupted" | null>;
  resetThread(id: string): Promise<void>;
  persistUserInput(id: string, input: UserInput, messageId?: string): Promise<AgentMessage>;
  autoTitle(id: string, text: string): Promise<void>;
  persistRunDelta(id: string, base: number, messages: AgentMessage[], events: ThreadAuditEvent[], notifications?: ThreadNotification[]): Promise<void>;
  persistNotifications(id: string, notifications: ThreadNotification[]): Promise<void>;
  persistError(id: string, message: string, code?: string): Promise<void>;
}
export interface ThreadRuntime {
  runWithMessages(messages: AgentMessage[], emit: (event: AgentRuntimeEvent) => void, options?: AgentRuntimeRunOptions): Promise<AgentRunResult>;
  waitForPendingSummaries?(messages?: AgentMessage[]): Promise<void>;
}
export interface ThreadProjection {
  runtimeMessages(messages: AgentMessage[]): AgentMessage[];
  conversation(messages: AgentMessage[]): ConversationMessage[];
  notification(id: string, turnId: string, event: AgentRuntimeEvent, time: string, sequence: number): ThreadNotification | null;
  audit(event: AgentRuntimeEvent, time: string): ThreadAuditEvent | null;
  summarizeInput(input: UserInput): string;
}
export type ThreadServices = {
  storage: ThreadStorage;
  projection: ThreadProjection;
  publish: (message: ThreadNotification | ServerRequest) => void;
  createRuntime: (id: string, tools: ThreadTools) => ThreadRuntime;
  createTools: (dynamicTools: DynamicToolSpec[]) => ThreadTools;
  now?: () => string;
  stopTimeoutMs?: number;
};
export type QueuedInput = { opId: string; payload: UserInput };
export type ActiveTurn = { id: string; input: QueuedInput; controller: AbortController; done: Promise<void>; sequence: number };
