import type { BlobRecord } from "../blob/types/BlobRecord.ts";
import type { BlobStore } from "../blob/types/BlobStore.ts";
import type { LLMClientLike } from "../llm/LLMClient.ts";
import { completeLLM } from "../llm/LLMClient.ts";
import type { AgentMessage, ToolAgentMessage } from "./types/AgentMessage.ts";
import { renderStub } from "./Stub.ts";

export interface TurnSummarizerLike {
  summarizeTurn(messages: AgentMessage[]): Promise<void>;
  applyStoredSummaries(messages: AgentMessage[]): Promise<boolean>;
}

type TurnSummarizerOptions = {
  client: LLMClientLike;
  blobStore: BlobStore;
  concurrency?: number;
  warn?: (message: string) => void;
};

export class TurnSummarizer implements TurnSummarizerLike {
  private readonly concurrency: number;
  private readonly warn: (message: string) => void;

  constructor(private readonly options: TurnSummarizerOptions) {
    this.concurrency = options.concurrency ?? 4;
    this.warn = options.warn ?? ((message) => console.warn(message));
  }

  async summarizeTurn(messages: AgentMessage[]): Promise<void> {
    const targets = messages.filter(isUnsummarizedTurnToolMessage);
    await runWithConcurrency(targets, this.concurrency, (message) =>
      this.summarizeMessage(message),
    );
  }

  async applyStoredSummaries(messages: AgentMessage[]): Promise<boolean> {
    let changed = false;
    for (const message of messages) {
      if (!isUnsummarizedTurnToolMessage(message)) continue;
      const record = await this.options.blobStore.get(message.blob.id);
      if (!record?.summary) continue;
      this.renderSummary(message, record, record.summary);
      changed = true;
    }
    return changed;
  }

  private async summarizeMessage(message: ToolAgentMessage): Promise<void> {
    const blobId = message.blob?.id;
    if (!blobId) return;

    try {
      const record = await this.options.blobStore.get(blobId);
      if (!record) {
        throw new Error(`Blob not found: ${blobId}`);
      }
      const content = (await this.options.blobStore.readContent(blobId)).toString("utf8");
      const completion = await completeLLM(
        this.options.client,
        [
          {
            role: "system",
            content:
              "请把工具输出压缩成 1-3 句话中文摘要。保留行号、错误信息、关键变量、路径和后续可能引用的事实。",
          },
          {
            role: "user",
            content:
              `工具名: ${message.name}\n` +
              `toolCallId: ${message.toolCallId}\n` +
              `blobId: ${blobId}\n\n` +
              content,
          },
        ],
        [],
      );
      const summary = completion.message.content.trim();
      await this.options.blobStore.setSummary(blobId, summary);
      this.renderSummary(message, record, summary);
    } catch (error) {
      this.warn(
        `Failed to summarize tool result ${blobId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private renderSummary(
    message: ToolAgentMessage,
    record: BlobRecord,
    summary: string,
  ): void {
    message.content = renderStub({
      id: record.id,
      kind: record.kind,
      cached: "turn",
      summarized: true,
      size: record.size,
      path: record.path,
      body: summary,
    });
    message.blob = { id: record.id, cached: "turn", summarized: true };
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex++];
      await worker(item);
    }
  }));
}

function isUnsummarizedTurnToolMessage(
  message: AgentMessage,
): message is ToolAgentMessage {
  return (
    message.role === "tool" &&
    message.blob?.cached === "turn" &&
    message.blob.summarized !== true
  );
}
