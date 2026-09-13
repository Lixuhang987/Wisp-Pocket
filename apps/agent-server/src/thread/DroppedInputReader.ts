import type { BlobStore } from "@handagent/core/blob/types/BlobStore.ts";
import type { UserInput } from "@handagent/core/protocol/types/Op.ts";
import type { PreparedInput } from "@handagent/core/thread/types/ThreadServices.ts";
import { FetchPageTool, type FetchPageOutput } from "@handagent/core/tools/web/WebTools.ts";

type Options = {
  blobStore: BlobStore;
  fetchPage?: (url: string) => Promise<FetchPageOutput>;
};

/** Reads only material explicitly delivered in this input, after its durable receipt. */
export class DroppedInputReader {
  private readonly fetchPage: NonNullable<Options["fetchPage"]>;

  constructor(private readonly options: Options) {
    const tool = FetchPageTool.create({});
    this.fetchPage = options.fetchPage ?? ((url) => tool.call({ url, maxChars: 12_000 }));
  }

  async read(input: UserInput, signal: AbortSignal): Promise<PreparedInput> {
    const messages: PreparedInput["messages"] = [];
    const failures: string[] = [];
    for (const item of input.items) {
      signal.throwIfAborted();
      const urls = item.type === "text" ? item.text.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^https?:\/\/\S+$/.test(line)) : [];
      const sources = item.type === "pdf" || item.type === "image" ? [item.name ?? "图片"] : urls;
      for (const source of sources) {
        const callId = `read-${crypto.randomUUID()}`;
        let result: Record<string, unknown>;
        try {
          if (item.type === "pdf") {
            if (!item.blobId) throw new Error("PDF 尚未保存为附件副本");
            result = await readPDF(await this.options.blobStore.readContent(item.blobId), signal);
          } else if (item.type === "image") {
            if (!item.blobId) throw new Error("图片尚未保存为附件副本");
            const bytes = await this.options.blobStore.readContent(item.blobId);
            validateImage(bytes, item.mimeType);
            // The actual image is supplied through the existing multimodal Blob path.
            continue;
          } else {
            const page = await this.fetchPage(source);
            if (!page.content.trim()) throw new Error("网页没有可读取的正文");
            result = { ...page };
          }
          signal.throwIfAborted();
        } catch (error) {
          signal.throwIfAborted();
          const message = error instanceof Error ? error.message : String(error);
          failures.push(`${source}：${message}`);
          result = { error: message };
        }
        messages.push(
          { role: "assistant", content: "", toolCalls: [{ id: callId, name: "input.read", arguments: { inputItemId: item.id, source } }] },
          { role: "tool", toolCallId: callId, name: "input.read", content: JSON.stringify({ source, ...result }) },
        );
      }
    }
    return {
      messages,
      ...(failures.length ? { error: `输入已经保存，但这次没能读完：\n${failures.join("\n")}\n你可以补充正文、换一份文件，或告诉我接下来怎么处理。` } : {}),
    };
  }
}

async function readPDF(bytes: Buffer, signal: AbortSignal): Promise<Record<string, unknown>> {
  if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new Error("文件不是有效的 PDF");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  signal.throwIfAborted();
  const task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: true, disableFontFace: true });
  const abort = () => { void task.destroy(); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const document = await task.promise;
    if (document.numPages > 200) throw new Error(`PDF 有 ${document.numPages} 页，超过本次可读取的 200 页；请拆分后交给我`);
    const pages: string[] = [];
    let length = 0;
    for (let index = 1; index <= document.numPages; index += 1) {
      signal.throwIfAborted();
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      const text = content.items.map((item) => "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : "").join("").trim();
      pages.push(`[第 ${index} 页]\n${text}`);
      length += text.length;
      page.cleanup();
      if (length > 80_000) throw new Error("PDF 正文超过本次可读取的 8 万字；请拆分后交给我");
    }
    if (!pages.some((text) => text.replace(/^\[第 \d+ 页\]\n/, "").trim())) throw new Error("PDF 没有可提取的文字，可能是扫描版；请提供图片或可复制文字的版本");
    return { pages: document.numPages, content: pages.join("\n\n") };
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof Error && error.name === "PasswordException") throw new Error("PDF 需要密码，请提供解锁后的副本");
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    await task.destroy();
  }
}

function validateImage(bytes: Buffer, mimeType: string): void {
  const valid = mimeType === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mimeType === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) throw new Error("图片数据损坏，或格式与文件类型不符");
}
