import type {
  AvailableSkill,
  DynamicToolSpec,
  InitialPromptPayload,
} from "../protocol/threadProtocol.ts";

declare global {
  interface Window {
    handAgentThreadWindowConfig?: {
      threadWebSocketURL?: string;
      availableSkills?: AvailableSkill[];
      defaultDynamicTools?: DynamicToolSpec[];
    };
    handAgentReceiveInitialPrompt?: (payload: InitialPromptPayload) => void;
    handAgentPendingInitialPrompts?: InitialPromptPayload[];
  }
}

export function getThreadWebSocketURL(): string {
  return window.handAgentThreadWindowConfig?.threadWebSocketURL ?? "ws://127.0.0.1:4317/api/thread";
}

export function getAvailableSkills(): AvailableSkill[] {
  const skills = window.handAgentThreadWindowConfig?.availableSkills;
  if (!Array.isArray(skills)) {
    return [];
  }
  return skills
    .filter((skill): skill is AvailableSkill => (
      typeof skill === "object"
      && skill !== null
      && typeof skill.actionId === "string"
      && typeof skill.title === "string"
      && typeof skill.prompt === "string"
      && (skill.description === undefined || typeof skill.description === "string")
    ))
    .map((skill) => ({ ...skill }));
}

export function getDefaultDynamicTools(): DynamicToolSpec[] {
  const tools = window.handAgentThreadWindowConfig?.defaultDynamicTools;
  if (!Array.isArray(tools)) {
    return [];
  }
  return tools
    .filter(isDynamicToolSpec)
    .map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } }));
}

export function installInitialPromptReceiver(handler: (payload: InitialPromptPayload) => void): () => void {
  window.handAgentReceiveInitialPrompt = handler;
  const pending = window.handAgentPendingInitialPrompts ?? [];
  window.handAgentPendingInitialPrompts = [];
  for (const payload of pending) {
    handler(payload);
  }

  return () => {
    if (window.handAgentReceiveInitialPrompt === handler) {
      delete window.handAgentReceiveInitialPrompt;
    }
  };
}

function isDynamicToolSpec(value: unknown): value is DynamicToolSpec {
  return typeof value === "object"
    && value !== null
    && typeof (value as DynamicToolSpec).clientId === "string"
    && (
      (value as DynamicToolSpec).namespace === undefined
      || typeof (value as DynamicToolSpec).namespace === "string"
    )
    && typeof (value as DynamicToolSpec).name === "string"
    && typeof (value as DynamicToolSpec).description === "string"
    && typeof (value as DynamicToolSpec).inputSchema === "object"
    && (value as DynamicToolSpec).inputSchema !== null
    && !Array.isArray((value as DynamicToolSpec).inputSchema)
    && (
      (value as DynamicToolSpec).deferLoading === undefined
      || typeof (value as DynamicToolSpec).deferLoading === "boolean"
    );
}
