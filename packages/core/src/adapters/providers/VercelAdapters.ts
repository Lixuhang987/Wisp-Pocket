import {
  jsonSchema,
  tool,
  type ImagePart,
  type JSONValue,
  type ModelMessage,
  type TextPart,
  type ToolResultPart,
  type ToolSet,
} from "ai";
import { createParser, type EventSourceMessage } from "eventsource-parser";
import type { BlobStore } from "../../blob/types/BlobStore.ts";
import type { DynamicToolCallResponsePayload } from "../../protocol/types/DynamicTool.ts";
import type { AgentImageContentPart, AgentMessage } from "../../runtime/types/AgentMessage.ts";
import type { RegisteredTool } from "../../tools/ToolRegistry.ts";

// OpenAI 兼容网关要求 tool name 匹配 ^[a-zA-Z0-9_-]+$，
// 而仓内 tool 名字采用点号风格（如 file.read），需要在适配层做映射。
export function sanitizeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function createOpenAICompatibleFetch(baseFetch?: typeof fetch): typeof fetch {
  const fetchImpl = baseFetch ?? globalThis.fetch;
  return async function openAICompatibleFetch(input, init) {
    const response = await fetchImpl(input, init);
    if (!isEventStreamResponse(response) || !response.body) {
      return response;
    }

    return new Response(filterEmptySSEDataEventStream(response.body), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

export function filterEmptySSEDataEvents(raw: string): string {
  const events = parseSSEMessages(raw);
  const filteredEvents: EventSourceMessage[] = [];
  const normalizer = createSSEEventNormalizer((event) => filteredEvents.push(event));
  for (const event of events) {
    normalizer.accept(event);
  }

  if (filteredEvents.length === 0) {
    return "";
  }
  return filteredEvents.map(formatSSEMessage).join("\n\n") + trailingLineBreak(raw);
}

function createSSEEventNormalizer(
  emit: (event: EventSourceMessage) => void,
): { accept: (event: EventSourceMessage) => void } {
  let pendingEmptyEvent: EventSourceMessage | undefined;

  return {
    accept(event) {
      if (event.data.trim() === "") {
        pendingEmptyEvent = event;
        return;
      }
      const normalizedEvent = pendingEmptyEvent && !event.event
        ? {
            ...event,
            event: pendingEmptyEvent.event,
            id: event.id ?? pendingEmptyEvent.id,
          }
        : event;
      for (const splitEvent of splitNewlineDelimitedJSONEvent(normalizedEvent)) {
        emit(splitEvent);
      }
      pendingEmptyEvent = undefined;
    },
  };
}

function splitNewlineDelimitedJSONEvent(event: EventSourceMessage): EventSourceMessage[] {
  const lines = event.data.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1 || !lines.every(isJSONObjectPayload)) {
    return [event];
  }
  return lines.map((data) => ({ ...event, data }));
}

function isJSONObjectPayload(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

function filterEmptySSEDataEventStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let feedSSEChunk: (text: string) => void = () => undefined;

  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    start(controller) {
      const normalizer = createSSEEventNormalizer((event) => {
        controller.enqueue(encoder.encode(`${formatSSEMessage(event)}\n\n`));
      });
      const parser = createParser({
        onEvent(event) {
          normalizer.accept(event);
        },
      });
      feedSSEChunk = (text) => parser.feed(text);
    },
    transform(chunk) {
      const text = decoder.decode(chunk, { stream: true });
      if (text) {
        feedSSEChunk(text);
      }
    },
    flush() {
      const finalText = decoder.decode();
      if (finalText) {
        feedSSEChunk(finalText);
      }
      feedSSEChunk("\n\n");
    },
  }));
}

function isEventStreamResponse(response: Response): boolean {
  return response.headers.get("content-type")?.toLowerCase().split(";")[0].trim() === "text/event-stream";
}

function parseSSEMessages(raw: string): EventSourceMessage[] {
  const events: EventSourceMessage[] = [];
  const parser = createParser({
    onEvent(event) {
      events.push(event);
    },
  });
  parser.feed(ensureDispatchTerminator(raw));
  return events;
}

