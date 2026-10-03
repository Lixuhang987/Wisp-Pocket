import { EventEmitter } from "node:events";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilesystemBlobStore } from "@handagent/core/adapters/filesystem/FilesystemBlobStore.ts";
import { AgentRuntime } from "@handagent/core/runtime/AgentRuntime.ts";
import type { AgentMessage } from "@handagent/core/runtime/types/AgentMessage.ts";
import type { LLMClientLike, LLMCompletion } from "@handagent/core/llm/LLMClient.ts";
import type { InputItem } from "@handagent/core/protocol/types/Op.ts";
import { ThreadRegistry } from "@handagent/core/thread/ThreadRegistry.ts";
import { ThreadTools } from "@handagent/core/thread/ThreadTools.ts";
import { ToolRegistry } from "@handagent/core/tools/ToolRegistry.ts";
import type { AgentTool } from "@handagent/core/tools/types/AgentTool.ts";
import { ThreadStore } from "@handagent/thread-store/index.ts";
import { PetThreadController } from "../../../electron-shell/src/activity-window/petThreadController.ts";
import { attachThreadSocketHandlers, attachDynamicToolSocketHandlers } from "../../src/server/server.ts";
import { WebSocketDynamicToolBridge } from "../../src/bridges/WebSocketDynamicToolBridge.ts";
import { ThreadSocketClient } from "../../../thread-window-web/src/thread/threadSocketClient.ts";
import { ThreadInputController } from "../../../thread-window-web/src/thread/threadInputController.ts";
import { makeThreadWindowStore } from "../../../thread-window-web/src/store/threadWindowStore.ts";
import { encodePermissionAnswer } from "../../../thread-window-web/src/protocol/threadProtocol.ts";
import { ThreadCommandRouter } from "../../src/thread/ThreadCommandRouter.ts";
import { ThreadNotificationPublisher } from "../../src/thread/ThreadNotificationPublisher.ts";
import { ThreadPersistence } from "../../src/thread/ThreadPersistence.ts";
import { PetRegistry } from "@handagent/core/pet/PetRegistry.ts";
import { pathInput } from "../../../electron-shell/src/activity-window/readDroppedItems.ts";
import * as projection from "../../src/protocol/MessageTranslator.ts";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
const until = (assertion: () => void) => vi.waitFor(assertion, { timeout: 5000, interval: 10 });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1XkAAAAASUVORK5CYII=", "base64");
const textItem = (text: string): InputItem => ({ type: "text", id: crypto.randomUUID(), text });
const answer = (content: string): LLMCompletion => ({ message: { role: "assistant", content } });
const ask = (message = "资料已经读完。想怎么继续？"): LLMCompletion => ({
  message: { role: "assistant", content: "" },
  toolCalls: [{ id: crypto.randomUUID(), name: "user.ask", arguments: { message, suggestedReplies: ["请整理这份资料", "先解释重点"] } }],
});

// A real one-page PDF, including xref offsets, exercises the production PDF parser.
function textPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 40 100 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(content)); content += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(content);
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  content += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(content);
}

