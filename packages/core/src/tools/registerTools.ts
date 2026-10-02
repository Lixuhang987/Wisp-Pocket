import type { ToolSettings } from "../config/ToolSettings.ts";
import { ToolRegistry } from "./ToolRegistry.ts";
import {
  registerBuiltinTools,
  type RegisterBuiltinToolsResult,
} from "./registerBuiltins.ts";

export type RegisterToolsOptions = {
  registry?: ToolRegistry;
  settings?: ToolSettings;
};

export async function registerTools(
  options: RegisterToolsOptions,
): Promise<RegisterBuiltinToolsResult> {
  return registerBuiltinTools(options);
}
