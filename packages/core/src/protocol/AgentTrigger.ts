import type { UserInput } from "./Op.ts";

export type AgentTriggerNotificationMode = "silent" | "on_failure" | "on_attention";

export type AgentTriggerNotificationPolicy = {
  mode: AgentTriggerNotificationMode;
};

export type AgentTriggerSourceEvent = {
  triggerInstanceId: string;
  providerKind: string;
  occurredAt: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type AgentTriggerFireRequest = {
  triggerInstanceId: string;
  threadTitleHint: string | null;
  userInput: UserInput;
  notificationPolicy: AgentTriggerNotificationPolicy;
  sourceEvent: AgentTriggerSourceEvent;
};

export type AgentTriggerFireResult = {
  threadId: string;
  acceptedAt: string;
};
