import { z } from "zod";
import type { RegisteredTool } from "../tools/ToolRegistry.ts";

export const USER_QUESTION_TOOL_NAME = "user.ask";
export const userQuestionSchema = z.object({
  message: z.string().trim().min(1).max(12_000),
  suggestedReplies: z.array(z.string().trim().min(1).max(500)).max(4),
}).strict();

export const userQuestionTool: RegisteredTool = {
  name: USER_QUESTION_TOOL_NAME,
  description: "向用户提出有依据的建议或追问，然后等待下一条普通用户消息。选项必须是可直接发送的完整用户回复，不会自动执行。信息不足时先问，不虚构习惯、目标位置或偏好。",
  inputSchema: z.toJSONSchema(userQuestionSchema, { target: "draft-7" }),
};
