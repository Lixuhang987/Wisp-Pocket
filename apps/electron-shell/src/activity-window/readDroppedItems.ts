import type { InputItem } from "../../../thread-window-web/src/protocol/threadProtocol.ts";

/** Capture the browser-owned drag payload before yielding to any asynchronous read. */
export async function readDroppedItems(data: DataTransfer): Promise<InputItem[]> {
  const files = Array.from(data.files);
  const links = data.getData("text/uri-list").split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("#")).join("\n");
  const text = links || data.getData("text/plain");
  if (files.length) return Promise.all(files.map(readFile));
  if (text.trim()) return [{ type: "text", id: crypto.randomUUID(), text }];
  throw new Error("没有收到可读取的内容。可以拖入文本、链接、PNG/JPEG/WebP 图片或 PDF。");
}

async function readFile(file: File): Promise<InputItem> {
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  const mimeType = file.type || ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" } as Record<string, string>)[extension ?? ""];
  if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(mimeType)) {
    throw new Error(`暂不支持「${file.name}」。请交给我 PNG/JPEG/WebP 图片或 PDF。`);
  }
  if (file.size > 20 * 1024 * 1024) throw new Error(`「${file.name}」超过 20 MB，尚未提交。请缩小文件后再试。`);
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取「${file.name}」，尚未提交。请重新拖入。`));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.readAsDataURL(file);
  });
  const item = { id: crypto.randomUUID(), name: file.name, base64 };
  return mimeType === "application/pdf" ? { ...item, type: "pdf", mimeType }
    : { ...item, type: "image", mimeType: mimeType as "image/png" | "image/jpeg" | "image/webp" };
}
