import { inflateSync } from "node:zlib";
import { createAnthropic } from "@ai-sdk/anthropic";
import { describe, expect, it, vi } from "vitest";
import { createLLMClient } from "../../src/adapters/providers/LLMClientFactory";
import { toVercelMessages } from "../../src/adapters/providers/VercelAdapters";
import { VercelClient } from "../../src/adapters/providers/VercelClient";
import type { LLMClient } from "../../src/llm/LLMClient";
import type { DynamicToolBridge } from "../../src/protocol/types/DynamicTool";
import { AgentRuntime, type AgentRuntimeEvent } from "../../src/runtime/AgentRuntime";
import { DynamicToolAdapter } from "../../src/tools/DynamicToolAdapter";
import { ToolRegistry } from "../../src/tools/ToolRegistry";

type TestAPI = "responses" | "chat" | "anthropic";

const images = [
  {
    metadata: { id: "screenshot-1", sampleId: "sample-1", thumbnailId: "thumbnail-1", timestamp: "2026-09-13T08:00:00Z", width: 1, height: 1, imageContentIndex: 1 },
    base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
  },
  {
    metadata: { id: "screenshot-2", sampleId: "sample-2", thumbnailId: "thumbnail-2", timestamp: "2026-09-13T08:01:00Z", width: 2, height: 1, imageContentIndex: 1 },
    base64: "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADklEQVR4nGP4z8DwH4QBEfcD/ePF9e8AAAAASUVORK5CYII=",
  },
] as const;