function ensureDispatchTerminator(raw: string): string {
  return /\r?\n\r?\n$/.test(raw) ? raw : `${raw}\n\n`;
}

function trailingLineBreak(raw: string): string {
  if (/\r?\n\r?\n$/.test(raw)) {
    return "\n\n";
  }
  return /\r?\n$/.test(raw) ? "\n" : "";
}

function formatSSEMessage(event: EventSourceMessage): string {
  return [
    event.id ? `id:${event.id}` : undefined,
    event.event ? `event:${event.event}` : undefined,
    ...event.data.split("\n").map((line) => `data: ${line}`),
  ].filter((line) => line !== undefined).join("\n");
}

export type VercelMessageAdapterOptions = {
  blobStore?: BlobStore;
  // Chat 只支持 user 图片；Responses / Anthropic 支持工具结果中的图片。
  toolResultImages?: "native" | "user";
};

export async function toVercelMessages(
  messages: AgentMessage[],
  options: VercelMessageAdapterOptions = {},
): Promise<ModelMessage[]> {
  const converted: ModelMessage[] = await Promise.all(messages.map(async (message) => {
    switch (message.role) {
      case "user":
        return {
          role: "user",
          content: typeof message.content === "string"
            ? message.content
            : await Promise.all(message.content.map((part) => {
                if (part.type === "text") {
                  return Promise.resolve({
                    type: "text" as const,
                    text: part.text,
                  });
                }
                return toVercelImagePart(part, options);
              })),
        };
      case "assistant": {
        if (!message.toolCalls || message.toolCalls.length === 0) {
          return {
            role: "assistant",
            content: message.content,
          };
        }

        return {
          role: "assistant",
          content: [
            ...(message.content
              ? [
                  {
                    type: "text" as const,
                    text: message.content,
                  },
                ]
              : []),
            ...message.toolCalls.map((toolCall) => ({
              type: "tool-call" as const,
              toolCallId: toolCall.id,
              toolName: sanitizeToolName(toolCall.name),
              input: toolCall.arguments,
            })),
          ],
        };
      }
      case "tool":
        return {
          role: "tool",
          content: [
            {
              type: "tool-result" as const,
              toolCallId: message.toolCallId,
              toolName: sanitizeToolName(message.name),
              output: toToolResultOutput(message.content),
            },
          ],
        };
      case "system":
        return {
          role: "system",
          content: message.content,
        };
    }
  }));
  return options.toolResultImages === "user" ? moveToolImagesToUserMessages(converted) : converted;
}

export function hasImageContent(messages: AgentMessage[]): boolean {
  return messages.some((message) => {
    if (message.role === "user") {
      return Array.isArray(message.content) && message.content.some((part) => part.type === "image");
    }
    if (message.role === "tool") {
      try {
        return isDynamicToolImageResponse(JSON.parse(message.content));
      } catch {
        return false;
      }
    }
    return false;
  });
}

export function toVercelTools(tools: RegisteredTool[]): ToolSet {
  const sanitized = new Map<string, string>();
  return Object.fromEntries(
    tools.map((registeredTool) => {
      const safeName = sanitizeToolName(registeredTool.name);
      const collision = sanitized.get(safeName);
      if (collision && collision !== registeredTool.name) {
        throw new Error(
          `Tool name collision after sanitization: '${collision}' and '${registeredTool.name}' both map to '${safeName}'`
        );
      }
      sanitized.set(safeName, registeredTool.name);
      return [
        safeName,
        tool({
          description: registeredTool.description,
          inputSchema: jsonSchema(registeredTool.inputSchema as Parameters<typeof jsonSchema>[0]),
        }),
      ];
    })
  ) as ToolSet;
}

