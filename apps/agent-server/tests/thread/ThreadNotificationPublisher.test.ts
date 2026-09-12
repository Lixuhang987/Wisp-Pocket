import { describe, expect, it } from "vitest";
import type { ServerRequest } from "@handagent/core/protocol/types/ServerRequest.ts";
import type { ThreadNotification } from "@handagent/core/protocol/types/ThreadNotification.ts";
import { ThreadNotificationPublisher } from "../../src/thread/ThreadNotificationPublisher.ts";

describe("ThreadNotificationPublisher", () => {
  it("routes interactive server requests only to request owner connections", () => {
    const publisher = new ThreadNotificationPublisher();
    const swift: unknown[] = [];
    const react: unknown[] = [];
    publisher.attachConnection("swift", (event) => swift.push(event));
    publisher.attachConnection("react", (event) => react.push(event));
    publisher.subscribe("swift", "thread-1");
    publisher.subscribe("react", "thread-1");
    publisher.acceptServerRequests("react");

    publisher.publish({
      type: "permission.requested",
      requestId: "thread-1:req-1",
      threadId: "thread-1",
      timestamp: "2026-06-24T00:00:00.000Z",
      payload: {
        toolName: "file.write",
        toolCallId: "call-1",
        arguments: {},
      },
    } satisfies ServerRequest);

    expect(swift).toEqual([]);
    expect(react).toHaveLength(1);
    expect((react[0] as ServerRequest).type).toBe("permission.requested");
  });

  it("broadcasts thread.started to every thread connection and subscribes them to the new thread", () => {
    const publisher = new ThreadNotificationPublisher();
    const swift: unknown[] = [];
    const react: unknown[] = [];
    publisher.attachConnection("swift", (event) => swift.push(event));
    publisher.attachConnection("react", (event) => react.push(event));

    publisher.publish({
      type: "thread.started",
      threadId: "thread-1",
      notificationId: "n-start",
      commandId: "cmd-1",
      timestamp: "2026-06-24T00:00:00.000Z",
      payload: { preview: null },
    } satisfies ThreadNotification);
    publisher.publish({
      type: "assistant.delta",
      threadId: "thread-1",
      notificationId: "n1",
      turnId: "turn-1",
      itemId: "assistant-1",
      timestamp: "2026-06-24T00:00:01.000Z",
      payload: { text: "hello" },
    } satisfies ThreadNotification);

    expect(swift.map((event) => (event as ThreadNotification).type)).toEqual([
      "thread.started",
      "assistant.delta",
    ]);
    expect(react.map((event) => (event as ThreadNotification).type)).toEqual([
      "thread.started",
      "assistant.delta",
    ]);
  });

  it("still broadcasts thread notifications to every subscribed connection", () => {
    const publisher = new ThreadNotificationPublisher();
    const swift: unknown[] = [];
    const react: unknown[] = [];
    publisher.attachConnection("swift", (event) => swift.push(event));
    publisher.attachConnection("react", (event) => react.push(event));
    publisher.subscribe("swift", "thread-1");
    publisher.subscribe("react", "thread-1");

    publisher.publish({
      type: "assistant.delta",
      threadId: "thread-1",
      notificationId: "n1",
      turnId: "turn-1",
      itemId: "assistant-1",
      timestamp: "2026-06-24T00:00:00.000Z",
      payload: { text: "hello" },
    } satisfies ThreadNotification);

    expect(swift).toHaveLength(1);
    expect(react).toHaveLength(1);
  });
});
