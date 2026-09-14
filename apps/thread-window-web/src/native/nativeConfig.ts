import type {
  AvailableSkill,
  InitialPromptPayload,
} from "../protocol/threadProtocol.ts";

declare global {
  interface Window {
    handAgentThreadWindowConfig?: {
      threadWebSocketURL?: string;
      availableSkills?: AvailableSkill[];
    };
    handAgentReceiveInitialPrompt?: (payload: InitialPromptPayload) => void;
    handAgentPendingInitialPrompts?: InitialPromptPayload[];
    handAgentReceiveThreadOpen?: (threadId: string) => void;
    handAgentPendingThreadOpens?: string[];
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

export function installThreadOpenReceiver(handler: (threadId: string) => void): () => void {
  window.handAgentReceiveThreadOpen = handler;
  const pending = window.handAgentPendingThreadOpens ?? [];
  window.handAgentPendingThreadOpens = [];
  for (const threadId of pending) {
    handler(threadId);
  }

  return () => {
    if (window.handAgentReceiveThreadOpen === handler) {
      delete window.handAgentReceiveThreadOpen;
    }
  };
}