async function harness(client: LLMClientLike, options: {
  directory?: string; pageError?: string; gate?: Promise<void>;
  dynamicBridge?: WebSocketDynamicToolBridge; permissionPrompt?: boolean; extraTools?: AgentTool[];
} = {}) {
  const directory = options.directory ?? await mkdtemp(join(tmpdir(), "pet-conversation-"));
  if (!options.directory) cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const blobs = new FilesystemBlobStore({ rootPath: join(directory, "blobs") });
  const store = new ThreadStore({ dbPath: join(directory, "threads.sqlite") });
  const persistence = new ThreadPersistence(store, undefined, blobs);
  const publisher = new ThreadNotificationPublisher();
  const reads: string[] = [];
  const pets = new PetRegistry(store);
  const petConfig = await pets.ensureDefault(join(directory,"files"));
  const executedPath = join(directory, "executed.txt");
  const tools = new ToolRegistry([{
    name: "test.execute", description: "整理用户明确决定处理的资料", inputSchema: { type: "object", properties: {} },
    requiresPermission: false,
    async call() { await options.gate; await writeFile(executedPath, "用户决定后的执行结果"); return { saved: true }; },
  }, ...(options.extraTools ?? [])]);
  const threads = new ThreadRegistry({
    storage: persistence,
    projection: { runtimeMessages: projection.agentMessagesToRuntimeMessages, conversation: projection.agentMessagesToConversation,
      notification: projection.toThreadNotification, audit: projection.toAuditEvent, summarizeInput: projection.summarizeUserInput },
    publish: (event) => publisher.publish(event),
    createTools: (dynamicTools) => new ThreadTools({ builtinRegistry: tools, globalMcpServerIds: [], listMcpTools: async () => [], exposeBuiltinToolsBeforeActivation: true, dynamicToolBridge: options.dynamicBridge }, dynamicTools),
    createRuntime: (id, threadTools) => new AgentRuntime(client, threadTools.registry, {
      blobStore: blobs, maxTimes: 8,
      onMetaToolActivate: () => threadTools.activate(), isThreadActivated: () => threadTools.isActivated(),
      ...(options.permissionPrompt ? { permissionPolicy: {
        check: async () => "ask" as const,
        resolveAsk: (request) => threads.get(id)!.requests.askPermission(request),
        remember: async () => {},
      } } : {}),
    }),
    stopTimeoutMs: 20,
  });
  const router = new ThreadCommandRouter(threads, publisher, pets, undefined, () => options.dynamicBridge?.availableTools() ?? []);
  const sockets = new Set<LocalSocket>();
  class LocalSocket {
    readyState = 0;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    private readonly server = new EventEmitter() as EventEmitter & { send(data: string): void };
    constructor(_url: string) {
      sockets.add(this);
      this.server.send = (data) => { if (this.readyState === 1) this.onmessage?.({ data }); };
      attachThreadSocketHandlers(this.server as never, { commandRouter: router, eventPublisher: publisher, acceptServerRequests: true });
      queueMicrotask(() => { this.readyState = 1; this.onopen?.(); });
    }
    send(data: string) { this.server.emit("message", Buffer.from(data)); }
    close() { this.readyState = 3; this.server.emit("close"); this.onclose?.(); sockets.delete(this); }
  }
  const pet = new PetThreadController({ petId: petConfig.id, url: "ws://local/api/thread?acceptServerRequests=1", WebSocketImpl: LocalSocket });
  pet.connect();
  await until(() => expect(pet.getSnapshot().connection).toBe("connected"));
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true; pet.disconnect(); for (const socket of sockets) socket.close(); await threads.close(); store.close();
  };
  cleanups.push(close);
  return { petConfig, pets, directory, blobs, store, persistence, threads, publisher, router, pet, reads, executedPath, close, LocalSocket };
}

function decisionClient(contexts: AgentMessage[][] = []): LLMClientLike {
  return { complete: async (messages, tools, options) => {
    contexts.push(structuredClone(messages));
    if (messages.at(-1)?.role === "tool" && (messages.at(-1) as { name?: string }).name === "test.execute") return answer("已按你的决定整理好了。");
    const latest = messages.findLast((message) => message.role === "user");
    if (latest?.content === "请整理这份资料") return { message: { role: "assistant", content: "开始整理。" }, toolCalls: [{ id: crypto.randomUUID(), name: "test.execute", arguments: {} }] };
    if (latest?.content === "待处理资料" || latest?.content === "交付内容") return ask();
    return answer(`收到你的回复：${typeof latest?.content === "string" ? latest.content : "图片"}`);
  } };
}

function current(h: Awaited<ReturnType<typeof harness>>) {
  const id = h.pet.getSnapshot().threadId;
  expect(id).toBeTruthy();
  return h.threads.get(id!)!;
}

async function settled(h: Awaited<ReturnType<typeof harness>>) {
  await until(() => { expect(current(h).status).toBe("idle"); expect(h.pet.getSnapshot().latestAssistant?.text).toBeTruthy(); });
}

