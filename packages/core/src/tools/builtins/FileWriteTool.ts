import { lstat, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { z } from "zod";
import { defineTool } from "../defineTool.ts";
import { isNotFoundError } from "../../utils/nodeErrors.ts";
import { requirePetRoot, resolvePetWritePath } from "./pet-path.ts";


const InputSchema = z.object({
  relativePath: z.string().describe("相对当前 Pet rootPath 的路径，禁止使用绝对路径"),
  content: z.string(),
}).strict();

export type FileWriteToolInput = z.infer<typeof InputSchema>;
export type FileWriteToolOutput = { relativePath: string; bytesWritten: number };

export const FILE_WRITE_MAX_BYTES = 10 * 1024 * 1024;

export const FileWriteTool = defineTool<FileWriteToolInput, FileWriteToolOutput, Record<string, never>>({
  name: "file.write",
  description:
    "写入当前 Thread 所属 Pet 固定目录内的文本文件。仅接受相对路径，不能改变归属或越过文件根；按既有 Permission 审批。",
  inputSchema: InputSchema,
  run: async (input, _deps, context): Promise<FileWriteToolOutput> => {
    const bytesWritten = Buffer.byteLength(input.content, "utf8");
    if (bytesWritten > FILE_WRITE_MAX_BYTES) {
      throw new Error(
        `File content exceeds ${FILE_WRITE_MAX_BYTES} byte limit: ${bytesWritten} bytes`,
      );
    }

    const rootPath = requirePetRoot(context.rootPath);
    const absolutePath = await resolvePetWritePath(rootPath, input.relativePath);
    return withTargetLock(absolutePath, async () => {
      context.signal?.throwIfAborted();
      await ensureTargetIsNotSymlink(absolutePath, input.relativePath);
      await mkdir(dirname(absolutePath), { recursive: true });
      const checkedPath = await resolvePetWritePath(rootPath, input.relativePath);
      if (checkedPath !== absolutePath) throw new Error("Write target changed while awaiting write");
      context.signal?.throwIfAborted();
      await atomicWriteFile(absolutePath, input.content, context.signal);
      return { relativePath: input.relativePath, bytesWritten };
    });
  },
});

async function ensureTargetIsNotSymlink(absolutePath: string, relativePath: string): Promise<void> {
  try {
    const stats = await lstat(absolutePath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Refuse to write through symlink at target: ${relativePath}`);
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }
    throw error;
  }
}

async function atomicWriteFile(absolutePath: string, content: string, signal?: AbortSignal): Promise<void> {
  const tempPath = `${absolutePath}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
    signal?.throwIfAborted();
    await ensureTargetIsNotSymlink(absolutePath, absolutePath);
    await rename(tempPath, absolutePath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

// Shared by all instances: different Pets sharing a real path share its write lock.
const writes = new Map<string, Promise<void>>();
async function withTargetLock<T>(path: string, write: () => Promise<T>): Promise<T> {
  const previous = writes.get(path) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  writes.set(path, current);
  await previous;
  try { return await write(); }
  finally { release(); if (writes.get(path) === current) writes.delete(path); }
}
