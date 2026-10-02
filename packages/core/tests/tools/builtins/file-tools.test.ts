import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileWriteTool } from "../../../src/tools/builtins/FileWriteTool.ts";

const directories: string[] = [];
afterEach(async () => { for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true }); });
async function root() { const dir = await mkdtemp(join(tmpdir(), "pet-files-")); directories.push(dir); return dir; }

describe("Pet固定根的实际文件写入", () => {
  it("两个Thread共用根时顺序覆盖同一文件，其他目录保持独立", async () => {
    const rootPath = await root();
    const tool = FileWriteTool.create({});
    await Promise.all([
      tool.call({ relativePath: "notes/today.md", content: "甲".repeat(10000) }, { rootPath, threadId: "a" }),
      tool.call({ relativePath: "notes/today.md", content: "乙".repeat(10000) }, { rootPath, threadId: "b" }),
      tool.call({ relativePath: "notes/other.md", content: "独立文件" }, { rootPath, threadId: "a" }),
    ]);
    expect(["甲".repeat(10000), "乙".repeat(10000)]).toContain(await readFile(join(rootPath, "notes/today.md"), "utf8"));
    await tool.call({ relativePath: "notes/today.md", content: "最终覆盖" }, { rootPath });
    expect(await readFile(join(rootPath, "notes/today.md"), "utf8")).toBe("最终覆盖");
    expect(await readFile(join(rootPath, "notes/other.md"), "utf8")).toBe("独立文件");
  });
  it("上下文缺失、越界、绝对路径和冒充归属不会写入", async () => {
    const rootPath = await root(); const tool = FileWriteTool.create({});
    await expect(tool.call({ relativePath: "x", content: "x" })).rejects.toThrow("rootPath");
    for (const relativePath of ["../outside", "/tmp/outside"]) {
      await expect(tool.call({ relativePath, content: "x" }, { rootPath })).rejects.toThrow();
    }
    await expect(tool.call({ relativePath: "x", content: "x", workspaceId: "other" } as never, { rootPath })).rejects.toThrow("workspaceId");
  });
  it("拒绝目标符号链接及尚不存在子目录背后的符号链接越界", async () => {
    const rootPath = await root(); const outside = await root(); const tool = FileWriteTool.create({});
    await writeFile(join(outside, "victim"), "原文");
    await symlink(join(outside, "victim"), join(rootPath, "victim"));
    await symlink(outside, join(rootPath, "outside"));
    for (const relativePath of ["victim", "outside/new/nested.txt"]) {
      await expect(tool.call({ relativePath, content: "被覆盖" }, { rootPath })).rejects.toThrow();
    }
    expect(await readFile(join(outside, "victim"), "utf8")).toBe("原文");
  });
  it("限制内容大小，已中断调用不写盘", async () => {
    const rootPath = await root(); const tool = FileWriteTool.create({});
    await expect(tool.call({ relativePath: "big", content: "x".repeat(10 * 1024 * 1024 + 1) }, { rootPath })).rejects.toThrow("exceeds");
    await expect(tool.call({ relativePath: "cancelled", content: "x" }, { rootPath, signal: AbortSignal.abort() })).rejects.toThrow();
    await expect(readFile(join(rootPath, "cancelled"))).rejects.toThrow();
  });
});
