import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { extname } from "node:path";
import { decodeImage } from "./ReadImage.ts";

const MAX_BYTES = 20 * 1024 * 1024;
const IMAGE_MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
export class LocalFileReader {
  async read(path: string, signal = new AbortController().signal): Promise<Record<string, unknown>> {
    signal.throwIfAborted();
    // A FIFO must be rejected by fstat without waiting for an external writer.
    const handle = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
    let bytes: Buffer;
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) throw new Error("目标不是可读取的普通文件");
      if (stat.size > MAX_BYTES) throw new Error(`文件超过 ${MAX_BYTES} bytes 读取上限，请拆分`);
      // Bounded read also covers a file growing after stat; no silent truncation.
      const buffer = Buffer.alloc(Math.min(stat.size + 1, MAX_BYTES + 1));
      let length = 0;
      while (length < buffer.length) {
        signal.throwIfAborted();
        const result = await handle.read(buffer, length, buffer.length - length, null);
        if (!result.bytesRead) break;
        length += result.bytesRead;
      }
      if (length > stat.size) throw new Error("读取期间文件发生增长，请重新读取");
      bytes = buffer.subarray(0, length);
    } finally { await handle.close(); }
    signal.throwIfAborted();
    const extension = extname(path).toLowerCase();
    if (extension === ".pdf") return { path, mimeType: "application/pdf", ...await readPDF(bytes, signal) };
    if (IMAGE_MIME[extension]) {
      const metadata = await decodeImage(bytes, IMAGE_MIME[extension]);
      signal.throwIfAborted();
      return { success: true, contentItems: [
        { type: "inputText", text: JSON.stringify({ path, ...metadata, imageContentIndex: 1 }) },
        { type: "inputImage", imageUrl: `data:${metadata.mimeType};base64,${bytes.toString("base64")}` },
      ] };
    }
    let content: string;
    try { content = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new Error("不支持的二进制或非 UTF-8 文本格式"); }
    if (/[\x00-\x08\x0b\x0e-\x1f]/.test(content)) throw new Error("不支持的二进制文件格式");
    return { path, mimeType: "text/plain", bytes: bytes.length, content, truncated: false };
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
