import type { AgentMessage, UserAgentMessage } from "@handagent/core/runtime/types/AgentMessage.ts";
import type { AgentRuntimeEvent } from "@handagent/core/runtime/AgentRuntime.ts";
import type {
  ThreadNotification,
  AssistantDeltaNotification,
  ToolStartedNotification,
  ToolFinishedNotification,
  ThreadErrorNotification,
} from "@handagent/core/protocol/types/ThreadNotification.ts";
import type { ThreadAttachment, ImageAttachment } from "@handagent/core/protocol/types/ThreadProtocolShared.ts";
import type { InputItem, UserInput } from "@handagent/core/protocol/types/Op.ts";
import type { ConversationMessage } from "@handagent/core/conversation/types/ConversationMessage.ts";
import type { ThreadAuditEvent } from "@handagent/thread-store/index.ts";
import type { BlobStore } from "@handagent/core/blob/types/BlobStore.ts";
import { parseStub, renderStub } from "@handagent/core/runtime/Stub.ts";
import { extension, lookup } from "mime-types";

export function toThreadNotification(
  threadId: string,
  turnId: string,
  event: AgentRuntimeEvent,
  timestamp: string,
  notificationSequence?: number,
):
  | AssistantDeltaNotification
  | ToolStartedNotification
  | ToolFinishedNotification
  | ThreadErrorNotification
  | null {
  switch (event.type) {
    case "assistant_message_delta":
      return {
        type: "assistant.delta",
        threadId,
        notificationId: makeNotificationId(
          threadId,
          event.messageId,
          timestamp,
          "delta",
          notificationSequence,
        ),
        turnId,
        itemId: `${threadId}-${turnId}-${event.messageId}`,
        timestamp,
        payload: { ...event.payload },
      };
    case "tool_call":
      return {
        type: "tool.started",
        threadId,
        notificationId: makeNotificationId(
          threadId,
          event.toolCallId,
          timestamp,
          "start",
          notificationSequence,
        ),
        turnId,
        itemId: `${threadId}-${event.toolCallId}`,
        timestamp,
        payload: {
          name: event.toolName,
          input: event.input,
        },
      };
    case "tool_result":
      return {
        type: "tool.finished",
        threadId,
        notificationId: makeNotificationId(
          threadId,
          event.toolCallId,
          timestamp,
          "finish",
          notificationSequence,
        ),
        turnId,
        itemId: `${threadId}-${event.toolCallId}`,
        timestamp,
        payload: {
          name: event.toolName,
          status: event.status === "success" ? "completed" : "failed",
          output: event.output,
          durationMs: event.durationMs,
        },
      };
    case "runtime_error":
      return {
        type: "thread.error",
        threadId,
        notificationId: makeNotificationId(
          threadId,
          "runtime",
          timestamp,
          "error",
          notificationSequence,
        ),
        timestamp,
        payload: {
          code: event.code,
          message: event.message,
        },
      };
    case "assistant_message_start":
    case "assistant_message_end":
    case "permission_decision":
      return null;
  }
}

function makeNotificationId(
  threadId: string,
  itemId: string,
  timestamp: string,
  suffix: string,
  sequence?: number,
): string {
  const sequencePart = sequence === undefined ? "" : `-${sequence}`;
  return `${threadId}-${itemId}-${timestamp}${sequencePart}-${suffix}`;
}

export function toAuditEvent(event: AgentRuntimeEvent, timestamp: string): ThreadAuditEvent | null {
  switch (event.type) {
    case "tool_call":
      return {
        type: "tool_call",
        timestamp,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        input: event.input,
      };
    case "tool_result":
      return {
        type: "tool_result",
        timestamp,
        toolCallId: event.toolCallId,
        status: event.status,
        output: event.output,
        durationMs: event.durationMs,
      };
    case "permission_decision":
      return {
        type: "permission_request",
        timestamp,
        toolName: event.toolName,
        action: event.decision,
        granted: event.decision === "allow",
      };
    case "runtime_error":
      return {
        type: "error",
        timestamp,
        message: event.message,
        code: event.code,
      };
    default:
      return null;
  }
}

