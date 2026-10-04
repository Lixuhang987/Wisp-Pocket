import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeOpSubmit,
  encodePermissionAnswer,
  encodeThreadList,
  encodeThreadStart,
  isServerRequest,
  isThreadNotification,
} from "../../src/protocol/threadProtocol.ts";
import {
  getAvailableSkills,
  installInitialPromptReceiver,
  installThreadOpenReceiver,
} from "../../src/native/nativeConfig.ts";
import { applyThemeToDocument, getInitialTheme, installThemeSubscription } from "../../src/native/themeConfig.ts";

describe("thread protocol helpers", () => {
  it("encodes thread.start for a workspace", () => {
    expect(JSON.parse(encodeThreadStart({
      commandId: "cmd-1",
      timestamp: "2026-06-06T00:00:00.000Z",
      workspaceId: "workspace-default",
    }))).toEqual({
      type: "thread.start",
      commandId: "cmd-1",
      timestamp: "2026-06-06T00:00:00.000Z",
      payload: { workspaceId: "workspace-default" },
    });
  });

  it("encodes op.submit with user input items", () => {
    expect(JSON.parse(encodeOpSubmit({
      threadId: "thread-1",
      commandId: "command-op",
      timestamp: "2026-06-06T00:00:01.000Z",
      op: {
        type: "user_input",
        opId: "input-2",
        timestamp: "2026-06-06T00:00:01.000Z",
        payload: {
          items: [
            { type: "text", id: "text-1", text: "hello" },
            { type: "text_selection", id: "sel-1", text: "selected" },
          ],
        },
      },
    }))).toMatchObject({
      type: "op.submit",
      threadId: "thread-1",
      commandId: "command-op",
      payload: {
        op: {
          type: "user_input",
          opId: "input-2",
          payload: {
            items: [
              { type: "text", id: "text-1", text: "hello" },
              { type: "text_selection", id: "sel-1", text: "selected" },
            ],
          },
        },
      },
    });
  });

  it("encodes thread.list and permission answer", () => {
    expect(JSON.parse(encodeThreadList({
      commandId: "cmd-list",
      timestamp: "2026-06-06T00:00:02.000Z",
    })).type).toBe("thread.list");
    expect(JSON.parse(encodePermissionAnswer({
      requestId: "thread-1:req-1",
      timestamp: "2026-06-06T00:00:03.000Z",
      decision: "allow",
      scope: "once",
    }))).toMatchObject({
      type: "permission.answered",
      requestId: "thread-1:req-1",
      payload: { decision: "allow", scope: "once" },
    });
  });

  it("guards inbound notifications and requests", () => {
    expect(isThreadNotification({ type: "assistant.delta" })).toBe(false);
    expect(isServerRequest({ type: "permission.requested" })).toBe(false);

    expect(isThreadNotification({
      type: "assistant.delta",
      threadId: "thread-1",
      notificationId: "n1",
      turnId: "turn-1",
      itemId: "assistant-1",
      timestamp: "2026-06-06T00:00:04.000Z",
      payload: { text: "hi" },
    })).toBe(true);

    expect(isServerRequest({
      type: "permission.requested",
      requestId: "thread-1:req-2",
      threadId: "thread-1",
      timestamp: "2026-06-06T00:00:05.000Z",
      payload: { toolName: "file.write", toolCallId: "write", arguments: {} },
    })).toBe(true);
  });

  it("rejects malformed thread snapshot notifications", () => {
    const baseSnapshot = {
      type: "thread.snapshot",
      threadId: "thread-1",
      notificationId: "n-snapshot",
      timestamp: "2026-06-06T00:00:06.000Z",
    };

    expect(isThreadNotification({
      ...baseSnapshot,
      payload: {},
    })).toBe(false);

    expect(isThreadNotification({
      ...baseSnapshot,
      payload: {
        messages: [],
        status: "paused",
      },
    })).toBe(false);

    expect(isThreadNotification({
      ...baseSnapshot,
      payload: {
        messages: [{ id: 123, role: "alien", text: null }],
        status: "running",
      },
    })).toBe(false);

    expect(isThreadNotification({
      ...baseSnapshot,
      payload: {
        messages: [{
          id: "message-1",
          role: "assistant",
          text: "hello",
          status: "completed",
          createdAt: "2026-06-06T00:00:06.000Z",
          updatedAt: "2026-06-06T00:00:06.000Z",
          toolCall: { name: "file.read" },
          error: "ignored after retry",
        }],
        status: "running",
      },
    })).toBe(true);
  });

  it("rejects notification payloads with invalid status values", () => {
    const base = {
      threadId: "thread-1",
      notificationId: "n-status",
      timestamp: "2026-06-06T00:00:07.000Z",
    };

    expect(isThreadNotification({
      ...base,
      type: "thread.status.changed",
      payload: { value: "paused" },
    })).toBe(false);

    expect(isThreadNotification({
      ...base,
      type: "turn.completed",
      turnId: "turn-1",
      payload: { status: "running" },
    })).toBe(false);

    expect(isThreadNotification({
      type: "thread.deleted",
      notificationId: "n-deleted",
      timestamp: "2026-06-06T00:00:08.000Z",
      payload: {
        targetThreadId: "thread-1",
        status: "archived",
      },
    })).toBe(false);

    expect(isThreadNotification({
      ...base,
      type: "tool.finished",
      turnId: "turn-1",
      itemId: "tool-1",
      payload: {
        name: "read_file",
        status: "cancelled",
        output: "stopped",
      },
    })).toBe(false);
  });

  it("guards workspace listed notifications", () => {
    const base = {
      type: "workspace.listed",
      notificationId: "n-pets",
      commandId: "pet-list-1",
      timestamp: "2026-06-06T00:00:09.000Z",
    };

    expect(isThreadNotification({
      ...base,
      payload: {
        workspaces: [{workspaceId:"workspace-1",description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",
          id: "docs",
          name: "Docs",
          rootPath: "/repo/docs",
        }],
      },
    })).toBe(true);

    expect(isThreadNotification({
      ...base,
      payload: {
        workspaces: [{workspaceId:"workspace-1",description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",
          id: "docs",
          name: "Docs",
          rootPath: 123,
        }],
      },
    })).toBe(false);
  });
});

