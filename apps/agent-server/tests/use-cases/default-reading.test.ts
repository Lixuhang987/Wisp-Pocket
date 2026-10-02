import { EventEmitter } from "node:events";
import { execFileSync } from "node:child_process";
import { threadHarness, input as userOp } from "../support/threadHarness.ts";
import { ThreadTools } from "@handagent/core/thread/ThreadTools.ts";
import { FileWriteTool } from "@handagent/core/tools/builtins/FileWriteTool.ts";
import { attachThreadSocketHandlers } from "../../src/server/server.ts";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultReadTools } from "../../src/actions/DefaultReadTools.ts";
import { AgentRuntime } from "@handagent/core/runtime/AgentRuntime.ts";
import { ToolRegistry } from "@handagent/core/tools/ToolRegistry.ts";
import { toVercelMessages } from "@handagent/core/adapters/providers/VercelAdapters.ts";
import type { AgentMessage } from "@handagent/core/runtime/types/AgentMessage.ts";

const directories: string[] = [];
afterEach(async () => { for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true }); });
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "default-read-")); directories.push(directory);
  const tools = createDefaultReadTools({ contextHistoryRoot: join(directory, "history") });
  return { directory, tools, read: tools.find((tool) => tool.name === "file.read")! };
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

describe("默认读取工具 → 实际文件 → Runtime模型上下文", () => {
  it("原路径先仅作为文字，调用时读取当前正文，无需Permission；删除后报错", async () => {
    const h = await setup(); const path = join(h.directory, "notes.txt");
    await writeFile(path, "提交时内容");
    const captured: AgentMessage[][] = []; let asked = 0;
    const runtime = new AgentRuntime({ complete: async (messages, tools) => {
      captured.push(structuredClone(messages));
      expect(tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(["file.read", "context_history.activity_index", "context_history.sample_details", "context_history.thumbnails", "context_history.screenshot_original"]));
      if (captured.length === 1) {
        await writeFile(path, "实际读取时内容");
        return { message: { role: "assistant", content: "" }, toolCalls: [{ id: "read", name: "file.read", arguments: { path } }] };
      }
      return { message: { role: "assistant", content: "已读取" } };
    } }, new ToolRegistry(h.tools), { permissionPolicy: { check: async () => { asked++; return "ask"; }, resolveAsk: async () => { throw new Error("不应询问"); }, remember: async () => {} } });
    const result = await runtime.runWithMessages([{ role: "user", content: `本地文件路径：${path}` }]);
    expect(JSON.stringify(captured[0])).not.toContain("提交时内容");
    expect(JSON.stringify(captured[1])).toContain("实际读取时内容");
    expect(result.messages.some((message) => message.role === "tool" && message.content.includes("实际读取时内容"))).toBe(true);
    expect(asked).toBe(0);
    await rm(path);
    await expect(h.read.call({ path })).rejects.toThrow();
  });
  it.each(["png", "jpeg", "webp"] as const)("%s 实际解码后进入普通Tool的模型图片输入", async (format) => {
    const h = await setup(); const path = join(h.directory, `image.${format}`);
    const bytes = await sharp({ create: { width: 2, height: 3, channels: 4, background: "red" } }).toFormat(format).toBuffer();
    await writeFile(path, bytes);
    const output = await h.read.call({ path });
    const messages: AgentMessage[] = [{ role: "tool", toolCallId: "read", name: "file.read", content: JSON.stringify(output) }];
    const converted = await toVercelMessages(messages);
    expect(JSON.stringify(converted)).toContain('"type":"image-data"');
    expect(JSON.stringify(converted)).toContain(bytes.toString("base64"));
    const chat = await toVercelMessages(messages, { toolResultImages: "user" });
    expect(chat.map((message) => message.role)).toEqual(["tool", "user"]);
    await writeFile(path, bytes.subarray(0, 20));
    await expect(h.read.call({ path })).rejects.toThrow();
  });
  it("PDF返回实际正文，对无文字、损坏及正文上限明确失败", async () => {
    const h = await setup(); const path = join(h.directory, "document.pdf");
    await writeFile(path, textPdf("Actual PDF body"));
    expect(await h.read.call({ path })).toMatchObject({ pages: 1, content: expect.stringContaining("Actual PDF body") });
    await writeFile(path, textPdf("")); await expect(h.read.call({ path })).rejects.toThrow("没有可提取的文字");
    await writeFile(path, "broken"); await expect(h.read.call({ path })).rejects.toThrow("有效的 PDF");
    await writeFile(path, textPdf("x".repeat(80001))); await expect(h.read.call({ path })).rejects.toThrow("8 万字");
  });

  it.each([["encrypted.pdf", "需要密码"], ["over-page-limit.pdf", "超过本次可读取的 200 页"]])("真实PDF %s 明确失败", async (file, message) => {
    const h = await setup();
    const path = fileURLToPath(new URL(`../fixtures/file-reading/${file}`, import.meta.url));
    await expect(h.read.call({ path })).rejects.toThrow(message);
  });

  it("有效空文本和空历史与二进制/坏索引有区别", async () => {
    const h = await setup(); const path = join(h.directory, "empty.txt");
    await writeFile(path, ""); expect(await h.read.call({ path })).toMatchObject({ content: "" });
    expect(await h.tools.find((tool) => tool.name === "context_history.activity_index")!.call({})).toEqual({ samples: [] });
    await writeFile(path, Buffer.from([0, 1, 2])); await expect(h.read.call({ path })).rejects.toThrow();
  });
  it.skipIf(process.platform === "win32")("命名管道没有写入方也立即拒绝，不挂住读取", async () => {
    const h = await setup(); const path = join(h.directory, "pipe");
    execFileSync("mkfifo", [path]);
    await expect(h.read.call({ path })).rejects.toThrow("普通文件");
  });
});

