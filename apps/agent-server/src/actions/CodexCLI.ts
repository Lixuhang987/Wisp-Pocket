import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, join } from "node:path";
import { z } from "zod";
import { fileURLToPath } from "node:url";

export type CodexReadiness = {
  state: "ready" | "not_installed" | "not_logged_in" | "unavailable";
  message: string;
  version?: string;
};
export type CodexResult = {
  success: boolean;
  sessionId?: string;
  reply: string;
  changes: { path: string; kind: string }[];
  exitCode: number | null;
  error?: string;
  truncated: boolean;
  diagnostics?: string[];
};
type Command = { executable: string; prefixArgs?: string[] };
const sessionSchema = z.uuid();
const taskResultSchema = z.object({success:z.boolean(),reply:z.string().min(1),error:z.string().nullable()}).strict();
const outputSchemaPath = fileURLToPath(new URL("./codex-result-schema.json", import.meta.url));
const MAX_RESULT_BYTES = 7500;
const MAX_LINE_BYTES = 2 * 1024 * 1024;

/** Produces valid bounded JSON for both model history and the existing result card. */
export function boundCodexResult(result: CodexResult): CodexResult {
  const bounded = { ...result, changes: result.changes.slice(0, 100), reply: result.reply.slice(0, 6000), error: result.error?.slice(0, 1500), diagnostics: result.diagnostics?.slice(0, 8).map(message=>message.slice(0, 500)) };
  bounded.truncated ||= bounded.reply !== result.reply || bounded.error !== result.error || bounded.changes.length !== result.changes.length;
  while (Buffer.byteLength(JSON.stringify(bounded)) > MAX_RESULT_BYTES) {
    bounded.truncated = true;
    if (bounded.reply.length > 512) bounded.reply = bounded.reply.slice(0, Math.floor(bounded.reply.length / 2));
    else if (bounded.changes.length) bounded.changes.pop();
    else if (bounded.diagnostics?.length) bounded.diagnostics.pop();
    else if (bounded.reply.length) bounded.reply = bounded.reply.slice(0, Math.floor(bounded.reply.length / 2));
    else bounded.error = bounded.error?.slice(0, Math.floor(bounded.error.length / 2));
  }
  return bounded;
}

export class CodexCLI {
  constructor(private readonly options: { command: Command } | { searchPath: string; homePath: string }) {}

  // Native app launches can have a minimal PATH. Search standard install locations too.
  private async command(): Promise<Command> {
    if ("command" in this.options) return this.options.command;
    const home = this.options.homePath;
    const directories = [...this.options.searchPath.split(delimiter),
      "/opt/homebrew/bin", "/usr/local/bin", join(home, ".local/bin"), join(home, ".npm-global/bin")];
    for (const directory of new Set(directories.filter(Boolean))) {
      const executable = join(directory, "codex");
      try { await access(executable, constants.X_OK); return { executable }; } catch { /* Try next known location. */ }
    }
    throw new Error("未找到 Codex CLI。请安装 Codex CLI，并让桌面应用可访问其可执行文件。");
  }

  async readiness(): Promise<CodexReadiness> {
    let command: Command;
    try { command = await this.command(); }
    catch { return { state: "not_installed", message: "未找到 Codex CLI。请先安装，再重新检查。" }; }
    try {
      const version = await probe(command, ["--version"]);
      if (version.code !== 0) return { state: "unavailable", message: "Codex CLI 无法启动，请在终端检查安装与配置。" };
      const login = await probe(command, ["login", "status"]);
      if (login.code === 1 && login.notLoggedIn) return { state: "not_logged_in", version: version.output.trim(), message: "Codex CLI 尚未登录。请在终端运行 codex login 后重新检查。" };
      if (login.code !== 0) return { state: "unavailable", message: "无法检查 Codex 登录状态，请在终端检查安装与配置。" };
      return { state: "ready", version: version.output.trim(), message: "Codex CLI 已安装并登录。执行沿用用户的模型、配置与权限。" };
    } catch { return { state: "unavailable", message: "Codex CLI 检查失败或超时，请在终端检查安装与配置。" }; }
  }

