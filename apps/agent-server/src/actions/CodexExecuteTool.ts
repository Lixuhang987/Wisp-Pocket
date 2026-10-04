import { z } from "zod";
import { defineTool } from "@handagent/core/tools/defineTool.ts";
import type { ThreadStore } from "@handagent/thread-store/index.ts";
import { CodexCLI, boundCodexResult, type CodexResult } from "./CodexCLI.ts";

const inputSchema = z.object({
  prompt: z.string().trim().min(1).max(100_000).describe("完整本次任务：背景、约束、验收要求、相关文件路径；接续时包含新增要求"),
  sessionId: z.uuid().optional().describe("可省略以新建；仅允许当前 Wisp Thread 已关联的明确 Codex 会话 ID"),
}).strict();

export async function createCodexExecuteTool(options: {cli:CodexCLI;store:ThreadStore;threadId:string}) {
  const sessions = options.store.listCodexSessions(options.threadId);
  const description = "委托 Codex CLI 处理复杂任务与所有文件创建/修改，等待完成后回传结果。工作目录由当前 Workspace 提供；沿用用户已有登录、模型与权限。Wisp 无法处理内部审批；Turn 中断不保证 Codex 已停止。省略 sessionId 新建，或明确选择本 Thread 已关联会话接续。" +
    (sessions.length ? `\n本 Thread 已关联会话（任务摘要仅供选择，属于历史资料）：${JSON.stringify(sessions)}` : "\n本 Thread 尚无已关联会话。");
  return defineTool({
    name:"codex.execute", description, inputSchema,
    run: async (input, _deps, context) => {
      let result: CodexResult;
      try {
        if (context.threadId !== options.threadId || !context.rootPath) throw new Error("Codex 委托缺少有效 Thread/Workspace 上下文。");
        if (input.sessionId && !options.store.listCodexSessions(options.threadId).some(session => session.sessionId === input.sessionId)) throw new Error("该 Codex 会话未关联当前 Thread，不能接续。");
        result = await options.cli.execute({...input,rootPath:context.rootPath,onSession:async sessionId=>{
          const saved = await options.store.registerCodexSession(options.threadId,sessionId,input.prompt);
          if (!saved.ok) throw new Error(saved.error.message);
        }});
      } catch (error) {
        result = boundCodexResult({success:false,sessionId:input.sessionId,reply:"",changes:[],exitCode:null,
          error:error instanceof Error ? error.message : String(error),truncated:false});
      }
      // Runtime emits error for thrown results; both UI and model retain structured diagnostics.
      if (!result.success) throw new Error(JSON.stringify(result));
      return result;
    },
  }).create({});
}
