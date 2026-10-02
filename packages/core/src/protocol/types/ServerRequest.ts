export type PermissionRequestedRequest = {
  type: "permission.requested";
  requestId: string;
  threadId: string;
  timestamp: string;
  payload: {
    toolName: string;
    toolCallId: string;
    arguments: Record<string, unknown>;
    timeoutMs?: number;
  };
};

export type ServerRequest = PermissionRequestedRequest;