  async execute(input: {
    prompt: string; sessionId?: string; rootPath: string;
    onSession: (sessionId: string) => Promise<void>;
  }): Promise<CodexResult> {
    const result: CodexResult = {success:false, sessionId:input.sessionId, reply:"", changes:[], exitCode:null, truncated:false};
    let child: ChildProcessWithoutNullStreams;
    try {
      const command = await this.command();
      const args = ["exec", "--cd", input.rootPath, "--json", "--skip-git-repo-check", "--output-schema", outputSchemaPath,
        ...(input.sessionId ? ["resume", input.sessionId] : []), "-"];
      // No shell, model-supplied argv, permission override or AbortSignal forwarding.
      child = spawn(command.executable, [...(command.prefixArgs ?? []), ...args], {cwd:input.rootPath, stdio:"pipe"});
    } catch (error) {
      return boundCodexResult({...result, error: errorMessage(error)});
    }
    let startupError: string | undefined;
    const closed = new Promise<void>(resolve => {
      child.on("error", error => { startupError = errorMessage(error); });
      child.on("close", (code, signal) => { result.exitCode = code; if (signal) startupError = `Codex exited with signal ${signal}`; resolve(); });
    });
    // Drain stderr but keep only bounded diagnostics; it is never streamed into Thread events.
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { if (stderr.length < 1500) stderr += chunk.slice(0, 1500 - stderr.length); });
    child.stdin.on("error", error => { startupError ??= errorMessage(error); });
    child.stdin.end(input.prompt);
    let completed = false;
    let taskResult: z.infer<typeof taskResultSchema> | undefined;
    const diagnostics: string[] = [];
    const diagnose = (value: unknown) => {
      const message = typeof value === "string" ? value : "Codex 执行诊断";
      if (diagnostics.length < 8) diagnostics.push(message.slice(0, 500));
      else result.truncated = true;
      if (message.length > 500) result.truncated = true;
    };
    let seenSession = false;
    const failures: string[] = [];
    let failureTruncated = false;
    const fail = (value: unknown) => {
      const message = typeof value === "string" ? value : "Codex 执行失败。";
      if (message.length > 1500) failureTruncated = true;
      if (failures.length < 8) failures.push(message.slice(0, 1500));
      else failureTruncated = true;
    };
    try {
      for await (const line of jsonLines(child)) {
        let event: any;
        try { event = JSON.parse(line); } catch { fail("Codex 输出不是有效 JSONL。"); continue; }
        if (!event || typeof event !== "object") { fail("Codex 输出事件无效。"); continue; }
        if (event.type === "thread.started") {
          if (!sessionSchema.safeParse(event.thread_id).success || (input.sessionId && event.thread_id !== input.sessionId) || (seenSession && event.thread_id !== result.sessionId)) {
            fail("Codex 返回的会话身份无效或与指定会话不一致。"); continue;
          }
          result.sessionId = event.thread_id;
          seenSession = true;
          try { await input.onSession(event.thread_id); }
          catch (error) { fail(`Codex 会话关联保存失败：${errorMessage(error)}`); }
        } else if (event.type === "turn.completed") completed = true;
        else if (event.type === "turn.failed") fail(event.error?.message ?? "Codex 执行失败。");
        else if (event.type === "error") diagnose(event.message);
        else if (event.type === "wisp.output_truncated") {
          result.truncated = true;
          fail("Codex 单行输出超过大小限制，无法核对完整执行状态。请依据最终正文另行验证任务结果。");
        }
        else if (event.type === "item.completed") {
          const item = event.item;
          if (item?.type === "agent_message" && typeof item.text === "string") {
            try {
              const parsed = taskResultSchema.safeParse(JSON.parse(item.text));
              if (parsed.success) taskResult = parsed.data;
              else taskResult = undefined;
            } catch { taskResult = undefined; }
          }
          if (item?.type === "file_change" && Array.isArray(item.changes)) {
            for (const change of item.changes) {
              if (typeof change.path !== "string" || typeof change.kind !== "string") continue;
              result.truncated ||= change.path.length > 1000 || change.kind.length > 40;
              if (result.changes.length < 100) result.changes.push({path:change.path.slice(0, 1000), kind:change.kind.slice(0, 40)});
              else result.truncated = true;
            }
          }
          if (item?.type === "error" || item?.status === "failed") diagnose(item.message ?? item.aggregated_output ?? "Codex 步骤失败；最终任务报告说明是否已恢复。");
        }
      }
    } catch (error) { fail(errorMessage(error)); }
    await closed;
    if (startupError) fail(startupError);
    if (result.exitCode !== 0) fail(`Codex 退出码：${result.exitCode ?? "unknown"}${stderr ? `；${stderr}` : ""}`);
    if (!seenSession) fail("Codex 未返回有效会话身份。");
    if (!completed) fail("Codex 未确认本次 Turn 完成。");
    if (!taskResult) fail("Codex 未返回符合任务结果契约的最终回复，无法确认任务结果。");
    else {
      result.reply = taskResult.reply;
      if (!taskResult.success || taskResult.error) fail(taskResult.error || "Codex 报告任务尚未完成，请核对最终回复。");
    }
    result.diagnostics = diagnostics;
    result.success = failures.length === 0;
    result.error = failures.length ? failures.join("\n") : undefined;
    result.truncated ||= failureTruncated;
    return boundCodexResult(result);
  }
}

// Bound each line while still draining an arbitrarily verbose child process.
async function* jsonLines(child: ChildProcessWithoutNullStreams): AsyncGenerator<string> {
  child.stdout.setEncoding("utf8");
  let pending = ""; let oversized = false;
  for await (const chunk of child.stdout) {
    const parts = String(chunk).split("\n");
    for (let i = 0; i < parts.length; i++) {
      if (!oversized) {
        pending += parts[i];
        if (Buffer.byteLength(pending) > MAX_LINE_BYTES) { pending = ""; oversized = true; }
      }
      if (i < parts.length - 1) {
        if (oversized) yield JSON.stringify({type:"wisp.output_truncated"});
        else if (pending.trim()) yield pending;
        pending = ""; oversized = false;
      }
    }
  }
  if (oversized) yield JSON.stringify({type:"wisp.output_truncated"});
  else if (pending.trim()) yield pending;
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }

// A readiness probe is bounded; actual task execution deliberately has no timeout/termination.
function probe(command: Command, args: string[]): Promise<{code:number|null;output:string;notLoggedIn:boolean}> {
  return new Promise((resolve,reject) => {
    const child = spawn(command.executable,[...(command.prefixArgs ?? []),...args],{stdio:["ignore","pipe","pipe"]});
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { if (output.length < 300) output += chunk.slice(0,300-output.length); });
    let diagnostic = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { if (diagnostic.length < 2000) diagnostic += chunk.slice(0,2000-diagnostic.length); });
    // Only classify the known logged-out message. Never return raw login diagnostics or credentials.
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Codex readiness timed out")); },5000);
    child.on("error", error => { clearTimeout(timeout); reject(error); });
    child.on("close", code => { clearTimeout(timeout); resolve({code,output,notLoggedIn:/not logged in/i.test(diagnostic)}); });
  });
}