async function swiftFixture() {
  const h = await setup(); const history = join(h.directory, "history");
  await cp(fileURLToPath(new URL("../fixtures/context-history", import.meta.url)), history, { recursive: true });
  const records = JSON.parse(await readFile(join(history, "screenshots.json"), "utf8"));
  for (const record of records) {
    record.originalPath = join(history, "screenshots/original", basename(record.originalPath));
    record.thumbnailPath = join(history, "screenshots/thumbnails", basename(record.thumbnailPath));
  }
  await writeFile(join(history, "screenshots.json"), JSON.stringify(records));
  const call = (name: string, input: unknown) => h.tools.find((tool) => tool.name === `context_history.${name}`)!.call(input);
  return { ...h, history, records, call };
}

describe("Swift真实ContextHistoryStore保存格式 → Node默认工具", () => {
  it("索引、AX目标、缩略图与原图使用同一保存证据且不推测collection状态", async () => {
    const h = await swiftFixture();
    const index = await h.call("activity_index", { limit: 20 });
    expect(index).toMatchObject({ samples: [{ id: "swift-sample", thumbnailId: "swift-screenshot" }] });
    expect(index).not.toHaveProperty("collection");
    const details = await h.call("sample_details", { ids: ["swift-sample", "swift-sample"] }) as any;
    expect(details.samples).toHaveLength(2);
    expect(details.samples[0].axSummary).toHaveProperty("root.role", "AXWindow");
    const original = await h.call("screenshot_original", { id: "swift-screenshot" }) as any;
    expect(JSON.parse(original.contentItems[0].text).screenshot).toMatchObject({ sampleId: "swift-sample", dimensions: { width: 4, height: 2 }, imageContentIndex: 1 });
    const thumbs = await h.call("thumbnails", { start: 1700000000, end: "2023-11-14T22:13:20Z" }) as any;
    expect(JSON.parse(thumbs.contentItems[0].text).thumbnails[0]).toMatchObject({ dimensions: { width: 2, height: 1 } });
    expect(JSON.stringify(await toVercelMessages([{ role: "tool", toolCallId: "history", name: "context_history.screenshot_original", content: JSON.stringify(original) }]))).toContain('"type":"image-data"');
  });
  it("截图已发布但活动尚未发布缩略图关联的正常过渡仍可读", async () => {
    const h = await swiftFixture();
    const path = join(h.history, "activities.json"); const samples = JSON.parse(await readFile(path, "utf8"));
    delete samples[0].thumbnailId; await writeFile(path, JSON.stringify(samples));
    expect(await h.call("activity_index", {})).toMatchObject({ samples: [{ thumbnailId: null }] });
    expect(await h.call("screenshot_original", { id: "swift-screenshot" })).toMatchObject({ success: true });
  });
  it("坏索引、未知ID、丢失或坏证据和错误关联返回明确失败", async () => {
    const h = await swiftFixture();
    await expect(h.call("sample_details", { ids: ["unknown"] })).rejects.toThrow("not_found");
    await expect(h.call("thumbnails", { start: 2, end: 1 })).rejects.toThrow("start");
    await writeFile(h.records[0].originalPath, "broken");
    await expect(h.call("screenshot_original", { id: "swift-screenshot" })).rejects.toThrow("invalid_image");
    await rm(h.records[0].thumbnailPath);
    await expect(h.call("thumbnails", {})).rejects.toThrow();
    const activitiesPath = join(h.history, "activities.json");
    const samples = JSON.parse(await readFile(activitiesPath, "utf8"));
    const axPath = join(h.history, "ax", `${samples[0].axSummaryId}.json`);
    const ax = JSON.parse(await readFile(axPath, "utf8")); ax.app.pid = 999; ax.window.ownerPid = 999;
    await writeFile(axPath, JSON.stringify(ax));
    await expect(h.call("sample_details", { ids: ["swift-sample"] })).rejects.toThrow("context_changed");
    await writeFile(activitiesPath, "["); await expect(h.call("activity_index", {})).rejects.toThrow("read_failed");
  });
});


