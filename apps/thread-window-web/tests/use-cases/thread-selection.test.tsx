// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";
import type { InitialPromptPayload, ThreadCommand, ThreadNotification } from "../../src/protocol/threadProtocol.ts";
import { createThreadWindowStore } from "../../src/store/threadWindowStore.ts";

const timestamp = "2026-09-14T04:00:00.000Z";
const reviewSkill = { actionId: "review/code", title: "Review", prompt: "Review this code" };
let notificationSequence = 0;

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(message: string): void { this.sent.push(message); }
  close(): void { this.readyState = 3; this.onclose?.(); }
  open(): void { act(() => { this.readyState = 1; this.onopen?.(); }); }
  receive(notification: ThreadNotification): void {
    act(() => { this.onmessage?.({ data: JSON.stringify(notification) }); });
  }
  commands(): ThreadCommand[] { return this.sent.map((raw) => JSON.parse(raw) as ThreadCommand); }
}

function started(threadId: string, preview: string, commandId?: string): ThreadNotification {
  return {
    type: "thread.started", threadId,
    notificationId: `started-${++notificationSequence}`, timestamp,
    ...(commandId ? { commandId } : {}),
    payload: { preview },
  };
}

function receiveSnapshot(socket: FakeWebSocket, threadId: string, text: string): void {
  socket.receive({
    type: "thread.snapshot", threadId,
    notificationId: `snapshot-${++notificationSequence}`, timestamp,
    payload: { status: "idle", messages: [{
      id: `message-${threadId}`, role: "assistant", text, status: "completed",
      createdAt: timestamp, updatedAt: timestamp,
    }] },
  });
}

function mountApp() {
  const view = render(<App />);
  const socket = FakeWebSocket.instances.at(-1)!;
  socket.open();
  return { ...view, socket };
}

function threadRow(preview: string): HTMLElement {
  return screen.getByText(preview).closest<HTMLElement>('[role="button"]')!;
}

function workspace() { return within(screen.getByRole("region", { name: "Thread workspace" })); }
function composer() { return workspace().getByRole<HTMLTextAreaElement>("textbox"); }

function openThreadA(socket: FakeWebSocket): void {
  socket.receive({
    type: "thread.listed", notificationId: `list-${++notificationSequence}`, timestamp,
    payload: { threads: [{
      id: "thread-a", preview: "Thread A", messageCount: 1, createdAt: timestamp, updatedAt: timestamp,
    }] },
  });
  fireEvent.click(threadRow("Thread A"));
  receiveSnapshot(socket, "thread-a", "History A");
}

function startBlankThread(socket: FakeWebSocket): string {
  fireEvent.click(screen.getByRole("button", { name: "新建对话" }));
  return socket.commands().filter((command) => command.type === "thread.start").at(-1)!.commandId;
}

