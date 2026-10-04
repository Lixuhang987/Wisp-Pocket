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
  workspaces: [{id:"workspace-1",name:"Project",rootPath:"/tmp/project",createdAt:timestamp}],
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
    mockState.workspaces = [{id:"workspace-1",name:"Project",rootPath:"/tmp/project",createdAt:timestamp}];
    mockState.expandedWorkspaceIds = new Set(["workspace-1"]);
    mockState.searchQuery = "";
    mockState.setSearchQuery = vi.fn();
    mockState.toggleWorkspaceExpanded = vi.fn();
    mockState.threadsById = {};
  });

  it("renders all projects alphabetically and groups separate threads under one project", () => {
    mockState.workspaces = ["default", "tmp", "qa-pet", "handagent-test"].map(id => ({ id, name: id, rootPath: `/${id}`, createdAt: timestamp }));
    mockState.expandedWorkspaceIds = new Set(["tmp", "qa-pet", "handagent-test"]);
    mockState.history = [
      {workspaceId:"workspace-1",rootPath:"/tmp/pet", status:"idle",
        id: "thread-default",
        preview: "default conversation",
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 1,
      },
      {workspaceId:"tmp",rootPath:"/tmp",status:"idle",id:"thread-second",preview:"another partner conversation",createdAt:timestamp,updatedAt:timestamp,messageCount:1},
    ];
    mockState.history[0].workspaceId="tmp";

    const html = renderToStaticMarkup(
      React.createElement(HistorySidebar, {
        activeThreadId: null,
        onOpenThread: vi.fn(),
        onDeleteThread: vi.fn(),
        onNewThread: vi.fn(),
      }),
    );

    const petDefaultIndex = html.indexOf("default");
    const handagentIndex = html.indexOf("handagent-test");
    const qaIndex = html.indexOf("qa-pet");
    const tmpIndex = html.indexOf("tmp");

    expect(petDefaultIndex).toBeGreaterThanOrEqual(0);
    expect(handagentIndex).toBeGreaterThan(petDefaultIndex);
    expect(qaIndex).toBeGreaterThan(handagentIndex);
    expect(tmpIndex).toBeGreaterThan(qaIndex);
    expect(html).toContain("default conversation");
    expect(html).toContain("another partner conversation");
  });

  it("marks the selected thread and renders running indicators in workspace history", () => {
    mockState.threadsById = {
      "thread-pet": {
        threadId: "thread-pet",
        title: null,
        status: "running",
        messages: [],
        pendingInitialPrompt: null,
        permissionRequests: [],
        errorMessage: null,
      },
      "thread-default": {
        threadId: "thread-default",
        title: null,
        status: "running",
        messages: [],
        pendingInitialPrompt: null,
        permissionRequests: [],
        errorMessage: null,
      },
    };
    mockState.history = [
      {workspaceId:"workspace-1",rootPath:"/tmp/pet", status:"idle",
        id: "thread-pet",
        preview: "pet conversation",
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 1,
      },
      {workspaceId:"workspace-1",rootPath:"/tmp/pet", status:"idle",
        id: "thread-default",
        preview: "default conversation",
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

    expect(html.match(/aria-label="运行中"/g)).toHaveLength(2);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain("default conversation");
    expect(html).toContain("pet conversation");
  });

});