describe("Dynamic Tool image consumption", () => {
  it.each(["responses", "anthropic"] as const)(
    "sends image bytes and their metadata through real runtime and %s SDK tool results",
    async (api) => {
      const { result, requests, bridge, events } = await runImageTools(api);
      const completed = events.findLast((event) => event.type === "assistant_message_end");
      expect(completed).toMatchObject({ messageId: expect.any(String), payload: { status: "completed" } });
      expect(result.messages.at(-1)).toEqual({ role: "assistant", id: completed?.messageId, content: "已核对视觉证据" });
      expect(bridge.call).toHaveBeenCalledTimes(2);
      expect(bridge.call.mock.calls[0][0]).toMatchObject({
        threadId: "thread-images", turnId: "turn-images", callId: "thread-images:turn-images:call-1",
        namespace: "context_history", tool: "screenshot_original", arguments: { id: "screenshot-1" },
      });
      expect(requests).toHaveLength(1);
      const request = JSON.parse(requests[0]);
      const outputs = api === "responses"
        ? request.input.filter((part: { type: string }) => part.type === "function_call_output")
        : request.messages.flatMap((message: { content: unknown[] }) => message.content)
          .filter((part: { type: string }) => part.type === "tool_result");

      expect(outputs).toHaveLength(2);
      for (const [index, fixture] of images.entries()) {
        const output = outputs[index];
        expect(api === "responses" ? output.call_id : output.tool_use_id).toBe(`call-${index + 1}`);
        const parts = api === "responses" ? output.output : output.content;
        expect(parts).toEqual([
          { type: api === "responses" ? "input_text" : "text", text: JSON.stringify({ callId: `call-${index + 1}`, success: true }) },
          { type: api === "responses" ? "input_text" : "text", text: JSON.stringify(fixture.metadata) },
          { type: api === "responses" ? "input_text" : "text", text: "图像 contentItems[1]：" },
          api === "responses"
            ? { type: "input_image", image_url: `data:image/png;base64,${fixture.base64}` }
            : { type: "image", source: { type: "base64", media_type: "image/png", data: fixture.base64 } },
          { type: api === "responses" ? "input_text" : "text", text: `图片归属 ${fixture.metadata.id}` },
        ]);
        const base64 = api === "responses" ? parts[3].image_url.split(",")[1] : parts[3].source.data;
        expectPNG(base64, fixture.metadata.width);
      }
      // 请求适配不改变由 Thread/runtime 拥有的原始工具消息。
      const persistedTools = result.messages.filter((message) => message.role === "tool");
      expect(persistedTools).toHaveLength(2);
      expect(JSON.parse(persistedTools[0].content)).toMatchObject({
        callId: "call-1", success: true,
        contentItems: expect.arrayContaining([{ type: "inputImage", imageUrl: `data:image/png;base64,${images[0].base64}` }]),
      });
    },
  );

  it("keeps all Chat tool results together before appending associated user image content", async () => {
    const { result, requests, events } = await runImageTools("chat");
    const completed = events.findLast((event) => event.type === "assistant_message_end");
    expect(completed).toMatchObject({ messageId: expect.any(String), payload: { status: "completed" } });
    expect(result.messages.at(-1)).toEqual({ role: "assistant", id: completed?.messageId, content: "已核对视觉证据" });
    const messages = JSON.parse(requests[0]).messages;
    expect(messages.map((message: { role: string }) => message.role)).toEqual([
      "user", "assistant", "tool", "tool", "user",
    ]);
    for (const [index, fixture] of images.entries()) {
      const toolResult = messages[index + 2];
      expect(toolResult.tool_call_id).toBe(`call-${index + 1}`);
      expect(toolResult.content).toContain(JSON.stringify(fixture.metadata));
      expect(toolResult.content).toContain('"success":true');
      expect(toolResult.content).not.toContain(fixture.base64);
    }

    const attached = messages.at(-1).content;
    const imageParts = attached.filter((part: { type: string }) => part.type === "image_url");
    expect(imageParts).toHaveLength(2);
    for (const [index, fixture] of images.entries()) {
      const imageIndex = attached.indexOf(imageParts[index]);
      expect(attached[imageIndex - 2]).toEqual({ type: "text", text: JSON.stringify(fixture.metadata) });
      expect(attached[imageIndex - 1]).toEqual({ type: "text", text: "图像 contentItems[1]：" });
      expect(attached.slice(index === 0 ? 0 : attached.indexOf(imageParts[index - 1]) + 1, imageIndex)
        .some((part: { text?: string }) => part.text?.includes(`call-${index + 1}`))).toBe(true);
      expect(imageParts[index].image_url.url).toBe(`data:image/png;base64,${fixture.base64}`);
      expectPNG(imageParts[index].image_url.url.split(",")[1], fixture.metadata.width);
    }
    expect(result.messages.filter((message) => message.role === "user")).toHaveLength(1);
  });

  it.each(["responses", "anthropic", "chat"] as const)(
    "keeps a failed Dynamic Tool's status, metadata and image evidence through runtime and %s",
    async (api) => {
      const { result, requests, events } = await runImageTools(api, false);
      const toolEvents = events.filter((event) => event.type === "tool_result");
      expect(toolEvents.map((event) => event.status)).toEqual(["error", "error"]);
      const storedResults = result.messages.filter((message) => message.role === "tool");
      expect(storedResults.map((message) => JSON.parse(message.content))).toMatchObject([
        { callId: "call-1", success: false, metadata: { runId: "run-failed", failedStep: 2 } },
        { callId: "call-2", success: false, metadata: { runId: "run-failed", failedStep: 2 } },
      ]);

      const request = JSON.parse(requests[0]);
      const parts = api === "responses"
        ? request.input.filter((part: { type: string }) => part.type === "function_call_output").flatMap((part: { output: unknown[] }) => part.output)
        : api === "anthropic"
          ? request.messages.flatMap((message: { content: unknown[] }) => message.content)
            .filter((part: { type: string }) => part.type === "tool_result").flatMap((part: { content: unknown[] }) => part.content)
          : request.messages.at(-1).content;
      const text = parts.filter((part: { type: string }) => part.type === "text" || part.type === "input_text")
        .map((part: { text: string }) => part.text).join("\n");
      expect(text).toContain('"success":false');
      expect(text).toContain('"runId":"run-failed","failedStep":2');
      expect(text).toContain("断言失败；附上已采集的证据。");
      expect(text).toContain('"imageContentIndex":2');
      expect(text).toContain("图像 contentItems[2]：");
      const imageParts = parts.filter((part: { type: string }) => ["input_image", "image", "image_url"].includes(part.type));
      expect(imageParts).toHaveLength(2);
      imageParts.forEach((part: { image_url?: string | { url: string }; source?: { data: string } }, index: number) => {
        const base64 = api === "anthropic" ? part.source!.data
          : (typeof part.image_url === "string" ? part.image_url : part.image_url!.url).split(",")[1];
        expectPNG(base64, images[index].metadata.width);
      });
    },
  );

  it("keeps ordinary JSON, plain text and text-only Dynamic Tool results intact", async () => {
    const contents = [
      "普通文本", '{"ok":true,"imageUrl":"ordinary-data"}',
      JSON.stringify({ callId: "call-text", success: false, contentItems: [{ type: "inputText", text: "失败原因" }] }),
      JSON.stringify({ contentItems: [{ type: "inputImage", imageUrl: `data:image/png;base64,${images[0].base64}` }] }),
    ];
    const messages = await toVercelMessages(contents.map((content, index) => ({
      role: "tool", toolCallId: `call-${index}`, name: "tool.read", content,
    })));
    expect(messages.map((message) => message.role === "tool" ? message.content[0] : undefined)).toMatchObject([
      { output: { type: "text", value: contents[0] } },
      { output: { type: "json", value: JSON.parse(contents[1]) } },
      { output: { type: "json", value: JSON.parse(contents[2]) } },
      { output: { type: "json", value: JSON.parse(contents[3]) } },
    ]);
  });

  it("reports the completion API capability limit before sending restored Dynamic Tool images", async () => {
    const fetch = vi.fn();
    const client = new VercelClient({ api: "completion", apiKey: "test-key", fetch });
    await expect(client.complete([
      { role: "user", content: "核对截图" },
      { role: "assistant", content: "", toolCalls: [{ id: "call-1", name: "context_history.screenshot_original", arguments: {} }] },
      {
        role: "tool", toolCallId: "call-1", name: "context_history.screenshot_original",
        content: JSON.stringify({ callId: "call-1", success: true, contentItems: [{ type: "inputImage", imageUrl: `data:image/png;base64,${images[0].base64}` }] }),
      },
    ], [])).rejects.toThrow("OpenAI completion API does not support image content. Use chat or responses.");
    expect(fetch).not.toHaveBeenCalled();
  });
});

