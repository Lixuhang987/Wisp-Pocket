import type {
  DynamicToolBridge,
  DynamicToolCallRequestPayload,
  DynamicToolCallResponsePayload,
  DynamicToolProviderMessage,
} from "@handagent/core/protocol/DynamicTool.ts";

type ProviderToken = number;

type Provider = {
  clientId: string;
  token: ProviderToken;
  send: Send;
};

type Pending = {
  clientId: string;
  token: ProviderToken;
  resolve: (value: DynamicToolCallResponsePayload) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export type Send = (message: DynamicToolProviderMessage) => void;

export class DynamicToolProviderOfflineError extends Error {
  constructor(clientId: string) {
    super(`Dynamic tool provider is offline: ${clientId}`);
    this.name = "DynamicToolProviderOfflineError";
  }
}

export class DynamicToolProviderTimeoutError extends Error {
  constructor(clientId: string, timeoutMs: number) {
    super(`Dynamic tool provider timed out: ${clientId} after ${timeoutMs}ms`);
    this.name = "DynamicToolProviderTimeoutError";
  }
}

export class WebSocketDynamicToolBridge implements DynamicToolBridge {
  private readonly providers = new Map<string, Provider>();
  private readonly pending = new Map<string, Pending>();
  private nextToken = 0;

  attach(clientId: string, send: Send): ProviderToken {
    const previous = this.providers.get(clientId);
    if (previous) {
      this.failPendingForToken(previous.token, "provider replaced");
    }

    const token = ++this.nextToken;
    this.providers.set(clientId, { clientId, token, send });
    return token;
  }

  detach(token: ProviderToken, reason = "provider disconnected"): void {
    for (const [clientId, provider] of this.providers) {
      if (provider.token !== token) continue;
      this.providers.delete(clientId);
      this.failPendingForToken(token, reason);
      return;
    }
  }

  call(
    payload: DynamicToolCallRequestPayload,
    timeoutMs = 15_000,
  ): Promise<DynamicToolCallResponsePayload> {
    const provider = this.providers.get(payload.clientId);
    if (!provider) {
      return Promise.reject(new DynamicToolProviderOfflineError(payload.clientId));
    }

    return new Promise((resolve, reject) => {
      const pendingKey = this.pendingKey(provider.token, payload.callId);
      if (this.pending.has(pendingKey)) {
        reject(new Error(`Dynamic tool call is already pending: ${payload.callId}`));
        return;
      }

      const timeout = setTimeout(() => {
        this.pending.delete(pendingKey);
        reject(new DynamicToolProviderTimeoutError(payload.clientId, timeoutMs));
      }, timeoutMs);

      this.pending.set(pendingKey, {
        clientId: payload.clientId,
        token: provider.token,
        resolve,
        reject,
        timeout,
      });

      provider.send({
        channel: "dynamic_tools",
        type: "tool_call_request",
        payload,
      });
    });
  }

  handleResponse(
    payload: DynamicToolCallResponsePayload,
    token: ProviderToken | null,
  ): void {
    if (token === null) return;
    const pendingKey = this.pendingKey(token, payload.callId);
    const pending = this.pending.get(pendingKey);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pending.delete(pendingKey);
    pending.resolve(payload);
  }

  private failPendingForToken(token: ProviderToken, reason: string): void {
    for (const [pendingKey, pending] of this.pending) {
      if (pending.token !== token) continue;
      clearTimeout(pending.timeout);
      pending.reject(new DynamicToolProviderOfflineError(`${pending.clientId} (${reason})`));
      this.pending.delete(pendingKey);
    }
  }

  private pendingKey(token: ProviderToken, callId: string): string {
    return `${token}:${callId}`;
  }
}