describe("native config boundaries", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis as Record<string, unknown>, "document");
  });

  function nativeWindow() {
    return window as typeof window & {
      handAgentThreadWindowConfig?: {
        threadWebSocketURL?: string;
        availableSkills?: Array<{
          actionId: string;
          title: string;
          prompt: string;
          description?: string;
        }>;
      };
      handAgentPendingInitialPrompts?: Array<{
        clientRequestId: string;
        userInput: {
          items: Array<{ type: "text"; id: string; text: string }>;
        };
      }>;
    };
  }

  it("flushes initial prompts queued before React installs the receiver", () => {
    nativeWindow().handAgentPendingInitialPrompts = [{workspaceId: "workspace-default",
clientRequestId: "prompt-1",
      userInput: {
        items: [{ type: "text", id: "text-1", text: "hello" }],
      },
    }];
    const received: string[] = [];

    installInitialPromptReceiver((payload) => {
      received.push(payload.userInput.items[0]?.type === "text" ? payload.userInput.items[0].text : "");
    });

    expect(received).toEqual(["hello"]);
    expect(nativeWindow().handAgentPendingInitialPrompts).toEqual([]);
  });

  it("reads available skills from host config", () => {
    const original = [
      { actionId: "review/code", title: "Review", prompt: "Review this code" },
      { actionId: "bad", title: "Bad", prompt: 123 as never },
    ];
    nativeWindow().handAgentThreadWindowConfig = { availableSkills: original };

    const skills = getAvailableSkills();
    expect(skills).toEqual([
      { actionId: "review/code", title: "Review", prompt: "Review this code" },
    ]);
    expect(skills).not.toBe(original);
  });

  it("delivers queued and live Thread opens once and releases the receiver on cleanup", () => {
    window.handAgentPendingThreadOpens = ["thread-a", "thread-b"];
    const received: string[] = [];
    const dispose = installThreadOpenReceiver((threadId) => received.push(threadId));
    window.handAgentReceiveThreadOpen?.("thread-c");

    expect(received).toEqual(["thread-a", "thread-b", "thread-c"]);
    expect(window.handAgentPendingThreadOpens).toEqual([]);
    dispose();
    expect(window.handAgentReceiveThreadOpen).toBeUndefined();

    const replacement = vi.fn();
    const disposeReplacement = installThreadOpenReceiver(replacement);
    expect(replacement).not.toHaveBeenCalled();
    disposeReplacement();
  });

  it("keeps the current Thread open receiver when an older installation is disposed", () => {
    const disposeFirst = installThreadOpenReceiver(vi.fn());
    const current = vi.fn();
    const disposeCurrent = installThreadOpenReceiver(current);
    disposeFirst();
    window.handAgentReceiveThreadOpen?.("thread-current");

    expect(current).toHaveBeenCalledExactlyOnceWith("thread-current");
    disposeCurrent();
    expect(window.handAgentReceiveThreadOpen).toBeUndefined();
  });

  it("falls back to system/light when preload did not provide a theme", () => {
    expect(getInitialTheme()).toEqual({ preference: "system", resolved: "light" });
  });

  it("applies the resolved theme to documentElement", () => {
    const documentElement = {
      dataset: {} as DOMStringMap,
      removeAttribute: vi.fn((name: string) => {
        if (name === "data-theme") {
          delete documentElement.dataset.theme;
        }
      }),
    };
    (globalThis as Record<string, unknown>).document = { documentElement } as unknown as Document;

    applyThemeToDocument({ preference: "dark", resolved: "dark" });
    expect(documentElement.dataset.theme).toBe("dark");
  });

  it("subscribes to host theme changes and returns the host unsubscribe", () => {
    const unsubscribe = vi.fn();
    window.handAgentSubscribeThemeChange = vi.fn(() => unsubscribe);
    const handler = vi.fn();

    const dispose = installThemeSubscription(handler);

    expect(window.handAgentSubscribeThemeChange).toHaveBeenCalledOnce();
    dispose();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
