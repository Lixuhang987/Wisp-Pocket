import type {
  DynamicToolBridge,
  DynamicToolCallResponsePayload,
  DynamicToolSpec,
} from "../protocol/types/DynamicTool.ts";
import { dynamicToolName } from "../protocol/types/DynamicTool.ts";
import type { AgentTool, AgentToolCallContext } from "./types/AgentTool.ts";

export class DynamicToolAdapter implements AgentTool<unknown, DynamicToolCallResponsePayload> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;

  constructor(
    private readonly spec: DynamicToolSpec,
    private readonly bridge: DynamicToolBridge,
  ) {
    this.name = dynamicToolName(spec);
    this.description = spec.description;
    this.inputSchema = spec.inputSchema;
  }

  async call(
    input: unknown,
    context: AgentToolCallContext = {},
  ): Promise<DynamicToolCallResponsePayload> {
    if (!context.threadId) {
      throw new Error(`Dynamic tool ${this.name} requires threadId`);
    }
    if (!context.toolCallId) {
      throw new Error(`Dynamic tool ${this.name} requires toolCallId`);
    }

    const providerCallId = providerCallIdFor({
      threadId: context.threadId,
      turnId: context.turnId,
      toolCallId: context.toolCallId,
    });
    const response = await this.bridge.call({
      clientId: this.spec.clientId,
      threadId: context.threadId,
      turnId: context.turnId ?? context.threadId,
      callId: providerCallId,
      ...(this.spec.namespace ? { namespace: this.spec.namespace } : {}),
      tool: this.spec.name,
      arguments: input,
    });
    if (!response.success) {
      throw new Error(formatDynamicToolError(this.name, response));
    }
    return {
      ...response,
      callId: context.toolCallId,
    };
  }
}

function providerCallIdFor(input: {
  threadId: string;
  turnId?: string;
  toolCallId: string;
}): string {
  return input.turnId
    ? `${input.threadId}:${input.turnId}:${input.toolCallId}`
    : `${input.threadId}:${input.toolCallId}`;
}

function formatDynamicToolError(
  toolName: string,
  response: DynamicToolCallResponsePayload,
): string {
  const text = response.contentItems
    .filter((item): item is { type: "inputText"; text: string } => item.type === "inputText")
    .map((item) => item.text)
    .join("\n");
  return text || `Dynamic tool failed: ${toolName}`;
}
