import { describe, expect, it } from "vitest";
import { AgentTriggerAttentionPublisher } from "../../src/thread/AgentTriggerAttentionPublisher.ts";

describe("AgentTriggerAttentionPublisher", () => {
  it("publishes attention for permission requests on registered trigger threads", () => {
    const publisher = new AgentTriggerAttentionPublisher();
    const events: Array<{ threadId: string; triggerInstanceId: string; reason: string; message: string }> = [];
    publisher.attachConnection("connection-1", (event) => events.push(event));
    publisher.registerTriggerThread("thread-1", "trigger-1", "on_attention");

    publisher.observe({
      type: "permission.requested",
      requestId: "request-1",
      threadId: "thread-1",
      timestamp: "2026-06-18T00:00:00.000Z",
      payload: {
        toolName: "file.write",
        toolCallId: "tool-1",
        arguments: {},
        timeoutMs: 60_000,
      },
    });

    expect(events).toEqual([
      {
        threadId: "thread-1",
        triggerInstanceId: "trigger-1",
        reason: "permission",
        message: "后台 Agent 需要权限确认",
      },
    ]);
  });

  it("suppresses attention for silent triggers", () => {
    const publisher = new AgentTriggerAttentionPublisher();
    const events: Array<unknown> = [];
    publisher.attachConnection("connection-1", (event) => events.push(event));
    publisher.registerTriggerThread("thread-1", "trigger-1", "silent");

    publisher.observe({
      type: "thread.error",
      threadId: "thread-1",
      notificationId: "notification-1",
      timestamp: "2026-06-18T00:00:00.000Z",
      payload: {
        message: "failed",
      },
    });

    expect(events).toEqual([]);
  });
});
