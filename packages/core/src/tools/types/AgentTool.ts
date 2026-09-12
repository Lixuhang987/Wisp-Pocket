export type AgentToolInputSchema = Record<string, unknown>;

export type AgentToolCallContext = {
  threadId?: string;
  turnId?: string;
  toolCallId?: string;
};

export interface AgentTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: AgentToolInputSchema;
  stubByDefault?: boolean;
  requiresPermission?: boolean;
  call(input: TInput, context?: AgentToolCallContext): Promise<TOutput>;
}