describe("ThreadWindow selection intent", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    notificationSequence = 0;
    localStorage.clear();
    createThreadWindowStore.setState(createThreadWindowStore.getInitialState(), true);
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    window.handAgentThreadWindowConfig = { availableSkills: [reviewSkill] };
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete window.handAgentThreadWindowConfig;
    delete window.handAgentReceiveInitialPrompt;
    delete window.handAgentPendingInitialPrompts;
    delete window.handAgentReceiveThreadOpen;
    delete window.handAgentPendingThreadOpens;
  });

  it.each(["background-client", undefined])("keeps A's messages, structured draft and submit target when another client creates a Thread (%s)", (commandId) => {
    const { socket } = mountApp();
    openThreadA(socket);
    fireEvent.change(composer(), { target: { value: "/review" } });
    fireEvent.keyDown(composer(), { key: "Tab" });
    fireEvent.change(composer(), { target: { value: "Draft A" } });
    expect(workspace().getByRole("button", { name: /^移除 .*Review$/ })).toBeTruthy();

    socket.receive(started("thread-b", "Background B", commandId));

    expect(threadRow("Thread A").getAttribute("aria-current")).toBe("page");
    expect(threadRow("Background B").getAttribute("aria-current")).toBeNull();
    expect(workspace().getByText("History A")).toBeTruthy();
    expect(composer().value).toBe("Draft A");
    expect(workspace().getByRole("button", { name: /^移除 .*Review$/ })).toBeTruthy();

    fireEvent.click(workspace().getByTitle("发送"));
    expect(socket.commands().filter((command) => command.type === "op.submit")).toMatchObject([{
      threadId: "thread-a", payload: { op: { type: "user_input", payload: { items: [
        { type: "skill", ...reviewSkill }, { type: "text", text: "Draft A" },
      ] } } },
    }]);
    expect(composer().value).toBe("");
  });

  it("lists a background Thread while keeping the empty workspace until the user opens it", () => {
    const { socket } = mountApp();
    socket.receive(started("thread-b", "Background B", "background-client"));

    expect(workspace().getByText("选择历史或创建新对话")).toBeTruthy();
    expect(threadRow("Background B").getAttribute("aria-current")).toBeNull();
    fireEvent.click(threadRow("Background B"));
    receiveSnapshot(socket, "thread-b", "History B");
    expect(threadRow("Background B").getAttribute("aria-current")).toBe("page");
    expect(workspace().getByText("History B")).toBeTruthy();
    expect(socket.commands().filter((command) => command.type === "thread.resume")).toMatchObject([
      { threadId: "thread-b" },
    ]);
  });

  it("selects a locally created blank Thread once despite interleaved background and duplicate replies", () => {
    const { socket } = mountApp();
    openThreadA(socket);
    fireEvent.change(composer(), { target: { value: "Draft A" } });
    const commandId = startBlankThread(socket);
    socket.receive(started("thread-b", "Background B", "background-client"));
    expect(composer().value).toBe("Draft A");

    const ownReply = started("thread-c", "Local C", commandId);
    socket.receive(ownReply);
    expect(threadRow("Local C").getAttribute("aria-current")).toBe("page");
    expect(composer().value).toBe("");
    fireEvent.click(threadRow("Thread A"));
    socket.receive(ownReply);
    expect(threadRow("Thread A").getAttribute("aria-current")).toBe("page");
    expect(composer().value).toBe("Draft A");
    expect(workspace().getByText("History A")).toBeTruthy();
  });

  it.each(["blank", "initial-prompt"])("clears a failed %s creation intent while allowing a new local creation", (kind) => {
    const { socket } = mountApp();
    openThreadA(socket);
    let commandId: string;
    if (kind === "blank") {
      commandId = startBlankThread(socket);
    } else {
      commandId = "failed-prompt";
      act(() => window.handAgentReceiveInitialPrompt!({
        clientRequestId: commandId, userInput: { items: [{ type: "text", id: "input", text: "hello" }] },
      }));
    }
    socket.receive({
      type: "thread.error", notificationId: "creation-error", commandId, timestamp,
      payload: { message: "Thread creation failed" },
    });
    expect(workspace().getByText("Thread creation failed")).toBeTruthy();
    socket.receive(started("thread-failed", "Late failed Thread", commandId));
    expect(threadRow("Thread A").getAttribute("aria-current")).toBe("page");

    const retryId = startBlankThread(socket);
    socket.receive(started("thread-retry", "Retry", retryId));
    expect(threadRow("Retry").getAttribute("aria-current")).toBe("page");
  });

  it("selects the fallback initial-prompt Thread and sends its original payload only once", () => {
    const prompt: InitialPromptPayload = {
      clientRequestId: "fallback-prompt", userInput: { items: [
        { type: "text", id: "input", text: "Fallback input" },
        { type: "text_selection", id: "selection", text: "Selected context" },
      ] },
    };
    window.handAgentPendingInitialPrompts = [prompt];
    const { socket } = mountApp();
    const ownReply = started("thread-prompt", "Fallback Thread", prompt.clientRequestId);
    socket.receive(started("thread-b", "Background B", "background-client"));
    socket.receive(ownReply);
    receiveSnapshot(socket, "thread-prompt", "Fallback reply");

    expect(threadRow("Fallback Thread").getAttribute("aria-current")).toBe("page");
    expect(workspace().getByText("Fallback reply")).toBeTruthy();
    expect(socket.commands().filter((command) => ["thread.start", "thread.resume", "op.submit"].includes(command.type))).toMatchObject([
      { type: "thread.start", commandId: prompt.clientRequestId },
      { type: "thread.resume", threadId: "thread-prompt" },
      { type: "op.submit", threadId: "thread-prompt", payload: { op: { opId: prompt.clientRequestId, payload: prompt.userInput } } },
    ]);
    fireEvent.click(threadRow("Background B"));
    socket.receive(ownReply);
    expect(threadRow("Background B").getAttribute("aria-current")).toBe("page");
    expect(socket.commands().filter((command) => command.type === "op.submit")).toHaveLength(1);
  });

  it("opens an explicit native target, resumes it and restores A's draft when returning", () => {
    const { socket } = mountApp();
    openThreadA(socket);
    fireEvent.change(composer(), { target: { value: "Draft A" } });
    expect(window.handAgentReceiveThreadOpen).toBeTypeOf("function");

    act(() => window.handAgentReceiveThreadOpen!("thread-native"));
    expect(workspace().getByText("等待输入")).toBeTruthy();
    receiveSnapshot(socket, "thread-native", "Native target reply");
    expect(workspace().getByText("Native target reply")).toBeTruthy();
    fireEvent.change(composer(), { target: { value: "Follow up native target" } });
    fireEvent.click(workspace().getByTitle("发送"));
    expect(socket.commands().filter((command) => command.type === "thread.resume")).toMatchObject([
      { threadId: "thread-a" }, { threadId: "thread-native" },
    ]);
    expect(socket.commands().filter((command) => command.type === "op.submit")).toMatchObject([
      { threadId: "thread-native" },
    ]);
    expect(socket.commands().filter((command) => command.type === "thread.start")).toEqual([]);

    fireEvent.click(threadRow("Thread A"));
    expect(composer().value).toBe("Draft A");
    expect(workspace().getByText("History A")).toBeTruthy();
  });

  it("delivers an early native target after mount and queues its resume until the socket opens", () => {
    window.handAgentPendingThreadOpens = ["thread-native"];
    render(<App />);
    const socket = FakeWebSocket.instances.at(-1)!;
    expect(workspace().getByText("等待输入")).toBeTruthy();
    expect(socket.sent).toEqual([]);
    socket.open();
    receiveSnapshot(socket, "thread-native", "Early native reply");

    expect(workspace().getByText("Early native reply")).toBeTruthy();
    expect(socket.commands().map((command) => command.type)).toEqual([
      "thread.resume", "workspace.list", "thread.list",
    ]);
    expect(window.handAgentPendingThreadOpens).toEqual([]);
  });

  it("releases native receivers and pending selection when the renderer unmounts", () => {
    const first = mountApp();
    const commandId = startBlankThread(first.socket);
    first.unmount();
    expect(first.socket.readyState).toBe(3);
    expect(window.handAgentReceiveThreadOpen).toBeUndefined();
    expect(window.handAgentReceiveInitialPrompt).toBeUndefined();

    const second = mountApp();
    second.socket.receive(started("thread-late", "Late old renderer Thread", commandId));
    expect(workspace().getByText("选择历史或创建新对话")).toBeTruthy();
    expect(threadRow("Late old renderer Thread").getAttribute("aria-current")).toBeNull();
  });
});