describe("真实Thread协议、Runtime、SQLite的统一默认读取", () => {
  it("首轮默认读取与路径历史持久化、激活后保留目录、按需追问及既有写入授权", async () => {
    const fixture = await swiftFixture();
    const source = join(fixture.directory, "outside-root.txt"); await writeFile(source, "原路径最新内容");
    const readNames = ["user.ask", ...fixture.tools.map(tool => tool.name)];
    let round = 0; const requests: AgentMessage[][] = []; const permissionChecks: string[] = [];
    const model = { complete: async (messages: AgentMessage[], tools: any[]) => {
      requests.push(structuredClone(messages));
      for (const name of readNames) expect(tools.filter(tool => tool.name === name)).toHaveLength(1);
      round++;
      const call = (name: string, args: Record<string, unknown>) => ({ id: `${round}-${name}`, name, arguments: args });
      if (round === 1) return { message: { role: "assistant" as const, content: "" }, toolCalls: [
        call("file.read", { path: source }), call("context_history.activity_index", {}),
        call("context_history.sample_details", { ids: ["swift-sample"] }), call("context_history.thumbnails", {}),
        call("context_history.screenshot_original", { id: "swift-screenshot" }),
      ] };
      if (round === 2) return { message: { role: "assistant" as const, content: "" }, toolCalls: [call("use_tools", {})] };
      if (round === 3) return { message: { role: "assistant" as const, content: "" }, toolCalls: [call("user.ask", { message: "保存摘要吗？", suggestedReplies: ["保存"] }), call("file.write", { relativePath: "must-not-run.txt", content: "未开始的同批调用" })] };
      if (round === 4) return { message: { role: "assistant" as const, content: "" }, toolCalls: [call("file.write", { relativePath: "result.txt", content: "用户要求保存的摘要" })] };
      return { message: { role: "assistant" as const, content: "已保存" } };
    } };
    const h = threadHarness(model, {
      createTools: dynamicTools => new ThreadTools({ builtinRegistry: new ToolRegistry([FileWriteTool.create({})]), defaultTools: fixture.tools, globalMcpServerIds: [], listMcpTools: async () => [] }, dynamicTools),
      createRuntime: (_id, tools) => new AgentRuntime(model, tools.registry, {
        onMetaToolActivate: () => tools.activate(), isThreadActivated: () => tools.isActivated(),
        permissionPolicy: { check: async request => { permissionChecks.push(request.toolName); return "ask"; }, resolveAsk: async () => ({ decision: "allow", remember: "once" }), remember: async () => {} },
      }),
    }, join(fixture.directory, "threads.sqlite"));
    const pet = await h.pets.create({ name: "读取宠", rolePrompt: "请依据实际材料回答", imageRef: { type: "builtin", id: "yachiyo" }, rootPath: join(fixture.directory, "pet-root") });
    class Socket extends EventEmitter { sent: any[] = []; send(raw: string) { this.sent.push(JSON.parse(raw)); } }
    const socket = new Socket();
    attachThreadSocketHandlers(socket as never, { commandRouter: h.router, eventPublisher: h.publisher, acceptServerRequests: true });
    const send = (command: unknown) => socket.emit("message", Buffer.from(JSON.stringify(command)));
    const meta = () => ({ commandId: crypto.randomUUID(), timestamp: new Date().toISOString() });
    try {
      send({ type: "thread.start", ...meta(), payload: { petId: pet.id, dynamicTools: [] } });
      await vi.waitFor(() => expect(socket.sent.some(event => event.type === "thread.started")).toBe(true));
      const threadId = socket.sent.find(event => event.type === "thread.started").threadId;
      send({ type: "op.submit", threadId, ...meta(), payload: { op: userOp(`读取这份资料：${source}`) } });
      await vi.waitFor(() => expect(h.threads.get(threadId)!.snapshot().messages.some((message: any) => message.suggestedReplies?.includes("保存"))).toBe(true));
      expect(permissionChecks).toEqual([]);
      await expect(readFile(join(pet.rootPath, "must-not-run.txt"))).rejects.toThrow();
      const saved = await h.persistence.getThread(threadId);
      const input = saved!.messages.find(message => message.role === "user")!;
      expect(input).toMatchObject({ content: expect.stringContaining(source), inputItems: [{ type: "text", text: expect.stringContaining(source) }] });
      expect(JSON.stringify(requests[0])).not.toContain("原路径最新内容");
      expect(JSON.stringify(requests[1])).toContain("原路径最新内容");
      expect(saved!.messages.some(message => message.role === "tool" && message.name === "file.read")).toBe(true);
      send({ type: "op.submit", threadId, ...meta(), payload: { op: userOp("保存") } });
      await vi.waitFor(async () => expect(await readFile(join(pet.rootPath, "result.txt"), "utf8")).toBe("用户要求保存的摘要"));
      expect(permissionChecks).toEqual(["file.write"]);
      await vi.waitFor(() => expect(h.threads.get(threadId)!.status).toBe("idle"));
    } finally { socket.emit("close"); await h.close(); }
  });
});
