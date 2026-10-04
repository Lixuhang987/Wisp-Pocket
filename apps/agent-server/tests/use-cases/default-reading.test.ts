import { EventEmitter } from "node:events";
import { threadHarness, input as userOp } from "../support/threadHarness.ts";
import { ToolRegistry } from "@handagent/core/tools/ToolRegistry.ts";
import { ThreadTools } from "@handagent/core/thread/ThreadTools.ts";
import { createCodexExecuteTool } from "../../src/actions/CodexExecuteTool.ts";
import { codexFixture } from "../support/codexFixture.ts";
import { attachThreadSocketHandlers } from "../../src/server/server.ts";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultReadTools } from "../../src/actions/DefaultReadTools.ts";
import { AgentRuntime } from "@handagent/core/runtime/AgentRuntime.ts";
import { toVercelMessages } from "@handagent/core/adapters/providers/VercelAdapters.ts";
import type { AgentMessage } from "@handagent/core/runtime/types/AgentMessage.ts";

const directories: string[] = [];
afterEach(async () => { for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true }); });
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "default-read-")); directories.push(directory);
  const tools = createDefaultReadTools({ contextHistoryRoot: join(directory, "history") });
  return { directory, tools };
}

function textPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 40 100 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1000000 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
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

async function swiftFixture() {
  const h = await setup(); const history = join(h.directory, "history");
  await cp(fileURLToPath(new URL("../fixtures/context-history", import.meta.url)), history, { recursive: true });
  const records = JSON.parse(await readFile(join(history, "screenshots.json"), "utf8"));
  for (const record of records) {
    record.originalPath = join(history, "screenshots/original", basename(record.originalPath));
    record.thumbnailPath = join(history, "screenshots/thumbnails", basename(record.thumbnailPath));
  }
  await writeFile(join(history, "screenshots.json"), JSON.stringify(records));
  return h;
}

describe("真实Thread协议、Runtime、SQLite的统一默认读取", () => {
  it("首轮默认读取与路径历史持久化、按需追问及Codex 委托授权", async () => {
    const fixture = await swiftFixture();
    const source = join(fixture.directory, "outside-root.txt"); await writeFile(source, "提交时的旧内容");
    const cli = await codexFixture(fixture.directory);
    const readNames = ["user.ask", ...fixture.tools.map(tool => tool.name)];
    let round = 0; const requests: AgentMessage[][] = []; const permissionChecks: string[] = [];
    const model = { complete: async (messages: AgentMessage[], tools: any[]) => {
      requests.push(structuredClone(messages));
      for (const name of readNames) expect(tools.filter(tool => tool.name === name)).toHaveLength(1);
      round++;
      const call = (name: string, args: Record<string, unknown>) => ({ id: `${round}-${name}`, name, arguments: args });
      if (round === 1) { await writeFile(source, "原路径最新内容"); return { message: { role: "assistant" as const, content: "" }, toolCalls: [
        call("file.read", { path: source }), call("context_history.activity_index", { start: "2023-11-15T06:13:20+08:00", end: 1700000000 }),
        call("context_history.sample_details", { ids: ["swift-sample"] }), call("context_history.thumbnails", { start: 1700000000, end: "2023-11-15T06:13:20+08:00" }),
        call("context_history.screenshot_original", { id: "swift-screenshot" }),
      ] }; }
      if (round === 2) return { message: { role: "assistant" as const, content: "" }, toolCalls: [call("user.ask", { message: "保存摘要吗？", suggestedReplies: ["保存"] }), call("codex.execute", { prompt: "未开始的同批调用" })] };
      if (round === 3) return { message: { role: "assistant" as const, content: "" }, toolCalls: [call("codex.execute", { prompt: "用户要求保存的摘要" })] };
      return { message: { role: "assistant" as const, content: "已保存" } };
    } };
    const h = threadHarness(model, {
      createTools: id => new ThreadTools({ resolveTools: async () => [...fixture.tools, await createCodexExecuteTool({cli,store:h.store,threadId:id})] }),
      createRuntime: (_id, tools) => new AgentRuntime(model, tools.registry, {
        permissionPolicy: { check: async request => { permissionChecks.push(request.toolName); return "ask"; }, resolveAsk: async () => ({ decision: "allow", remember: "once" }), remember: async () => {} },
      }),
    }, join(fixture.directory, "threads.sqlite"));
    const { workspace } = await h.workspaces.create(join(fixture.directory, "workspace-root"));
    class Socket extends EventEmitter { sent: any[] = []; send(raw: string) { this.sent.push(JSON.parse(raw)); } }
    const socket = new Socket();
    attachThreadSocketHandlers(socket as never, { commandRouter: h.router, eventPublisher: h.publisher, acceptServerRequests: true });
    const send = (command: unknown) => socket.emit("message", Buffer.from(JSON.stringify(command)));
    const meta = () => ({ commandId: crypto.randomUUID(), timestamp: new Date().toISOString() });
    try {
      send({ type: "thread.start", ...meta(), payload: { workspaceId: workspace.id, dynamicTools: [] } });
      await vi.waitFor(() => expect(socket.sent.some(event => event.type === "thread.started")).toBe(true));
      const threadId = socket.sent.find(event => event.type === "thread.started").threadId;
      const op = userOp("读取这份资料");
      const reference = { type: "file_reference" as const, id: "source", path: source, name: "outside-root.txt" };
      send({ type: "op.submit", threadId, ...meta(), payload: { op: { ...op, payload: { items: [...op.payload.items, reference] } } } });
      await vi.waitFor(() => expect(h.threads.get(threadId)!.snapshot().messages.some((message: any) => message.suggestedReplies?.includes("保存"))).toBe(true));
      expect(permissionChecks).toEqual([]);
      await expect(readFile(join(workspace.rootPath, "must-not-run.txt"))).rejects.toThrow();
      const saved = await h.persistence.getThread(threadId);
      const input = saved!.messages.find(message => message.role === "user")!;
      expect(input).toMatchObject({ content: expect.stringContaining(source), inputItems: [{ type: "text", text: "读取这份资料" }, reference] });
      expect(JSON.stringify(requests[0])).toContain(source);
      expect(JSON.stringify(requests[0])).not.toContain("提交时的旧内容");
      expect(JSON.stringify(requests[0])).not.toContain("原路径最新内容");
      expect(JSON.stringify(requests[1])).toContain("原路径最新内容");
      const evidence = requests[1].filter(message => message.role === "tool");
      const index = JSON.parse(evidence.find(message => message.name === "context_history.activity_index")!.content);
      expect(index.samples.map((sample: any) => sample.id)).toEqual(["swift-sample"]);
      expect(index.samples[0].timestamp).toMatch(/[+-]\d{2}:\d{2}$/);
      expect(Date.parse(index.samples[0].timestamp)).toBe(1700000000000);
      const details = JSON.parse(evidence.find(message => message.name === "context_history.sample_details")!.content);
      expect(details.samples[0]).toMatchObject({ id: "swift-sample", axSummary: { root: { role: "AXWindow" } } });
      const original = JSON.parse(evidence.find(message => message.name === "context_history.screenshot_original")!.content);
      expect(JSON.parse(original.contentItems[0].text).screenshot).toMatchObject({ sampleId: "swift-sample", dimensions: { width: 4, height: 2 }, imageContentIndex: 1 });
      expect(JSON.stringify(await toVercelMessages(evidence))).toContain(original.contentItems[1].imageUrl.split(",")[1]);
      expect(saved!.messages.some(message => message.role === "tool" && message.name === "file.read")).toBe(true);
      send({ type: "op.submit", threadId, ...meta(), payload: { op: userOp("保存") } });
      await vi.waitFor(async () => expect(await readFile(join(workspace.rootPath, "result.txt"), "utf8")).toBe("用户要求保存的摘要"));
      expect(permissionChecks).toEqual(["codex.execute"]);
      await vi.waitFor(() => expect(h.threads.get(threadId)!.status).toBe("idle"));
    } finally { socket.emit("close"); await h.close(); }
  });
});


