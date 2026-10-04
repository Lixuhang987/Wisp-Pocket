import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { threadHarness, input } from "../support/threadHarness.ts";
import { attachThreadSocketHandlers } from "../../src/server/server.ts";
import type { AgentMessage } from "@handagent/core/runtime/types/AgentMessage.ts";
import type { DynamicToolCallRequestPayload } from "@handagent/core/protocol/types/DynamicTool.ts";
import { ThreadTools } from "@handagent/core/thread/ThreadTools.ts";
import { ToolRegistry } from "@handagent/core/tools/ToolRegistry.ts";
import { AgentRuntime } from "@handagent/core/runtime/AgentRuntime.ts";
import { WebSocketDynamicToolBridge } from "../../src/bridges/WebSocketDynamicToolBridge.ts";
const echo = { complete: async (messages: AgentMessage[]) => ({ message: { role: "assistant" as const, content: `reply:${messages.at(-1)?.content}` } }) };
const wait = (check: () => void) => vi.waitFor(check, { timeout: 1500, interval: 5 });

describe("Thread ownership through public lifecycle", () => {
  it("keeps idle instances, converges concurrent loads and preserves multi-turn history", async () => {
    const contexts: AgentMessage[][] = [];
    const h = threadHarness({ complete: async (messages) => { contexts.push(structuredClone(messages)); return echo.complete(messages); } });
    try {
      const thread = await h.threads.create({ workspaceId: h.workspace.id,});
      expect(await h.threads.load(thread.id)).toBe(thread);
      await thread.submit(input("first"));
      await wait(() => expect(thread.status).toBe("idle"));
      expect(await Promise.all([h.threads.load(thread.id), h.threads.load(thread.id)])).toEqual([thread, thread]);
      await thread.submit(input("second"));
      await wait(() => expect(thread.snapshot().messages).toHaveLength(4));
      expect(contexts[1].filter((m) => m.role !== "system").map((m) => m.content)).toEqual(["first", "reply:first", "second"]);
    } finally { await h.close(); }
  });

  it("continues running after every UI socket disconnects and a new client sees saved output", async () => {
    const gate = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    const h = threadHarness({ complete: async (messages) => { entered.resolve(); await gate.promise; return echo.complete(messages); } });
    try {
      class Socket extends EventEmitter { send() {} }
      const socket = new Socket();
      attachThreadSocketHandlers(socket as never, { commandRouter: h.router, eventPublisher: h.publisher });
      const thread = await h.threads.create({ workspaceId: h.workspace.id,});
      socket.emit("message", JSON.stringify({ type: "op.submit", threadId: thread.id, commandId: "input", timestamp: "now", payload: { op: input("background") } }));
      await entered.promise;
      socket.emit("close");
      expect(thread.status).toBe("running");
      gate.resolve();
      await wait(() => expect(thread.status).toBe("idle"));
      expect((await h.persistence.getMessages(thread.id)).at(-1)?.content).toBe("reply:background");
      expect((await h.threads.load(thread.id)).snapshot().messages.at(-1)?.text).toBe("reply:background");
    } finally { gate.resolve(); await h.close(); }
  });

  it("persists before input acknowledgement and before successful completion", async () => {
    const h = threadHarness(echo);
    try {
      const thread = await h.threads.create({ workspaceId: h.workspace.id,});
      const gate = Promise.withResolvers<void>();
      const persist = h.persistence.persistNotifications.bind(h.persistence);
      vi.spyOn(h.persistence, "persistNotifications").mockImplementation(async (id, events) => {
        if (events.some((event) => event.type === "user.message.recorded")) await gate.promise;
        await persist(id, events);
      });
      const submitting = thread.submit(input("saved"));
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(h.events).toEqual([]);
      gate.resolve(); await submitting;
      await wait(() => expect(thread.status).toBe("idle"));
      expect((await h.persistence.getMessages(thread.id)).at(-1)?.content).toBe("reply:saved");
      expect(h.events.some((event) => event.type === "turn.completed" && event.payload.status === "completed")).toBe(true);
    } finally { await h.close(); }
  });

  it("pauses on failed persistence, reports without another write and reloads consistent history", async () => {
    const h = threadHarness(echo);
    try {
      const thread = await h.threads.create({ workspaceId: h.workspace.id,});
      const persist = vi.spyOn(h.persistence, "persistRunDelta").mockRejectedValue(new Error("disk full"));
      await thread.submit(input("one"));
      await wait(() => expect(thread.status).toBe("failed"));
      expect(h.events.some((event) => event.type === "thread.error" && event.payload.message === "disk full")).toBe(true);
      expect(h.events.some((event) => event.type === "turn.completed" && event.payload.status === "completed")).toBe(false);
      await expect(thread.submit(input("blocked"))).rejects.toThrow("保存失败");
      persist.mockRestore();
      await h.threads.load(thread.id);
      await thread.submit(input("after recovery"));
      await wait(() => expect(thread.status).toBe("idle"));
      expect((await h.persistence.getMessages(thread.id)).some((m) => m.content === "reply:one")).toBe(false);
      expect((await h.persistence.getMessages(thread.id)).at(-1)?.content).toBe("reply:after recovery");
    } finally { await h.close(); }
  });

  it("interrupts a non-cooperative model promptly and isolates late output", async () => {
    const gate = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    const h = threadHarness({ complete: async (messages) => { entered.resolve(); await gate.promise; return echo.complete(messages); } });
    try {
      const thread = await h.threads.create({ workspaceId: h.workspace.id,});
      await thread.submit(input("stop")); await entered.promise;
      await thread.interrupt();
      expect(thread.status).toBe("interrupted");
      gate.resolve();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const saved = await h.persistence.getMessages(thread.id);
      expect(saved.filter(message => message.role !== "system")).toHaveLength(1);
      expect(saved.some(message => message.role === "system" && "timeContext" in message)).toBe(true);
    } finally { gate.resolve(); await h.close(); }
  });

  it("interrupts a Thread while its external Tool is pending and ignores the late result", async () => {
    const entered = Promise.withResolvers<void>();
    const gate = Promise.withResolvers<string>();
    let completion = 0;
    const client = { complete: async () => ({message:{role:"assistant" as const,content:""},toolCalls:[{id:`call-${++completion}`,name:"test.pending",arguments:{}}]}) };
    const h = threadHarness(client, {
      createTools: () => new ThreadTools({resolveTools:()=>[{
        name:"test.pending",description:"等待外部任务",inputSchema:{type:"object"},requiresPermission:false,
        call:async()=>{entered.resolve();return gate.promise;},
      }]}),
    });
    try {
      const thread = await h.threads.create({workspaceId:h.workspace.id});
      await thread.submit(input("run then interrupt"));await entered.promise;
      await thread.interrupt();expect(thread.status).toBe("interrupted");
      const saved = await h.persistence.getMessages(thread.id);
      gate.resolve("late external completion");
      await new Promise(resolve=>setTimeout(resolve,10));
      expect(await h.persistence.getMessages(thread.id)).toEqual(saved);
      expect(thread.status).toBe("interrupted");expect(completion).toBe(1);
    } finally {gate.resolve("finished");await h.close();}
  });

  it("deletes an executing Thread, rejects new input and never recreates history from late results", async () => {
    const gate = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    const h = threadHarness({ complete: async (messages) => { entered.resolve(); await gate.promise; return echo.complete(messages); } });
    try {
      const thread = await h.threads.create({ workspaceId: h.workspace.id,});
      await thread.submit(input("delete")); await entered.promise;
      const deleting = h.threads.delete(thread.id);
      await expect(thread.submit(input("race"))).rejects.toThrow("closed");
      expect(await deleting).toBe(true);
      gate.resolve();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(await h.persistence.getThread(thread.id)).toBeNull();
      expect(h.threads.get(thread.id)).toBeUndefined();
      await expect(h.persistence.persistUserInput(thread.id, input("late").payload)).rejects.toThrow("not found");
    } finally { gate.resolve(); await h.close(); }
  });

  it("reports deletion failure through the protocol", async () => {
    const h = threadHarness(echo);
    try {
      // 已持久但尚未加载的历史：删除失败后仍可恢复，不能把存储故障误判为删除。
      const thread = (await h.persistence.createThread({ workspaceId: h.workspace.id })).metadata;
      h.publisher.attachConnection("ui", () => {});
      const deletion = vi.spyOn(h.persistence, "deleteThread").mockRejectedValue(new Error("cannot delete"));
      await h.router.receive({ type: "thread.delete", commandId: "delete", timestamp: "now", payload: { targetThreadId: thread.id } }, "ui");
      expect(h.events.at(-1)).toMatchObject({ type: "thread.error", payload: { message: "cannot delete" } });
      expect(await h.persistence.getThread(thread.id)).not.toBeNull();
      deletion.mockRestore();
      vi.spyOn(h.persistence, "getThread").mockRejectedValueOnce(new Error("database unavailable"));
      await h.router.receive({ type: "thread.resume", commandId: "resume-unavailable", timestamp: "now", threadId: thread.id }, "ui");
      expect(h.events.at(-1)).toMatchObject({ type: "thread.error", payload: { message: "database unavailable" } });
      expect(h.events.at(-1)!.payload).not.toHaveProperty("code");
      await h.router.receive({ type: "thread.resume", commandId: "resume-recovered", timestamp: "now", threadId: thread.id }, "ui");
      expect(h.events.at(-1)).toMatchObject({ type: "thread.snapshot", threadId: thread.id });
      await h.router.receive({ type: "thread.delete", commandId: "retry-delete", timestamp: "now", payload: { targetThreadId: thread.id } }, "ui");
      await h.router.receive({ type: "thread.resume", commandId: "resume-deleted", timestamp: "now", threadId: thread.id }, "ui");
      expect(h.events.at(-1)).toMatchObject({ type: "thread.error", payload: { code: "not_found" } });
    } finally { await h.close(); }
  });

  it("recovers saved history after backend restart without resuming an old turn", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thread-restart-"));
    const path = join(directory, "threads.sqlite");
    let now = "2026-10-04T09:00:00Z";
    const h = threadHarness(echo, { now: () => now }, path);
    const thread = await h.threads.create({ workspaceId: h.workspace.id,});
    const accepted = input("saved");
    await thread.submit(accepted); await wait(() => expect(thread.status).toBe("idle"));
    const firstSaved = await h.persistence.getThread(thread.id);
    expect(firstSaved!.messages.filter(message => message.role === "system")).toHaveLength(2);
    expect(firstSaved!.metadata.messageCount).toBe(2);
    await h.close();
    const complete = vi.fn(echo.complete);
    const restored = threadHarness({ complete }, { now: () => now }, path);
    try {
      const [a, b] = await Promise.all([restored.threads.load(thread.id), restored.threads.load(thread.id)]);
      expect(a).toBe(b); expect(a.snapshot().messages).toHaveLength(2); expect(complete).not.toHaveBeenCalled();
      await Promise.all([a.submit(accepted), b.submit(accepted)]);
      expect(complete).not.toHaveBeenCalled();
      expect((await restored.persistence.getMessages(thread.id)).filter(message => message.role === "user")).toHaveLength(1);
      now = "2026-10-04T10:00:00Z";
      await a.submit(input("next")); await wait(() => expect(a.status).toBe("idle"));
      expect(a.snapshot().messages).toHaveLength(4);
      const timeMessages = async () => (await restored.persistence.getMessages(thread.id)).filter(message => message.role === "system" && "timeContext" in message);
      expect(await timeMessages()).toHaveLength(1);
      now = "2026-10-04T10:00:01Z";
      await a.submit(input("after an hour")); await wait(() => expect(a.status).toBe("idle"));
      expect(await timeMessages()).toHaveLength(2);
      expect((await timeMessages()).at(-1)).toMatchObject({ timeContext: { timestamp: new Date(now).toISOString() }, content: expect.stringContaining("3601") });
      now = "2026-10-04T10:50:00Z";
      await a.submit(input("still active")); await wait(() => expect(a.status).toBe("idle"));
      expect(await timeMessages()).toHaveLength(2);
      now = "2026-10-04T11:00:02Z";
      await a.submit(input("another elapsed hour")); await wait(() => expect(a.status).toBe("idle"));
      expect(await timeMessages()).toHaveLength(3);
      expect(a.snapshot().messages).toHaveLength(10);
      expect((await restored.persistence.getThread(thread.id))!.metadata.messageCount).toBe(10);
    } finally { await restored.close(); await rm(directory, { recursive: true, force: true }); }
  });
});

