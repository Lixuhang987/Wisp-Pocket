import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ThreadWindowState } from "../src/store/threadWindowStore.ts";

const timestamp = "2026-06-09T00:00:00.000Z";

const mockState: Pick<
  ThreadWindowState,
  "history" | "workspaces" | "pets" | "expandedWorkspaceIds" | "searchQuery" | "setSearchQuery" | "toggleWorkspaceExpanded" | "threadsById"
> = {
  history: [],
  workspaces: [{id:"workspace-1",name:"Project",rootPath:"/tmp/project",createdAt:timestamp}],
  pets: [
    {workspaceId:"workspace-1",description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",
      id: "pet-1",
      name: "Project pet",
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
    mockState.workspaces = [{id:"workspace-1",name:"Project",rootPath:"/tmp/project",createdAt:timestamp}];
    mockState.pets = [
      {workspaceId:"workspace-1",description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",
        id: "pet-1",
        name: "Project pet",
        rootPath: "/tmp/project",
      },
    ];
    mockState.expandedWorkspaceIds = new Set(["workspace-1"]);
    mockState.searchQuery = "";
    mockState.setSearchQuery = vi.fn();
    mockState.toggleWorkspaceExpanded = vi.fn();
    mockState.threadsById = {};
  });

  it("renders all projects alphabetically and groups different pets under one project", () => {
    mockState.pets = [
      {workspaceId:"workspace-1",description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",  id: "default", name: "default", rootPath: "/default" },
      {workspaceId:"workspace-1",description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",  id: "tmp", name: "tmp", rootPath: "/tmp" },
      {workspaceId:"workspace-1",description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",  id: "qa-pet", name: "qa-pet", rootPath: "/qa" },
      {workspaceId:"workspace-1",description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",  id: "handagent-test", name: "handagent-test", rootPath: "/handagent" },
    ];
    mockState.workspaces = mockState.pets.map(p => ({id:p.id,name:p.name,rootPath:p.rootPath,createdAt:timestamp}));
    mockState.expandedWorkspaceIds = new Set(["tmp", "qa-pet", "handagent-test"]);
    mockState.history = [
      {workspaceId:"workspace-1",petRevision:1, rootPath:"/tmp/pet", status:"idle",
        id: "thread-default",
        preview: "default conversation",
        petId: "pet-1",
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 1,
      },
      {workspaceId:"tmp",petId:"another-pet",petRevision:1,rootPath:"/tmp",status:"idle",id:"thread-second",preview:"another partner conversation",createdAt:timestamp,updatedAt:timestamp,messageCount:1},
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
      {workspaceId:"workspace-1",petRevision:1, rootPath:"/tmp/pet", status:"idle",
        id: "thread-pet",
        preview: "pet conversation",
        petId: "pet-1",
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 1,
      },
      {workspaceId:"workspace-1",petRevision:1, rootPath:"/tmp/pet", status:"idle",
        id: "thread-default",
        preview: "default conversation",
        petId: "pet-1",
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
