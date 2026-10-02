import { z } from "zod";
import { FileReadTool } from "@handagent/core/tools/builtins/FileReadTool.ts";
import { defineTool } from "@handagent/core/tools/defineTool.ts";
import type { AgentTool } from "@handagent/core/tools/types/AgentTool.ts";
import { LocalFileReader } from "./LocalFileReader.ts";
import { ContextHistoryReader } from "./ContextHistoryReader.ts";

export function createDefaultReadTools(options: { contextHistoryRoot: string }): AgentTool[] {
  const history = new ContextHistoryReader(options.contextHistoryRoot);
  const limit = z.number().int().min(1).max(200).optional();
  const date = z.union([z.number().finite(), z.string().datetime({ offset: true })]).optional();
  const id = z.string().refine(value => value.trim().length > 0);
  return [
    FileReadTool.create(new LocalFileReader()),
    defineTool({ name: "context_history.activity_index", description: "读取已保存的本机活动索引，按时间倒序；不触发实时采集，不报告采集运行状态。", requiresPermission: false, inputSchema: z.object({ limit }).strict(), run: ({ limit }, reader: ContextHistoryReader) => reader.activityIndex(limit ?? 20) }).create(history),
    defineTool({ name: "context_history.sample_details", description: "按给定样本ID顺序读取已保存的活动与辅助功能证据。", requiresPermission: false, inputSchema: z.object({ ids: z.array(id).min(1).max(200) }).strict(), run: ({ ids }, reader: ContextHistoryReader) => reader.sampleDetails(ids) }).create(history),
    defineTool({ name: "context_history.thumbnails", description: "读取已保存的时间范围内截图缩略图，按时间倒序，支持ISO8601或epoch秒。", requiresPermission: false, inputSchema: z.object({ limit, start: date, end: date }).strict(), run: ({ limit, start, end }, reader: ContextHistoryReader) => reader.thumbnails(limit ?? 20, start, end) }).create(history),
    defineTool({ name: "context_history.screenshot_original", description: "按截图ID读取已保存的完整原图；返回真实图片与样本关联。", requiresPermission: false, inputSchema: z.object({ id }).strict(), run: ({ id }, reader: ContextHistoryReader) => reader.screenshotOriginal(id) }).create(history),
  ];
}
