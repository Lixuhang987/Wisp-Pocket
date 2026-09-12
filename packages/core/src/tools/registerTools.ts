import type { WorkspaceRegistry } from "../workspace/types/Workspace.ts";
import type { ToolSettings } from "../config/ToolSettings.ts";
import { ToolRegistry } from "./ToolRegistry.ts";
import {
  registerBuiltinTools,
  type RegisterBuiltinToolsResult,
} from "./registerBuiltins.ts";
import type { WorkspaceAskResolver } from "./builtins/WorkspaceAskUserTool.ts";

export type RegisterToolsOptions = {
  registry?: ToolRegistry;
  workspaceRegistry?: WorkspaceRegistry;
  workspaceAskResolver?: WorkspaceAskResolver;
  settings?: ToolSettings;
};

export async function registerTools(
  options: RegisterToolsOptions,
): Promise<RegisterBuiltinToolsResult> {
  return registerBuiltinTools(options);
}
