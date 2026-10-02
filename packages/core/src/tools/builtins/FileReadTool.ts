import { isAbsolute, resolve } from "node:path";
import { z } from "zod";
import { defineTool } from "../defineTool.ts";
import { requirePetRoot } from "./pet-path.ts";

const InputSchema = z.object({ path: z.string().refine(value => value.trim().length > 0).describe("本地绝对路径，或相对当前 Pet 固定文件根的路径") }).strict();
export type FileReadToolInput = z.infer<typeof InputSchema>;
export type FileReadToolOutput = Record<string, unknown>;
export type LocalFileReader = { read(path: string, signal?: AbortSignal): Promise<FileReadToolOutput> };

export const FileReadTool = defineTool<FileReadToolInput, FileReadToolOutput, LocalFileReader>({
  name: "file.read",
  description: "按需读取本地文本、PDF、PNG/JPEG/WebP 的当前内容。默认可用且免确认，允许任意绝对路径；相对路径基于当前 Pet 固定目录。文件失效或无法解码时明确报错，不使用提交时副本。",
  inputSchema: InputSchema,
  requiresPermission: false,
  run: async ({ path }, reader, context) => reader.read(isAbsolute(path) ? path : resolve(requirePetRoot(context.rootPath), path), context.signal),
});