// 两个用户资料流分别证明正文和视觉内容经过真实读取工具进入后续模型输入。
// Provider 的真实 SDK 承载复用 core 的既有图片用例，不再按格式/API 交叉扩增测试。
describe("用户交付原路径资料后按需读取", () => {
  it("读取文本 PDF 后模型取得实际分页正文，原始输入仍只有路径", async () => {
    const h = await setup(); const path = join(h.directory, "document.pdf");
    await writeFile(path, textPdf("Actual PDF body"));
    const { requests, result } = await readThroughRuntime(h.tools, path);
    expect(JSON.stringify(requests[0])).not.toContain("Actual PDF body");
    const output = JSON.parse(requests[1].find(message => message.role === "tool")!.content);
    expect(output).toMatchObject({ path, pages: 1, content: expect.stringContaining("Actual PDF body") });
    expect(result.messages.at(-1)?.content).toBe("已读取资料");
  });

  it("读取原路径 PNG 后真实像素作为普通工具图像进入模型输入", async () => {
    const h = await setup(); const path = join(h.directory, "diagram.png");
    const bytes = await sharp({ create: { width: 2, height: 3, channels: 4, background: "red" } }).png().toBuffer();
    await writeFile(path, bytes);
    const { requests, result } = await readThroughRuntime(h.tools, path);
    expect(JSON.stringify(requests[0])).not.toContain(bytes.toString("base64"));
    const output = JSON.parse(requests[1].find(message => message.role === "tool")!.content);
    expect(JSON.parse(output.contentItems[0].text)).toMatchObject({ path, width: 2, height: 3, mimeType: "image/png" });
    const converted = await toVercelMessages(requests[1]);
    expect(JSON.stringify(converted)).toContain('"type":"image-data"');
    expect(JSON.stringify(converted)).toContain(bytes.toString("base64"));
    expect(result.messages.at(-1)?.content).toBe("已读取资料");
  });
});

async function readThroughRuntime(tools: ReturnType<typeof createDefaultReadTools>, path: string) {
  const requests: AgentMessage[][] = [];
  const runtime = new AgentRuntime({ complete: async messages => {
    requests.push(structuredClone(messages));
    if (requests.length === 1) return {
      message: { role: "assistant", content: "" },
      toolCalls: [{ id: "read-source", name: "file.read", arguments: { path } }],
    };
    return { message: { role: "assistant", content: "已读取资料" } };
  } }, new ToolRegistry(tools));
  const result = await runtime.runWithMessages([{ role: "user", content: `请读取资料：${path}` }]);
  return { requests, result };
}
