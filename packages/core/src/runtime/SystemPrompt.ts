import type { AgentMessage, SystemAgentMessage } from "./types/AgentMessage.ts";
import type { RegisteredTool } from "../tools/ToolRegistry.ts";

export type SystemPromptContext = {
  tools: RegisteredTool[];
};

export type SystemPromptSection = {
  name: string;
  resolve: (context: SystemPromptContext) => string | null | Promise<string | null>;
};

export function systemPromptSection(
  name: string,
  resolve: SystemPromptSection["resolve"],
): SystemPromptSection {
  return { name, resolve };
}

export async function resolveSystemPromptSections(
  sections: SystemPromptSection[],
  context: SystemPromptContext,
): Promise<string[]> {
  const resolved = await Promise.all(sections.map((section) => section.resolve(context)));
  return resolved.filter(isNonEmptyPromptSection);
}

export async function systemPromptUpdates(input: {
  sections: SystemPromptSection[];
  context: SystemPromptContext;
  messages: AgentMessage[];
}): Promise<SystemAgentMessage[]> {
  const current = await Promise.all(input.sections.map(async (section): Promise<SystemAgentMessage> => {
    const content = await section.resolve(input.context);
    return { role: "system", promptSection: section.name, content: isNonEmptyPromptSection(content) ? content! : "" };
  }));
  return current.filter((message) => {
    const previous = input.messages.findLast((item) => item.role === "system" && item.promptSection === message.promptSection);
    return previous ? previous.content !== message.content : !!message.content;
  });
}

/** Keep every rule version in history; only the current version applies to the model. */
export function modelMessagesWithSystemPrompts(messages: AgentMessage[]): AgentMessage[] {
  const sections = new Map<string, SystemAgentMessage>();
  for (const message of messages) {
    if (message.role === "system" && message.promptSection) sections.set(message.promptSection, message);
  }
  return [
    ...[...sections.values()].filter(message => message.content).map(({ content }): AgentMessage => ({ role: "system", content })),
    ...messages.filter(message => message.role !== "system" || !message.promptSection)
      .map((message): AgentMessage => message.role === "system" ? { role: "system", content: message.content } : message),
  ];
}

export function buildDefaultSystemPromptSections(): SystemPromptSection[] {
  return [buildToolUsePolicySection()];
}

export function buildToolUsePolicySection(): SystemPromptSection {
  return systemPromptSection("tool-use-policy", ({ tools }) => {
    if (!tools.length) return null;
    return TOOL_USE_POLICY_PROMPT;
  });
}

export const TOOL_USE_POLICY_PROMPT =
  "主 Agent 负责问答、按需读取资料和委托。简单问题直接回答；需要自主规划、多步执行或反复验证的复杂任务，以及所有创建或修改文件任务，必须调用 codex.execute。" +
  "委托 prompt 应交付本次任务、必要背景、约束、验收要求和文件路径；不要假定 Codex 已收到 Wisp 对话历史。" +
  "自行选择省略 sessionId 新建，或使用工具描述/结果中属于当前 Thread 的明确 sessionId 接续，并提供新增要求。" +
  "信息不足时使用 user.ask。需要外部事实时发出结构化读取调用，勿只描述计划。工具返回后据实际结果验证、解释、追问或决定重试。" +
  "Codex 使用用户自己的配置和权限，工作目录不是沙箱；Wisp 不能接管其内部审批，也尚未将宿主 MCP/macOS/Automation 迁给 Codex。" +
  "Wisp Turn 中断不保证 Codex 已停止，已有修改保留；不要将中断或关闭界面报告为进程终止。";

function isNonEmptyPromptSection(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