it.each(["input", "context", "completion"])("honors interrupt while %s persistence is delayed", async (phase) => {
  const complete = vi.fn(echo.complete);
  const h = threadHarness({ complete });
  const gate = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  try {
    const thread = await h.threads.create({ workspaceId: h.workspace.id,});
    const persist = h.persistence.persistNotifications.bind(h.persistence);
    vi.spyOn(h.persistence, "persistNotifications").mockImplementation(async (id, events) => {
      if (events.some((event) => phase === "input" ? event.type === "user.message.recorded" : event.type === "turn.completed" && event.payload.status === "completed")) {
        entered.resolve(); await gate.promise;
      }
      await persist(id, events);
    });
    if (phase === "context") {
      const save = h.persistence.persistRunDelta.bind(h.persistence);
      vi.spyOn(h.persistence, "persistRunDelta").mockImplementation(async (id, base, messages, ...rest) => {
        if (messages.some(message => message.role === "system")) { entered.resolve(); await gate.promise; }
        await save(id, base, messages, ...rest);
      });
    }
    const submitting = thread.submit(input("interrupt during save"));
    await entered.promise;
    const stopping = thread.interrupt();
    gate.resolve(); await submitting; await stopping;
    expect(thread.status).toBe("interrupted");
    expect(h.events.some((event) => event.type === "turn.completed" && event.payload.status === "completed")).toBe(false);
    if (phase !== "completion") expect(complete).not.toHaveBeenCalled();
    if (phase === "context") {
      await thread.submit(input("continue after interrupted save"));
      await wait(() => expect(thread.status).toBe("idle"));
      const saved = await h.persistence.getMessages(thread.id);
      expect(saved.filter(message => message.role === "system")).toHaveLength(2);
    }
  } finally { gate.resolve(); await h.close(); }
});