export function agentMessagesToConversation(messages: AgentMessage[]): ConversationMessage[] {
  const latestUser = messages.findLastIndex((message) => message.role === "user");
  const latestAssistant = messages.findLastIndex((message) => message.role === "assistant" && !!message.content.trim());
  return messages.map((msg, idx) => {
    const id = ("id" in msg ? msg.id : undefined) ?? `msg-${idx}`;
    const now = new Date(0).toISOString();
    if (msg.role === "tool") {
      return {
        id,
        role: "tool",
        text: msg.content,
        status: "completed",
        createdAt: now,
        updatedAt: now,
        toolCall: { name: msg.name },
      };
    }
    return {
      id,
      role: msg.role,
      text: msg.role === "user" && msg.inputItems
        ? summarizeUserInput({ items: msg.inputItems })
        : typeof msg.content === "string" ? msg.content : "",
      ...(msg.role === "user" && msg.inputItems ? { inputItems: msg.inputItems } : {}),
      ...(msg.role === "assistant" && msg.suggestedReplies ? { suggestedReplies: msg.suggestedReplies } : {}),
      ...(msg.role === "assistant" && msg.awaitingReply && idx === latestAssistant && idx > latestUser ? { awaitingReply: true } : {}),
      status: "completed",
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function agentMessagesToRuntimeMessages(messages: AgentMessage[]): AgentMessage[] {
  return messages.map((message) => {
    if (message.role !== "user" || typeof message.content !== "string") {
      return message;
    }

    const content = parseRuntimeUserContent(message.content);
    if (typeof content === "string") {
      return message;
    }
    return {
      ...message,
      content,
    };
  });
}

export async function composeUserContent(
  text: string,
  attachments: ThreadAttachment[] | undefined,
  blobStore: BlobStore,
): Promise<string> {
  if (!attachments || attachments.length === 0) return text;
  const parts: string[] = [text];
  for (const attachment of attachments) {
    if (attachment.kind === "text_selection") {
      parts.push(`[选区]\n${attachment.text}`);
    } else if (attachment.kind === "image") {
      const record = await blobStore.put({
        kind: "image",
        bytes: Buffer.from(attachment.base64, "base64"),
        extension: imageExtension(attachment.mimeType),
      });
      parts.push(renderStub({
        id: record.id,
        kind: record.kind,
        size: record.size,
        path: record.path,
      }));
    }
  }
  return parts.join("\n\n");
}

export async function composeUserInputContent(
  userInput: UserInput,
  blobStore: BlobStore,
): Promise<string> {
  const parts: string[] = [];
  for (const item of userInput.items) {
    switch (item.type) {
      case "text":
        if (item.text.length > 0) parts.push(item.text);
        break;
      case "skill":
        if (item.prompt.length > 0) parts.push(item.prompt);
        break;
      case "text_selection":
        if (item.text.length > 0) parts.push(`[选区]\n${item.text}`);
        break;
      case "image":
      case "pdf": {
        const record = item.blobId
          ? await blobStore.get(item.blobId)
          : await blobStore.put({ kind: item.type, bytes: Buffer.from(item.base64!, "base64"),
            extension: item.type === "pdf" ? "pdf" : imageExtension(item.mimeType) });
        if (!record) throw new Error(`附件副本不存在：${item.name ?? item.id}`);
        if (item.type === "pdf") parts.push(`PDF：${item.name}`);
        parts.push(renderStub({
          id: record.id,
          kind: record.kind,
          size: record.size,
          path: record.path,
        }));
        break;
      }
    }
  }
  return parts.join("\n\n");
}

/** The history and every renderer refer to the saved copy, never the original file. */
export async function storeUserInput(input: UserInput, blobStore: BlobStore): Promise<UserInput> {
  const items: InputItem[] = [];
  for (const item of input.items) {
    if (item.type !== "image" && item.type !== "pdf") { items.push({ ...item }); continue; }
    if (item.blobId) {
      if (!/^blob-[a-zA-Z0-9-]+$/.test(item.blobId)) throw new Error("无效的附件引用");
      const record = await blobStore.get(item.blobId);
      if (!record || record.kind !== item.type) throw new Error(`附件副本不存在：${item.name ?? item.id}`);
      items.push({ ...item });
      continue;
    }
    const record = await blobStore.put({
      kind: item.type, bytes: Buffer.from(item.base64!, "base64"),
      extension: item.type === "pdf" ? "pdf" : imageExtension(item.mimeType),
    });
    const { base64: _bytes, ...metadata } = item;
    items.push({ ...metadata, blobId: record.id } as InputItem);
  }
  return { items };
}

export function summarizeUserInput(userInput: UserInput): string {
  const parts = userInput.items.map((item) => {
    switch (item.type) {
      case "text":
        return item.text;
      case "skill":
        return item.prompt;
      case "text_selection":
        return `[选区]\n${item.text}`;
      case "image":
        return item.name ?? "图片附件";
      case "pdf":
        return `PDF：${item.name}`;
    }
  }).filter((part) => part.trim().length > 0);
  return parts.join("\n\n");
}

export function cloneInputItems(items: UserInput["items"]): UserInput["items"] {
  return structuredClone(items);
}

export function deriveTitle(text: string): string {
  const trimmed = text.trim().replace(/\n.*/s, "");
  if (trimmed.length <= 50) return trimmed;
  return trimmed.slice(0, 47) + "...";
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Agent runtime failed.";
}

function parseRuntimeUserContent(content: string): UserAgentMessage["content"] {
  const stubPattern = /\[STUB [^\]]*\]\n[\s\S]*?\n?\[\/STUB\]/g;
  const parts: Exclude<UserAgentMessage["content"], string> = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = stubPattern.exec(content)) !== null) {
    appendTextPart(parts, content.slice(cursor, match.index));
    const stubText = match[0];
    try {
      const stub = parseStub(stubText);
      if (stub.kind === "image") {
        const mimeType = mimeTypeForPath(stub.path);
        if (mimeType) {
          parts.push({ type: "image", blobId: stub.id, mimeType });
        } else {
          appendTextPart(parts, stubText);
        }
      } else {
        appendTextPart(parts, stubText);
      }
    } catch {
      appendTextPart(parts, stubText);
    }
    cursor = match.index + stubText.length;
  }

  appendTextPart(parts, content.slice(cursor));
  if (!parts.some((part) => part.type === "image")) {
    return content;
  }
  return parts;
}

function appendTextPart(
  parts: Exclude<UserAgentMessage["content"], string>,
  text: string,
): void {
  const normalized = text.trim();
  if (!normalized) return;
  parts.push({ type: "text", text: normalized });
}

function mimeTypeForPath(path: string): "image/png" | "image/jpeg" | "image/webp" | undefined {
  const mimeType = lookup(path);
  return isSupportedImageMimeType(mimeType) ? mimeType : undefined;
}

function imageExtension(mimeType: ImageAttachment["mimeType"]): string {
  return extension(mimeType) || "bin";
}

function isSupportedImageMimeType(mimeType: string | false): mimeType is ImageAttachment["mimeType"] {
  return mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/webp";
}
