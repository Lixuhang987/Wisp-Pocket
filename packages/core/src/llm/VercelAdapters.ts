import { jsonSchema, tool, type JSONValue, type ModelMessage, type ToolSet } from "ai";
import { createParser, type EventSourceMessage } from "eventsource-parser";
import type { BlobStore } from "../blob/BlobStore.ts";
import type { AgentImageContentPart, AgentMessage } from "../runtime/AgentMessage.ts";
import type { RegisteredTool } from "../tools/ToolRegistry.ts";

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
  let pendingEmptyEvent: EventSourceMessage | undefined;

  for (const event of events) {
    if (event.data.trim() === "") {
      pendingEmptyEvent = event;
      continue;
    }
    const normalizedEvent = pendingEmptyEvent && !event.event
      ? { ...event, event: pendingEmptyEvent.event, id: event.id ?? pendingEmptyEvent.id }
      : event;
    filteredEvents.push(...splitNewlineDelimitedJSONEvent(normalizedEvent));
    pendingEmptyEvent = undefined;
  }

  if (filteredEvents.length === 0) {
    return "";
  }
  return filteredEvents.map(formatSSEMessage).join("\n\n") + trailingLineBreak(raw);
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
  let pending = "";

  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      pending += decoder.decode(chunk, { stream: true });
      const lastLineBreak = Math.max(pending.lastIndexOf("\n"), pending.lastIndexOf("\r"));
      if (lastLineBreak === -1) {
        return;
      }
      const complete = pending.slice(0, lastLineBreak + 1);
      pending = pending.slice(lastLineBreak + 1);
      const filtered = filterEmptySSEDataEvents(complete);
      if (filtered) {
        controller.enqueue(encoder.encode(filtered));
      }
    },
    flush(controller) {
      const finalText = pending + decoder.decode();
      const filtered = filterEmptySSEDataEvents(finalText);
      if (filtered) {
        controller.enqueue(encoder.encode(filtered));
      }
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
};

export async function toVercelMessages(
  messages: AgentMessage[],
  options: VercelMessageAdapterOptions = {},
): Promise<ModelMessage[]> {
  return Promise.all(messages.map(async (message) => {
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
}

export function hasImageContent(messages: AgentMessage[]): boolean {
  return messages.some(
    (message) =>
      message.role === "user" &&
      Array.isArray(message.content) &&
      message.content.some((part) => part.type === "image"),
  );
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

function toToolResultOutput(content: string) {
  try {
    return {
      type: "json" as const,
      value: JSON.parse(content) as JSONValue,
    };
  } catch {
    return {
      type: "text" as const,
      value: content,
    };
  }
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
