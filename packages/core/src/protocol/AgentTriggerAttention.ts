export type AgentTriggerAttentionReason = "permission" | "workspace" | "failure";

export type AgentTriggerAttention = {
  threadId: string;
  triggerInstanceId: string;
  reason: AgentTriggerAttentionReason;
  message: string;
};
