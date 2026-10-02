import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ThreadWindowState } from "../src/store/threadWindowStore.ts";

const timestamp = "2026-06-09T00:00:00.000Z";

const mockState: Pick<
  ThreadWindowState,
  "history" | "pets" | "expandedPetIds" | "searchQuery" | "setSearchQuery" | "togglePetExpanded" | "threadsById"
> = {
  history: [],
  pets: [
    {description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",
      id: "pet-1",
      name: "Project pet",
      rootPath: "/tmp/project",
    },
  ],
  expandedPetIds: new Set(["pet-1"]),
  searchQuery: "",
  setSearchQuery: vi.fn(),
  togglePetExpanded: vi.fn(),
  threadsById: {},
};

vi.mock("../src/store/threadWindowStore.ts", () => ({
  createThreadWindowStore: <T,>(selector: (state: typeof mockState) => T) => selector(mockState),
}));

const { HistorySidebar } = await import("../src/components/HistorySidebar.tsx");

describe("HistorySidebar", () => {
  beforeEach(() => {
    mockState.history = [];
    mockState.pets = [
      {description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",
        id: "pet-1",
        name: "Project pet",
        rootPath: "/tmp/project",
      },
    ];
    mockState.expandedPetIds = new Set(["pet-1"]);
    mockState.searchQuery = "";
    mockState.setSearchQuery = vi.fn();
    mockState.togglePetExpanded = vi.fn();
    mockState.threadsById = {};
  });

  it("provides Radix Accordion context for pet groups", () => {
    const html = renderToStaticMarkup(
      React.createElement(HistorySidebar, {
        activeThreadId: null,
        onOpenThread: vi.fn(),
        onDeleteThread: vi.fn(),
        onNewThread: vi.fn(),
      }),
    );

    expect(html).toContain("Project pet");
    // rootPath is no longer displayed for simplified UI
  });

  it("renders pet groups alphabetically without merging identical roots", () => {
    mockState.pets = [
      {description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",  id: "default", name: "default", rootPath: "/default" },
      {description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",  id: "tmp", name: "tmp", rootPath: "/tmp" },
      {description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",  id: "qa-pet", name: "qa-pet", rootPath: "/qa" },
      {description:"", rolePrompt:"Help", revision:1, imageRef:{type:"builtin",id:"yachiyo"}, isDefault:false, createdAt:"2026", updatedAt:"2026",  id: "handagent-test", name: "handagent-test", rootPath: "/handagent" },
    ];
    mockState.expandedPetIds = new Set(["tmp", "qa-pet", "handagent-test"]);
    mockState.history = [
      {petRevision:1, rootPath:"/tmp/pet", status:"idle",
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
  });

  it("marks the active thread without selected border or background styling", () => {
    mockState.history = [
      {petRevision:1, rootPath:"/tmp/pet", status:"idle",
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

    expect(html).toContain('aria-current="page"');
    const activeThreadRow = html.match(/<div role="button"[^>]*aria-current="page"[^>]*>/)?.[0] ?? "";
    expect(activeThreadRow).not.toContain("bg-app-canvas");
    expect(activeThreadRow).not.toContain("border-app-accent");
    expect(activeThreadRow).toContain("bg-app-accent-subtle");
    expect(activeThreadRow).not.toContain("focus:ring-4");
    expect(activeThreadRow).toContain("focus-visible:ring-4");
  });

  it("renders the shared running thread indicator in pet and default groups", () => {
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
      {petRevision:1, rootPath:"/tmp/pet", status:"idle",
        id: "thread-pet",
        preview: "pet conversation",
        petId: "pet-1",
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 1,
      },
      {petRevision:1, rootPath:"/tmp/pet", status:"idle",
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
        activeThreadId: null,
        onOpenThread: vi.fn(),
        onDeleteThread: vi.fn(),
        onNewThread: vi.fn(),
      }),
    );

    expect(html.match(/aria-label="运行中"/g)).toHaveLength(2);
    expect(html).toContain("animate-ping");
  });

  it("switches folder icon shapes between collapsed and expanded pet states", () => {
    mockState.history = [
      {petRevision:1, rootPath:"/tmp/pet", status:"idle",
        id: "thread-pet",
        preview: "pet conversation",
        petId: "pet-1",
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 1,
      },
    ];

    mockState.expandedPetIds = new Set(["pet-1"]);
    const expandedHtml = renderToStaticMarkup(
      React.createElement(HistorySidebar, {
        activeThreadId: null,
        onOpenThread: vi.fn(),
        onDeleteThread: vi.fn(),
        onNewThread: vi.fn(),
      }),
    );

    mockState.expandedPetIds = new Set();
    const collapsedHtml = renderToStaticMarkup(
      React.createElement(HistorySidebar, {
        activeThreadId: null,
        onOpenThread: vi.fn(),
        onDeleteThread: vi.fn(),
        onNewThread: vi.fn(),
      }),
    );

    expect(expandedHtml).toContain("lucide-folder-open");
    expect(collapsedHtml).not.toContain("lucide-folder-open");
    expect(collapsedHtml).toContain("lucide-folder");
  });
});
