import { filterToolNames, type ToolSettings } from "../config/ToolSettings.ts";
import type { AgentTool } from "./types/AgentTool.ts";
import { ToolRegistry } from "./ToolRegistry.ts";
import { FileWriteTool } from "./builtins/FileWriteTool.ts";

export type RegisterBuiltinToolsOptions = {
  registry?: ToolRegistry;
  settings?: ToolSettings;
};

export type RegisterBuiltinToolsResult = {
  registry: ToolRegistry;
  registered: string[];
  disabled: { name: string; reason: string }[];
};

export type BuiltinToolCandidatesResult = {
  candidates: AgentTool[];
  disabled: { name: string; reason: string }[];
};

export function buildBuiltinToolCandidates(): BuiltinToolCandidatesResult {
  return { candidates: [FileWriteTool.create({})], disabled: [] };
}

export function registerBuiltinTools(
  options: RegisterBuiltinToolsOptions,
): RegisterBuiltinToolsResult {
  const registry = options.registry ?? new ToolRegistry();
  const settings = options.settings ?? { allowlist: null, denylist: [] };
  const { candidates, disabled } = buildBuiltinToolCandidates();

  const candidateNames = candidates.map((t) => t.name);
  const filtered = filterToolNames(candidateNames, settings);
  disabled.push(...filtered.disabled);

  const enabledSet = new Set(filtered.enabled);
  const registered: string[] = [];
  const enabledTools: AgentTool[] = [];
  for (const tool of candidates) {
    if (!enabledSet.has(tool.name)) continue;
    enabledTools.push(tool);
    registered.push(tool.name);
  }
  registry.replaceAll(enabledTools);

  return { registry, registered, disabled };
}