it("queues inputs during execution, preserves their order and isolates other Threads", async () => {
  const gate = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const h = threadHarness({ complete: async (messages) => {
    if (messages.at(-1)?.content === "first") { entered.resolve(); await gate.promise; }
    return echo.complete(messages);
  } });
  try {
    const a = await h.threads.create({ workspaceId: h.workspace.id,}); const b = await h.threads.create({ workspaceId: h.workspace.id,});
    await a.submit(input("first")); await entered.promise;
    await a.submit(input("second")); await a.submit(input("third"));
    await b.submit(input("other")); await wait(() => expect(b.status).toBe("idle"));
    gate.resolve(); await wait(() => expect(a.status).toBe("idle"));
    expect(a.snapshot().messages.map((message) => message.text)).toEqual(["first", "second", "third", "reply:first", "reply:second", "reply:third"]);
    expect(b.snapshot().messages.map((message) => message.text)).toEqual(["other", "reply:other"]);
  } finally { gate.resolve(); await h.close(); }
});

it("saves system context before a failing model and replaces or clears project rules on later turns", async () => {
  const directory = await mkdtemp(join(tmpdir(), "thread-system-context-"));
  const requests: AgentMessage[][] = [];
  let threadId = "";
  const h = threadHarness({ complete: async messages => {
    requests.push(structuredClone(messages));
    const saved = await h.persistence.getMessages(threadId);
    expect(saved.some(message => message.role === "system" && "timeContext" in message)).toBe(true);
    expect(saved.some(message => message.role === "system" && "promptSection" in message)).toBe(true);
    if (requests.length === 1) throw new Error("model unavailable");
    return echo.complete(messages);
  } }, { now: () => "2026-10-04T09:00:00Z" });
  try {
    await writeFile(join(directory, "AGENTS.md"), "PROJECT_RULE_ONE");
    const { workspace } = await h.workspaces.create(directory);
    const thread = await h.threads.create({ workspaceId: workspace.id }); threadId = thread.id;
    await thread.submit(input("first")); await wait(() => expect(thread.status).toBe("failed"));
    await writeFile(join(directory, "AGENTS.md"), "PROJECT_RULE_TWO");
    await thread.submit(input("second")); await wait(() => expect(thread.status).toBe("idle"));
    expect(JSON.stringify(requests[1])).toContain("PROJECT_RULE_TWO");
    expect(JSON.stringify(requests[1])).not.toContain("PROJECT_RULE_ONE");
    await unlink(join(directory, "AGENTS.md"));
    await thread.submit(input("third")); await wait(() => expect(thread.status).toBe("idle"));
    expect(JSON.stringify(requests[2])).not.toContain("PROJECT_RULE_TWO");
    expect(thread.snapshot().messages.every(message => message.role !== "system")).toBe(true);
    const saved = await h.persistence.getMessages(threadId);
    expect(saved.filter(message => message.role === "system" && "timeContext" in message)).toHaveLength(1);
    expect(saved.some(message => message.role === "system" && message.content.includes("PROJECT_RULE_ONE"))).toBe(true);
    expect(saved.some(message => message.role === "system" && message.content.includes("PROJECT_RULE_TWO"))).toBe(true);
  } finally { await h.close(); await rm(directory, { recursive: true, force: true }); }
});
