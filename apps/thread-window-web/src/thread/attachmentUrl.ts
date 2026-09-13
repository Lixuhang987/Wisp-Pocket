import type { InputItem } from "../protocol/threadProtocol.ts";

export function attachmentUrl(item: Extract<InputItem, { type: "image" | "pdf" }>, webSocketURL: string): string {
  if (item.base64 !== undefined) return `data:${item.mimeType};base64,${item.base64}`;
  const url = new URL(webSocketURL);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = `/api/blobs/${encodeURIComponent(item.blobId)}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
