export type DynamicToolSpec = {
  clientId: string;
  namespace?: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  deferLoading?: boolean;
};

export type DynamicToolCallRequestPayload = {
  clientId: string;
  threadId: string;
  turnId: string;
  callId: string;
  namespace?: string;
  tool: string;
  arguments: unknown;
};

export type DynamicToolResponseContentItem =
  | { type: "inputText"; text: string }
  | { type: "inputImage"; imageUrl: string };

export type DynamicToolCallResponsePayload = {
  callId: string;
  success: boolean;
  contentItems: DynamicToolResponseContentItem[];
};

export type DynamicToolProviderMessage =
  | {
      channel: "dynamic_tools";
      type: "provider_hello";
      clientId: string;
      tools: DynamicToolSpec[];
    }
  | {
      channel: "dynamic_tools";
      type: "tool_call_request";
      payload: DynamicToolCallRequestPayload;
    }
  | {
      channel: "dynamic_tools";
      type: "tool_call_response";
      payload: DynamicToolCallResponsePayload;
    };

export type DynamicToolBridge = {
  call(payload: DynamicToolCallRequestPayload, timeoutMs?: number): Promise<DynamicToolCallResponsePayload>;
};

export function dynamicToolName(spec: Pick<DynamicToolSpec, "namespace" | "name">): string {
  return spec.namespace ? `${spec.namespace}.${spec.name}` : spec.name;
}
