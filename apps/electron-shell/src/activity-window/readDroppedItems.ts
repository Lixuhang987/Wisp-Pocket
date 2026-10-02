import type { InputItem } from "../../../thread-window-web/src/protocol/threadProtocol.ts";

/** Capture paths while the browser still owns the drop. Never read file bytes. */
export async function readDroppedItems(data: DataTransfer, getPath: (file: File) => string = file => window.handAgentPet?.getPathForFile(file) ?? ""): Promise<InputItem[]> {
  const files = Array.from(data.files);
  const links = data.getData("text/uri-list").split(/\r?\n/).filter(line => line.trim() && !line.startsWith("#")).join("\n");
  const text = links || data.getData("text/plain");
  if (files.length) return files.map(file => {
    const path = getPath(file);
    if (!path.startsWith("/")) throw new Error(`「${file.name}」没有可交付的本地原路径，请从 Finder 拖入原文件。`);
    return pathInput(path, file.name, file.type);
  });
  if (text.trim()) return [{ type: "text", id: crypto.randomUUID(), text }];
  throw new Error("没有收到可交付的内容。请拖入文字、链接或本地原文件。");
}

export function pathInput(path: string, name?: string, mimeType?: string): InputItem {
  return { type: "text", id: crypto.randomUUID(), text: `本地文件路径（尚未读取）：${JSON.stringify(path)}${name ? `\n文件名：${name}` : ""}${mimeType ? `\n媒体类型：${mimeType}` : ""}` };
}
