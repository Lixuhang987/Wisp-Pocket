import type { AgentMessage, SystemAgentMessage } from "./types/AgentMessage.ts";

export function formatLocalTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid timestamp");
  const offset = -date.getTimezoneOffset();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offset >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

export function timeContextUpdate(messages: AgentMessage[], timestamp: string): SystemAgentMessage | undefined {
  const previous = messages.findLast(message => message.role === "system" && message.timeContext);
  const previousTime = previous?.role === "system" ? previous.timeContext : undefined;
  const now = new Date(timestamp);
  const elapsed = previousTime ? now.getTime() - Date.parse(previousTime.timestamp) : undefined;
  if (elapsed !== undefined && elapsed <= 3_600_000) return;
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid Turn start time");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    role: "system", timeContext: { timestamp: now.toISOString(), timezone },
    content: `<time_context>\n本轮开始时间：${formatLocalTimestamp(timestamp)}\n时区：${timezone}\n${elapsed === undefined ? "这是本 Thread 首次时间上下文。" : `距上次时间上下文已过去 ${Math.floor(elapsed / 1000)} 秒，以本条更新的时间为准。`}\n历史消息和工具证据中的时间对应各自发生时刻；本时间上下文不会在后续每轮自动刷新。\n</time_context>`,
  };
}