function toToolResultOutput(content: string): ToolResultPart["output"] {
  let value: JSONValue;
  try {
    value = JSON.parse(content) as JSONValue;
  } catch {
    return {
      type: "text" as const,
      value: content,
    };
  }
  if (!isDynamicToolImageResponse(value)) {
    return { type: "json" as const, value };
  }

  const { contentItems, ...metadata } = value;
  return {
    type: "content" as const,
    value: [
      { type: "text" as const, text: JSON.stringify(metadata) },
      ...contentItems.flatMap<TextPart | ReturnType<typeof toVercelToolImagePart>>((item, index) => item.type === "inputText"
        ? [{ type: "text", text: item.text }]
        : [
          // 包络与 Chat 归属文本会改变 SDK 数组下标，显式保留原 imageContentIndex 的指向。
          { type: "text", text: `图像 contentItems[${index}]：` },
          toVercelToolImagePart(item.imageUrl),
        ]),
    ],
  };
}

function isDynamicToolImageResponse(value: unknown): value is DynamicToolCallResponsePayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.callId === "string" && typeof payload.success === "boolean" &&
    Array.isArray(payload.contentItems) &&
    payload.contentItems.every((item) => typeof item === "object" && item !== null && (
      (item.type === "inputText" && typeof item.text === "string") ||
      (item.type === "inputImage" && typeof item.imageUrl === "string")
    )) && payload.contentItems.some((item) => item.type === "inputImage");
}

function toVercelToolImagePart(imageUrl: string) {
  const dataURL = /^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(imageUrl);
  if (dataURL) {
    return { type: "image-data" as const, mediaType: dataURL[1], data: dataURL[2] };
  }
  const url = new URL(imageUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Dynamic Tool image must be a base64 image data URL or an HTTP(S) URL.");
  }
  return { type: "image-url" as const, url: imageUrl };
}

function moveToolImagesToUserMessages(messages: ModelMessage[]): ModelMessage[] {
  const result: ModelMessage[] = [];
  let pendingImages: Array<TextPart | ImagePart> = [];
  const flushImages = () => {
    if (pendingImages.length === 0) return;
    result.push({ role: "user", content: pendingImages });
    pendingImages = [];
  };

  for (const message of messages) {
    if (message.role !== "tool") {
      flushImages();
      result.push(message);
      continue;
    }
    result.push({
      ...message,
      content: message.content.map((part) => {
        if (part.type !== "tool-result" || part.output.type !== "content" ||
          !part.output.value.some((item) => item.type === "image-data" || item.type === "image-url")) {
          return part;
        }
        const text: string[] = [];
        pendingImages.push({ type: "text", text: `工具 ${part.toolName}（toolCallId: ${part.toolCallId}）返回的图片及原始说明：` });
        for (const item of part.output.value) {
          switch (item.type) {
            case "text":
              text.push(item.text);
              pendingImages.push(item);
              break;
            case "image-data":
              pendingImages.push({ type: "image", image: Buffer.from(item.data, "base64"), mediaType: item.mediaType });
              break;
            case "image-url":
              pendingImages.push({ type: "image", image: new URL(item.url) });
              break;
            default:
              throw new Error(`Unsupported Dynamic Tool image content: ${item.type}`);
          }
        }
        text.push(`图片随本组工具结果后的消息提供（toolCallId: ${part.toolCallId}）。`);
        return { ...part, output: { type: "text" as const, value: text.join("\n") } };
      }),
    });
  }
  // 必须等一组 tool results 全部发完，再追加图片，保持 Chat 的 tool_call 配对顺序。
  flushImages();
  return result;
}

async function toVercelImagePart(
  part: AgentImageContentPart,
  options: VercelMessageAdapterOptions,
) {
  if (!options.blobStore) {
    throw new Error("Image content requires a BlobStore.");
  }
  const record = await options.blobStore.get(part.blobId);
  if (!record) {
    throw new Error(`Image blob not found: ${part.blobId}`);
  }
  if (record.kind !== "image") {
    throw new Error(`Blob is not an image: ${part.blobId}`);
  }
  return {
    type: "image" as const,
    image: await options.blobStore.readContent(part.blobId),
    mediaType: part.mimeType,
  };
}
