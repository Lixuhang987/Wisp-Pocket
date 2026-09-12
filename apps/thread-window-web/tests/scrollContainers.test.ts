import React from "react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.tsx";
import { Composer } from "../src/components/Composer.tsx";
import { HistorySidebar } from "../src/components/HistorySidebar.tsx";
import { MessageList } from "../src/components/MessageList.tsx";
import { ThreadWorkspacePane } from "../src/components/ThreadWorkspacePane.tsx";
import { createThreadWindowStore, type ThreadState } from "../src/store/threadWindowStore.ts";

function threadState(threadId: string): ThreadState {
  return {
    threadId,
    title: threadId,
    status: "idle",
    messages: [],
    pendingInitialPrompt: null,
    permissionRequests: [],
    workspaceRequests: [],
    errorMessage: null,
  };
}

function render(element: React.ReactElement) {
  return renderToStaticMarkup(element);
}

const globalCss = readFileSync(
  fileURLToPath(new URL("../src/styles/tailwind.css", import.meta.url)),
  "utf8",
);

beforeEach(() => {
  vi.stubGlobal("window", {
    innerWidth: 1024,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    handAgentThreadWindowConfig: {},
    handAgentPendingInitialPrompts: [],
  });
  createThreadWindowStore.setState({
    connectionState: "connected",
    windowErrorMessage: null,
    history: [],
    threadsById: {},
    pendingInitialPrompts: {},
    processedNotificationIds: {},
    workspaces: [],
    expandedWorkspaceIds: new Set(),
    searchQuery: "",
  });
});

describe("ThreadWindow scroll containers", () => {
  it("locks the app shell to the viewport without using viewport-width sizing", () => {
    createThreadWindowStore.setState({
      threadsById: { "thread-1": threadState("thread-1") },
    });

    const html = render(React.createElement(App));

    expect(html).toContain("grid h-screen w-full max-w-full overflow-hidden");
    expect(html).toContain('data-thread-window-error-slot="true"');
    expect(html).not.toContain("w-screen");
    expect(html).not.toContain("min-h-screen");
  });

  it("keeps the history chrome fixed while only the thread list scrolls", () => {
    const html = render(
      React.createElement(HistorySidebar, {
        activeThreadId: null,
        onOpenThread: vi.fn(),
        onDeleteThread: vi.fn(),
        onNewThread: vi.fn(),
      }),
    );

    expect(html).toContain("h-screen min-h-0");
    expect(html).toContain("flex-1 min-h-0");
    expect(html).toContain("overflow-y-auto overflow-x-hidden");
  });

  it("uses the message list as the only conversation scroll container", () => {
    const html = render(
      React.createElement(MessageList, {
        items: [
          {
            type: "assistant_message",
            id: "message-1",
            text: "A long assistant reply should wrap inside the conversation column.",
          },
        ],
        errorMessage: null,
      }),
    );

    expect(html).toContain("overflow-y-auto overflow-x-hidden");
  });

  it("renders received pending input in the conversation while the composer remains usable", () => {
    const html = render(React.createElement(MessageList, {
      items: [{ type: "user_message", id: "queued", text: "排队的后续问题", inputItems: [], pending: true }],
      errorMessage: null,
      isRunning: true,
    }));
    expect(html).toContain("排队的后续问题");
    expect(html).toContain("待处理");
    const composer = render(React.createElement(Composer, {
      disabled: false, stopDisabled: false,
      inputItems: [{ type: "text", id: "text", text: "新的补充" }],
      onInputItemsChange: vi.fn(), onSubmit: vi.fn(), onStop: vi.fn(),
    }));
    expect(composer).not.toContain('textarea disabled');
    expect(composer).toContain("新的补充");
  });

  it("renders the fixed workspace pane from a thread id without a tab strip", () => {
    createThreadWindowStore.setState({
      connectionState: "connected",
      threadsById: {
        "thread-1": {
          ...threadState("thread-1"),
          messages: [{ type: "assistant_message", id: "m1", text: "cached delta" }],
        },
      },
    });

    const html = render(
      React.createElement(ThreadWorkspacePane, {
        threadId: "thread-1",
        onSubmit: vi.fn(),
        onStop: vi.fn(),
        onAnswerPermission: vi.fn(),
        onAnswerWorkspace: vi.fn(),
      }),
    );

    expect(html).toContain("cached delta");
    expect(html).toContain('aria-label="Thread workspace"');
    expect(html).not.toContain("overflow-x-auto overflow-y-hidden");
  });

  it("uses transparent global scrollbar tracks instead of a white gutter", () => {
    expect(globalCss).toContain("scrollbar-color: var(--thread-scrollbar-thumb) transparent");
    expect(globalCss).toContain("*::-webkit-scrollbar-track");
    expect(globalCss).toContain("*::-webkit-scrollbar-corner");
    expect(globalCss).toContain("background: transparent");
    expect(globalCss).toContain("background-clip: content-box");
    expect(globalCss).toContain("border: 3px solid transparent");
    expect(globalCss).toContain("color-mix(in srgb, currentColor");
  });
});