async function runImageTools(api: TestAPI, success = true) {
  const requests: string[] = [];
  const events: AgentRuntimeEvent[] = [];
  const fetch = vi.fn(async (_input, init) => {
    requests.push(String(init?.body));
    return completionResponse(api);
  }) as unknown as typeof globalThis.fetch;
  const providerClient = api === "anthropic"
    ? createLLMClient(
      { provider: "anthropic", model: "claude-sonnet-4-5", summarizerModel: "unused", api: "responses", apiKey: "test-key", baseUrl: "https://provider.example/v1" },
      { createAnthropic: (options) => createAnthropic({ ...options, fetch }) },
    ).client as LLMClient
    : new VercelClient({ api, apiKey: "test-key", model: "gpt-4.1", baseURL: "https://provider.example/v1", fetch });
  const bridge = {
    call: vi.fn<DynamicToolBridge["call"]>(async (request) => {
      const fixture = images.find((image) => image.metadata.id === (request.arguments as { id: string }).id)!;
      return {
        callId: request.callId, success,
        ...(!success ? { metadata: { runId: "run-failed", failedStep: 2 } } : {}),
        contentItems: [
          ...(!success ? [{ type: "inputText" as const, text: "断言失败；附上已采集的证据。" }] : []),
          { type: "inputText", text: JSON.stringify({ ...fixture.metadata, imageContentIndex: success ? 1 : 2 }) },
          { type: "inputImage", imageUrl: `data:image/png;base64,${fixture.base64}` },
          { type: "inputText", text: `图片归属 ${fixture.metadata.id}` },
        ],
      };
    }),
  };
  const dynamicTool = new DynamicToolAdapter({
    clientId: "swift-host", namespace: "context_history", name: "screenshot_original", description: "读取截图原图",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  }, bridge);
  const runtime = new AgentRuntime({
    async *stream(messages, tools, options) {
      // 仅替换第一次模型决策；真实 Tool、runtime、provider client 与 SDK 负责后续图片链路。
      if (!messages.some((message) => message.role === "tool")) {
        yield {
          type: "message_end", message: { role: "assistant", content: "" },
          toolCalls: images.map((image, index) => ({ id: `call-${index + 1}`, name: dynamicTool.name, arguments: { id: image.metadata.id } })),
        };
        return;
      }
      yield* providerClient.stream(messages, tools, options);
    },
  }, new ToolRegistry([dynamicTool]), { maxTimes: 2, systemPromptSections: [] });
  const result = await runtime.runWithMessages(
    [{ role: "user", content: "按样本关联核对两张截图" }], (event) => events.push(event), { threadId: "thread-images", turnId: "turn-images" },
  );
  return { result, requests, bridge, events };
}

function completionResponse(api: TestAPI): Response {
  const events = api === "anthropic" ? [
    { type: "message_start", message: { id: "message-1", model: "claude-sonnet-4-5", role: "assistant", usage: { input_tokens: 1 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "已核对视觉证据" } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } },
    { type: "message_stop" },
  ] : api === "responses" ? [
    { type: "response.created", response: { id: "response-1", created_at: 1, model: "gpt-4.1" } },
    { type: "response.output_item.added", output_index: 0, item: { type: "message", id: "message-1" } },
    { type: "response.output_text.delta", item_id: "message-1", delta: "已核对视觉证据" },
    { type: "response.output_item.done", output_index: 0, item: { type: "message", id: "message-1" } },
    { type: "response.completed", response: { usage: { input_tokens: 1, output_tokens: 1 } } },
  ] : [
    { id: "response-1", created: 1, model: "gpt-4.1", choices: [{ index: 0, delta: { role: "assistant", content: "已核对视觉证据" }, finish_reason: null }] },
    { id: "response-1", created: 1, model: "gpt-4.1", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
  ];
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  });
}

function expectPNG(base64: string, width: number): void {
  const bytes = Buffer.from(base64, "base64");
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(bytes.readUInt32BE(16)).toBe(width);
  expect(bytes.readUInt32BE(20)).toBe(1);
  const compressed: Buffer[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT") compressed.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  // 两个有效 PNG 都是一行红色 RGBA 像素；实际解压像素，避免仅验证字符串或文件头。
  expect(inflateSync(Buffer.concat(compressed))).toEqual(Buffer.from([0, ...Array.from({ length: width }, () => [255, 0, 0, 255]).flat()]));
}
