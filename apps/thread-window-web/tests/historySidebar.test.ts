import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ThreadWindowState } from "../src/store/threadWindowStore.ts";

const timestamp = "2026-06-09T00:00:00.000Z";

const mockState: Pick<
  ThreadWindowState,
  "history" | "workspaces" | "expandedWorkspaceIds" | "searchQuery" | "setSearchQuery" | "toggleWorkspaceExpanded" | "threadsById"
> = {
  history: [],
  workspaces: [
    {
      id: "workspace-1",
      name: "Project workspace",
      rootPath: "/tmp/project",
    },
  ],
  expandedWorkspaceIds: new Set(["workspace-1"]),
  searchQuery: "",
  setSearchQuery: vi.fn(),
  toggleWorkspaceExpanded: vi.fn(),
  threadsById: {},
};

vi.mock("../src/store/threadWindowStore.ts", () => ({
  createThreadWindowStore: <T,>(selector: (state: typeof mockState) => T) => selector(mockState),
}));

const { HistorySidebar } = await import("../src/components/HistorySidebar.tsx");

describe("HistorySidebar", () => {
  beforeEach(() => {
    mockState.history = [];
    mockState.workspaces = [
      {
        id: "workspace-1",
        name: "Project workspace",
        rootPath: "/tmp/project",
      },
    ];
    mockState.expandedWorkspaceIds = new Set(["workspace-1"]);
    mockState.searchQuery = "";
    mockState.setSearchQuery = vi.fn();
    mockState.toggleWorkspaceExpanded = vi.fn();
    mockState.threadsById = {};
  });

  it("provides Radix Accordion context for workspace groups", () => {
    const html = renderToStaticMarkup(
      React.createElement(HistorySidebar, {
        activeThreadId: null,
        onOpenThread: vi.fn(),
        onDeleteThread: vi.fn(),
        onNewThread: vi.fn(),
      }),
    );

    expect(html).toContain("Project workspace");
    // rootPath is no longer displayed for simplified UI
  });

  it("renders workspace groups alphabetically before the default conversation group", () => {
    mockState.workspaces = [
      { id: "default", name: "default", rootPath: "/default" },
      { id: "tmp", name: "tmp", rootPath: "/tmp" },
      { id: "qa-workspace", name: "qa-workspace", rootPath: "/qa" },
      { id: "handagent-test", name: "handagent-test", rootPath: "/handagent" },
    ];
    mockState.expandedWorkspaceIds = new Set(["tmp", "qa-workspace", "handagent-test"]);
    mockState.history = [
      {
        id: "thread-default",
        preview: "default conversation",
        workspaceId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 1,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(HistorySidebar, {
        activeThreadId: null,
        onOpenThread: vi.fn(),
        onDeleteThread: vi.fn(),
        onNewThread: vi.fn(),
      }),
    );

    const workspaceDefaultIndex = html.indexOf("default");
    const handagentIndex = html.indexOf("handagent-test");
    const qaIndex = html.indexOf("qa-workspace");
    const tmpIndex = html.indexOf("tmp");
    const defaultIndex = html.indexOf("默认对话");

    expect(workspaceDefaultIndex).toBeGreaterThanOrEqual(0);
    expect(handagentIndex).toBeGreaterThan(workspaceDefaultIndex);
    expect(qaIndex).toBeGreaterThan(handagentIndex);
    expect(tmpIndex).toBeGreaterThan(qaIndex);
    expect(defaultIndex).toBeGreaterThan(tmpIndex);
  });

  it("marks the active thread without selected border or background styling", () => {
    mockState.history = [
      {
        id: "thread-default",
        preview: "default conversation",
        workspaceId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 1,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(HistorySidebar, {
        activeThreadId: "thread-default",
        onOpenThread: vi.fn(),
        onDeleteThread: vi.fn(),
        onNewThread: vi.fn(),
      }),
    );

    expect(html).toContain('aria-current="page"');
    const activeThreadRow = html.match(/<div role="button"[^>]*aria-current="page"[^>]*>/)?.[0] ?? "";
    expect(activeThreadRow).not.toContain("bg-app-canvas");
    expect(activeThreadRow).not.toContain("border-app-accent");
  });

  it("renders the shared running thread indicator in workspace and default groups", () => {
    mockState.threadsById = {
      "thread-workspace": {
        threadId: "thread-workspace",
        title: null,
        status: "running",
        messages: [],
        pendingInitialPrompt: null,
        queuedComposerInputs: [],
        queuedInputDispatchPending: false,
        permissionRequests: [],
        workspaceRequests: [],
        errorMessage: null,
      },
      "thread-default": {
        threadId: "thread-default",
        title: null,
        status: "running",
        messages: [],
        pendingInitialPrompt: null,
        queuedComposerInputs: [],
        queuedInputDispatchPending: false,
        permissionRequests: [],
        workspaceRequests: [],
        errorMessage: null,
      },
    };
    mockState.history = [
      {
        id: "thread-workspace",
        preview: "workspace conversation",
        workspaceId: "workspace-1",
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 1,
      },
      {
        id: "thread-default",
        preview: "default conversation",
        workspaceId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 1,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(HistorySidebar, {
        activeThreadId: null,
        onOpenThread: vi.fn(),
        onDeleteThread: vi.fn(),
        onNewThread: vi.fn(),
      }),
    );

    expect(html.match(/aria-label="运行中"/g)).toHaveLength(2);
    expect(html).toContain("animate-ping");
  });

  it("switches folder icon shapes between collapsed and expanded workspace states", () => {
    mockState.history = [
      {
        id: "thread-workspace",
        preview: "workspace conversation",
        workspaceId: "workspace-1",
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 1,
      },
    ];

    mockState.expandedWorkspaceIds = new Set(["workspace-1"]);
    const expandedHtml = renderToStaticMarkup(
      React.createElement(HistorySidebar, {
        activeThreadId: null,
        onOpenThread: vi.fn(),
        onDeleteThread: vi.fn(),
        onNewThread: vi.fn(),
      }),
    );

    mockState.expandedWorkspaceIds = new Set();
    const collapsedHtml = renderToStaticMarkup(
      React.createElement(HistorySidebar, {
        activeThreadId: null,
        onOpenThread: vi.fn(),
        onDeleteThread: vi.fn(),
        onNewThread: vi.fn(),
      }),
    );

    expect(expandedHtml).toContain("C5.25 6.25");
    expect(collapsedHtml).toContain("L6.3 4.35");
  });
});