describe("桌宠入口 → 真实 Thread → 持久化 → 桌宠消息", () => {
  it("空白回复框首次文字创建 Thread 并持久保存，后续文字继续同一对话", async () => {
    const h = await harness(decisionClient());
    h.pet.revealBubble();
    expect(h.pet.getSnapshot()).toMatchObject({ threadId: null, bubbleVisible: true });
    expect(h.pet.store.getState().history).toHaveLength(0);
    await h.pet.respond("帮我安排阅读");
    await settled(h);
    const id = current(h).id;
    const saved = await h.persistence.getThread(id);
    expect(saved!.messages.find((message) => message.role === "user")?.content).toBe("帮我安排阅读");
    expect(h.pet.getSnapshot().latestAssistant?.text).toContain("帮我安排阅读");
    h.pet.respond("再补充十分钟");
    await until(() => expect(h.pet.getSnapshot().latestAssistant?.text).toContain("再补充十分钟"));
    expect(current(h).id).toBe(id);
    expect(h.pet.store.getState().history).toHaveLength(1);
  });

  it.each(["online", "reconnect"])("完整窗口删除当前 Thread 后，桌宠 %s 回到仍存在的最新历史", async (connection) => {
    const h = await harness(decisionClient());
    h.pet.drop([textItem("第一份资料")], "pet"); await settled(h);
    const a = current(h).id;
    h.pet.drop([textItem("第二份资料")], "pet");
    await until(() => expect(current(h).id).not.toBe(a)); await settled(h);
    const b = current(h).id;
    if (connection === "reconnect") h.pet.disconnect();
    const deletingUI = new h.LocalSocket("ws://local/api/thread");
    await until(() => expect(deletingUI.readyState).toBe(1));
    deletingUI.send(JSON.stringify({ type: "thread.delete", commandId: "delete-from-full-window", timestamp: new Date().toISOString(), payload: { targetThreadId: b } }));
    await vi.waitFor(async () => expect(await h.persistence.getThread(b)).toBeNull());
    if (connection === "reconnect") h.pet.connect();
    await until(() => expect(h.pet.getSnapshot().threadId).toBe(a));
    expect(h.pet.store.getState().history.map((thread) => thread.id)).not.toContain(b);
    expect(await h.persistence.getThread(b)).toBeNull();
    h.pet.respond("继续第一份资料");
    await until(() => expect(h.pet.getSnapshot().latestAssistant?.text).toContain("继续第一份资料"));
  });

  it("用户决定后沿在线 Provider 执行真实 CLI；两界面竞争回答权限只执行一次", async () => {
    const bridge = new WebSocketDynamicToolBridge();
    cleanups.push(async () => bridge.close());
    const provider = new EventEmitter() as EventEmitter & { send: (data: string) => void };
    let calls = 0;
    let executedPath = "";
    provider.send = (data) => {
      const message = JSON.parse(data);
      if (message.type !== "tool_call_request") return;
      calls += 1;
      execFileSync(process.execPath, ["-e", "require('node:fs').writeFileSync(process.argv[1], 'CLI completed after user decision')", executedPath]);
      provider.emit("message", Buffer.from(JSON.stringify({ channel: "dynamic_tools", type: "tool_call_response",
        payload: { callId: message.payload.callId, success: true, contentItems: [{ type: "inputText", text: "CLI completed" }] } })));
    };
    attachDynamicToolSocketHandlers(provider as never, { bridge });
    provider.emit("message", Buffer.from(JSON.stringify({ channel: "dynamic_tools", type: "provider_hello", clientId: "qa-host", tools: [] })));
    provider.emit("message", Buffer.from(JSON.stringify({ channel: "dynamic_tools", type: "provider_hello", clientId: "qa-host", tools: [
      { clientId: "qa-host", namespace: "host", name: "cli", description: "执行用户已决定的整理", inputSchema: { type: "object", properties: {} } },
    ] })));
    const h = await harness({ complete: async (messages, tools) => {
      if (messages.findLast(message=>message.role==="user")?.content === "交付内容") return ask();
      if (messages.at(-1)?.role === "tool" && (messages.at(-1) as { name: string }).name === "host.cli") return answer("CLI 已按你的决定完成。");
      return { message: { role: "assistant", content: "" }, toolCalls: [{ id: crypto.randomUUID(), name: tools.some((tool) => tool.name === "host.cli") ? "host.cli" : "use_tools", arguments: {} }] };
    } }, { dynamicBridge: bridge, permissionPrompt: true });
    executedPath = h.executedPath;
    h.pet.drop([textItem("交付内容")], "pet"); await settled(h);
    const id = current(h).id;
    expect((await h.persistence.getThread(id))!.metadata.dynamicTools?.[0].name).toBe("cli");
    expect(calls).toBe(0);
    const fullView = makeThreadWindowStore();
    const fullSocket = new ThreadSocketClient({ url: "ws://local/api/thread", WebSocketImpl: h.LocalSocket,
      onConnectionState: (value) => fullView.getState().setConnectionState(value),
      onNotification: (value) => fullView.getState().handleNotification(value),
      onRequest: (value) => fullView.getState().handleRequest(value),
    });
    fullSocket.connect();
    fullSocket.resumeThread(id);
    cleanups.push(async () => fullSocket.disconnect());
    const observed: any[] = [];
    const observer = new EventEmitter() as EventEmitter & { send(data: string): void };
    observer.send = data => observed.push(JSON.parse(data));
    attachThreadSocketHandlers(observer, { commandRouter: h.router, eventPublisher: h.publisher, observeRequests: true });
    cleanups.push(async () => { observer.emit("close"); });
    h.pet.respond("请整理这份资料");
    await until(() => expect(fullView.getState().threadsById[id]?.permissionRequests).toHaveLength(1));
    const requestId = fullView.getState().threadsById[id].permissionRequests[0].id;
    expect(h.pet.store.getState().threadsById[id].permissionRequests[0].id).toBe(requestId);
    expect(observed.filter(frame => frame.type === "permission.requested")).toHaveLength(1);
    observer.emit("message", JSON.stringify({ type: "thread.list", commandId: "observer-reconnect", timestamp: "now", payload: { petId: h.petConfig.id } }));
    await until(() => expect(observed.filter(frame => frame.type === "permission.requested")).toHaveLength(2));
    observer.emit("message", encodePermissionAnswer({ requestId, decision: "allow", scope: "once", timestamp: new Date().toISOString() }));
    expect(h.threads.get(id)!.requests.snapshot()).toHaveLength(1);
    expect(calls).toBe(0);
    fullSocket.sendRaw(encodePermissionAnswer({ requestId, decision: "allow", scope: "once", timestamp: new Date().toISOString() }));
    h.pet.answerPermission(requestId, "deny");
    await until(() => expect(h.pet.getSnapshot().latestAssistant?.text).toBe("CLI 已按你的决定完成。"));
    expect(calls).toBe(1);
    expect(await readFile(executedPath, "utf8")).toBe("CLI completed after user decision");
    expect(fullView.getState().threadsById[id].permissionRequests).toEqual([]);
    expect(h.pet.store.getState().threadsById[id].permissionRequests).toEqual([]);
    expect(observed.every(frame => ["permission.requested", "thread.listed"].includes(frame.type))).toBe(true);
  });

  it("PDF 已读完但本轮未完成时，重启会说明中断，且不会重放已开始的输入", async () => {
    const h = await harness(decisionClient());
    const thread = await h.persistence.createThread({petId:h.petConfig.id});
    const id = thread.metadata.id;
    await h.persistence.persistUserInput(id, {items:[textItem("/tmp/report.pdf")]}, "reading");
    await h.persistence.persistNotifications(id, [{ type: "turn.started", threadId: id, turnId: "reading", notificationId: "started", timestamp: new Date().toISOString(), payload: {} }]);
    await h.persistence.persistRunDelta(id,0,[{role:"tool",name:"file.read",toolCallId:"read",content:"Saved PDF body"}],[]);
    await h.close();
    const restored = await harness(decisionClient(), { directory: h.directory });
    restored.pet.revealBubble();
    await until(() => expect(restored.pet.store.getState().threadsById[id]).toBeDefined());
    expect(restored.pet.getSnapshot().latestAssistant?.text).toContain("重启");
    expect((await restored.persistence.getThread(id))?.pendingInputs ?? []).toEqual([]);
    expect(await restored.persistence.recoverIncompleteTurnForSnapshot(id)).toBeNull();
  });

  it("已接收但还没开始的输入在重启后保持待处理，不冒充丢失中的执行", async () => {
    const h = await harness(decisionClient());
    const thread = await h.persistence.createThread({petId:h.petConfig.id});
    const id = thread.metadata.id;
    await h.persistence.persistUserInput(id, { items: [textItem("尚未开始的工作")] }, "pending");
    await h.close();
    const restored = await harness(decisionClient(), { directory: h.directory });
    await until(() => expect(restored.pet.store.getState().threadsById[id]).toBeDefined());
    expect(restored.pet.store.getState().threadsById[id].messages).toHaveLength(1);
    expect(restored.pet.store.getState().threadsById[id].messages[0]).toMatchObject({ type: "user_message", pending: true });
    expect(restored.pet.getSnapshot().latestAssistant).toBeUndefined();
  });

  it.each(["text", "image", "url", "pdf"] as const)("%s 在两个松手区域保存文字或原路径，不预读", async (kind) => {
    const contexts:AgentMessage[][]=[];
    const h=await harness(decisionClient(contexts));
    await h.pet.drop([textItem("原对话")],"pet"); await settled(h); const a=current(h).id;
    const source=join(h.directory,kind==='image'?'original.png':'original.pdf');
    const bytes=kind==='image'?png:textPdf('Content must remain unread'); await writeFile(source,bytes);
    const content=kind==='text'?'旅行草稿':kind==='url'?'https://example.org/announcement':`本地文件路径：${source}`;
    const item = kind === "text" || kind === "url" ? textItem(content) : pathInput(source);
    await h.pet.drop([item],"conversation");
    await until(()=>expect(current(h).snapshot().messages.filter(m=>m.role==='user')).toHaveLength(2));await settled(h);expect(current(h).id).toBe(a);
    await h.pet.drop([item],"pet");await until(()=>expect(current(h).id).not.toBe(a));await settled(h);
    const b=current(h).id;const saved=await h.persistence.getThread(b);
    expect(saved!.messages.find(m=>m.role==='user')!.inputItems).toEqual([item]);
    expect(await readdir(join(h.directory, 'blobs')).catch(() => [])).toEqual([]);
    if (item.type === 'file_reference') expect(JSON.stringify(contexts)).toContain(source);
    expect(JSON.stringify(contexts)).not.toContain('Content must remain unread');expect(h.reads).toEqual([]);
    expect(await readFile(source)).toEqual(bytes);
    await h.close();const restored=await harness(decisionClient(),{directory:h.directory});
    await until(()=>expect(restored.pet.getSnapshot().threadId).toBe(b));
    expect((await restored.persistence.getThread(b))?.messages.find(m=>m.role==='user')?.inputItems).toEqual([item]);
    expect(restored.pet.store.getState().threadsById[b].messages[0]).toMatchObject({ type: 'user_message', inputItems: [item] });
  });

  it("点选建议与输入同一句话采用同一输入路径，等待不会自动执行", async () => {
    const h = await harness(decisionClient());
    const histories: string[][] = [];
    for (const useSuggestion of [true, false]) {
      const previous = h.pet.getSnapshot().threadId;
      h.pet.drop([textItem("待处理资料")], "pet");
      await until(() => expect(h.pet.getSnapshot().threadId).not.toBe(previous));
      await settled(h);
      const id = current(h).id;
      vi.useFakeTimers();
      try {
        await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
        expect(h.pet.getSnapshot().latestAssistant?.awaitingReply).toBe(true);
        expect(current(h).status).toBe("idle");
      } finally { vi.useRealTimers(); }
      const reply = useSuggestion ? h.pet.getSnapshot().latestAssistant!.suggestedReplies![0] : "请整理这份资料";
      h.pet.respond(reply);
      await until(() => { expect(h.pet.getSnapshot().latestAssistant?.text).toBe("已按你的决定整理好了。"); expect(current(h).status).toBe("idle"); });
      expect(await readFile(h.executedPath, "utf8")).toBe("用户决定后的执行结果");
      histories.push((await h.persistence.getThread(id))!.messages.filter((m) => m.role === "user").map((m) => String(m.content)));
      expect((await h.persistence.getConversationMessages(id)).some((message) => message.awaitingReply)).toBe(false);
    }
    expect(histories[0]).toEqual(histories[1]);
    expect(histories[0]).toEqual(["待处理资料", "请整理这份资料"]);
  });

  it.each(["pet", "thread-window"])("%s 执行中追加输入立即持久化并排队，两界面一致且重启后仍在权威历史中", async (source) => {
    const gate = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    const h = await harness({ complete: async (messages) => { entered.resolve(); await gate.promise; return answer("当前工作完成"); } });
    h.pet.drop([textItem("先处理这一份")], "pet");
    await entered.promise;
    const id = current(h).id;
    const fullView = makeThreadWindowStore();
    const fullSocket = new ThreadSocketClient({ url: "ws://local/api/thread", WebSocketImpl: h.LocalSocket,
      onConnectionState: (value) => fullView.getState().setConnectionState(value),
      onNotification: (value) => inputs.handleNotification(value),
      onRequest: (value) => fullView.getState().handleRequest(value),
    });
    const inputs = new ThreadInputController({ getState: fullView.getState, client: fullSocket });
    fullSocket.connect();
    fullSocket.resumeThread(id);
    await until(() => expect(fullView.getState().threadsById[id]?.status).toBe("running"));
    if (source === "pet") h.pet.respond("然后处理这一份");
    else inputs.submitComposerInput(id, { items: [textItem("然后处理这一份")] });
    await until(() => expect(h.pet.store.getState().threadsById[id].messages.some((m) => m.type === "user_message" && m.text === "然后处理这一份" && m.pending)).toBe(true));
    const visibleMessages = (view: typeof fullView) => view.getState().threadsById[id].messages.map((message) =>
      message.type === "user_message" ? { ...message, pending: message.pending === true } : message);
    expect(visibleMessages(fullView)).toEqual(visibleMessages(h.pet.store));
    const saved = await h.persistence.getThread(id);
    expect(saved!.messages.some((m) => m.content === "然后处理这一份")).toBe(true);
    // A second SQLite reader proves acceptance is durable before the first execution completes.
    const otherStore = new ThreadStore({ dbPath: join(h.directory, "threads.sqlite") });
    const other = new ThreadPersistence(otherStore, undefined, h.blobs);
    expect((await other.getThread(id))!.pendingInputs?.[0].payload.items[0]).toMatchObject({ text: "然后处理这一份" });
    otherStore.close();
    await h.close(); gate.resolve();
    const restored = await harness(decisionClient(), { directory: h.directory });
    await until(() => expect(restored.pet.store.getState().threadsById[id]?.messages.some((m) => m.type === "user_message" && m.text === "然后处理这一份" && m.pending)).toBe(true));
  });

  it("A 的迟到结果不抢占新建 B；主动隐藏不会被后台消息解除", async () => {
    const gate = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    const h = await harness({ complete: async (messages) => {
      if (JSON.stringify(messages).includes("任务 A")) { entered.resolve(); await gate.promise; return answer("A 的晚到结果"); }
      return ask("B 的建议");
    } });
    h.pet.drop([textItem("任务 A")], "pet"); await entered.promise;
    const a = current(h).id;
    h.pet.drop([textItem("任务 B")], "pet");
    await until(() => expect(h.pet.getSnapshot().latestAssistant?.text).toBe("B 的建议"));
    const b = current(h).id;
    h.pet.hideBubble(); gate.resolve();
    await until(() => expect(h.threads.get(a)?.status).toBe("idle"));
    expect(h.pet.getSnapshot()).toMatchObject({ threadId: b, bubbleVisible: false });
    expect(h.pet.getSnapshot().latestAssistant?.text).toBe("B 的建议");
    expect((await h.persistence.getThread(a))!.messages.at(-1)?.content).toBe("A 的晚到结果");
    h.pet.revealBubble(); expect(h.pet.getSnapshot().bubbleVisible).toBe(true);
  });
});
