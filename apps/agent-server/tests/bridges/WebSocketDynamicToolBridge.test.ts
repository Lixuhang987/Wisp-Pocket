import { describe, expect, it, vi } from "vitest";
import type { DynamicToolProviderMessage } from "@handagent/core/protocol/types/DynamicTool.ts";
import {
  DynamicToolProviderOfflineError,
  DynamicToolProviderTimeoutError,
  WebSocketDynamicToolBridge,
} from "../../src/bridges/WebSocketDynamicToolBridge.ts";

function captureSends(bridge: WebSocketDynamicToolBridge, clientId = "swift-host") {
  const sent: DynamicToolProviderMessage[] = [];
  const token = bridge.attach(clientId, (message) => sent.push(message));
  return { sent, token };
}

describe("WebSocketDynamicToolBridge", () => {
  it("allows the same call to succeed after a synchronous transport send failure", async () => {
    const bridge = new WebSocketDynamicToolBridge();
    let attempts = 0;
    const token = bridge.attach("swift-host", () => {
      if (++attempts === 1) throw new Error("transport send failed");
    });
    const request = {
      clientId: "swift-host", threadId: "thread-retry", turnId: "turn-retry", callId: "call-retry",
      namespace: "automation", tool: "run", arguments: { policyId: "saved-policy" },
    };
    try {
      await expect(bridge.call(request)).rejects.toThrow("transport send failed");
      const retry = bridge.call(request);
      bridge.handleResponse({
        callId: request.callId, success: true, contentItems: [{ type: "inputText", text: "completed" }],
      }, token);
      await expect(retry).resolves.toMatchObject({ callId: request.callId, success: true });
      expect(attempts).toBe(2);
    } finally { bridge.close(); }
  });

  it("rejects with offline error before a provider registers", async () => {
    const bridge = new WebSocketDynamicToolBridge();

    await expect(
      bridge.call({
        clientId: "swift-host",
        threadId: "thread-1",
        turnId: "turn-1",
        callId: "call-1",
        namespace: "host_macos",
        tool: "screen_capture",
        arguments: {},
      }),
    ).rejects.toBeInstanceOf(DynamicToolProviderOfflineError);
  });

  it("sends tool_call_request to the matching provider and resolves response", async () => {
    const bridge = new WebSocketDynamicToolBridge();
    const { sent, token } = captureSends(bridge);

    const promise = bridge.call({
      clientId: "swift-host",
      threadId: "thread-1",
      turnId: "turn-1",
      callId: "call-1",
      namespace: "host_macos",
      tool: "screen_capture",
      arguments: { displayId: 1 },
    });

    expect(sent).toEqual([
      {
        channel: "dynamic_tools",
        type: "tool_call_request",
        payload: expect.objectContaining({
          clientId: "swift-host",
          callId: "call-1",
          tool: "screen_capture",
        }),
      },
    ]);

    bridge.handleResponse(
      {
        callId: "call-1",
        success: true,
        contentItems: [{ type: "inputText", text: "ok" }],
      },
      token,
    );

    await expect(promise).resolves.toEqual({
      callId: "call-1",
      success: true,
      contentItems: [{ type: "inputText", text: "ok" }],
    });
  });

  it("routes matching response callIds independently per provider token", async () => {
    const bridge = new WebSocketDynamicToolBridge();
    const providerA = captureSends(bridge, "provider-a");
    const providerB = captureSends(bridge, "provider-b");

    const first = bridge.call({
      clientId: "provider-a",
      threadId: "thread-1",
      turnId: "turn-1",
      callId: "call-1",
      tool: "capture",
      arguments: {},
    }, 100);
    const second = bridge.call({
      clientId: "provider-b",
      threadId: "thread-2",
      turnId: "turn-2",
      callId: "call-1",
      tool: "capture",
      arguments: {},
    }, 100);

    bridge.handleResponse(
      {
        callId: "call-1",
        success: true,
        contentItems: [{ type: "inputText", text: "from-b" }],
      },
      providerB.token,
    );
    bridge.handleResponse(
      {
        callId: "call-1",
        success: true,
        contentItems: [{ type: "inputText", text: "from-a" }],
      },
      providerA.token,
    );

    await expect(first).resolves.toMatchObject({
      contentItems: [{ type: "inputText", text: "from-a" }],
    });
    await expect(second).resolves.toMatchObject({
      contentItems: [{ type: "inputText", text: "from-b" }],
    });
  });

  it("rejects pending calls when provider detaches", async () => {
    const bridge = new WebSocketDynamicToolBridge();
    const { token } = captureSends(bridge);

    const promise = bridge.call({
      clientId: "swift-host",
      threadId: "thread-1",
      turnId: "turn-1",
      callId: "call-1",
      tool: "screen_capture",
      arguments: {},
    });
    bridge.detach(token);

    await expect(promise).rejects.toBeInstanceOf(DynamicToolProviderOfflineError);
  });

  it("rejects pending calls when a newer provider replaces the old one", async () => {
    const bridge = new WebSocketDynamicToolBridge();
    captureSends(bridge);
    const promise = bridge.call({
      clientId: "swift-host",
      threadId: "thread-1",
      turnId: "turn-1",
      callId: "call-1",
      tool: "screen_capture",
      arguments: {},
    });
    captureSends(bridge);

    await expect(promise).rejects.toBeInstanceOf(DynamicToolProviderOfflineError);
    await expect(promise).rejects.toThrow("provider replaced");
  });

  it("rejects with timeout if provider does not respond", async () => {
    vi.useFakeTimers();
    try {
      const bridge = new WebSocketDynamicToolBridge();
      captureSends(bridge);

      const promise = bridge.call({
        clientId: "swift-host",
        threadId: "thread-1",
        turnId: "turn-1",
        callId: "call-1",
        tool: "screen_capture",
        arguments: {},
      }, 500);
      const rejection = expect(promise).rejects.toBeInstanceOf(
        DynamicToolProviderTimeoutError,
      );
      vi.advanceTimersByTime(600);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });
});
