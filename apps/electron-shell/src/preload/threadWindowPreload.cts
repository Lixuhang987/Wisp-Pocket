import { contextBridge, ipcRenderer } from "electron";

type HostTheme = {
  preference: "light" | "dark" | "system";
  resolved: "light" | "dark";
};

type AvailableSkill = {
  actionId: string;
  title: string;
  prompt: string;
  description?: string;
};

declare global {
  interface Window {
    handAgentThreadWindowConfig?: {
      threadWebSocketURL?: string;
      availableSkills?: AvailableSkill[];
    };
    handAgentTheme?: HostTheme;
    handAgentSubscribeThemeChange?: (handler: (theme: HostTheme) => void) => () => void;
    handAgentPendingInitialPrompts?: unknown[];
    handAgentReceiveInitialPrompt?: (payload: unknown) => void;
    handAgentPendingThreadOpens?: string[];
    handAgentReceiveThreadOpen?: (threadId: string) => void;
  }
}

const threadWebSocketURL = "ws://127.0.0.1:4317/api/thread?acceptServerRequests=1";
const fallbackTheme: HostTheme = { preference: "system", resolved: "light" };
let latestTheme = readInitialTheme();
const availableSkills = readAvailableSkills();
const themeHandlers = new Set<(theme: HostTheme) => void>();

ipcRenderer.on("handagent:theme-changed", (_event: unknown, theme: HostTheme) => {
  if (!isHostTheme(theme)) {
    return;
  }
  latestTheme = theme;
  for (const handler of themeHandlers) {
    handler(theme);
  }
});

contextBridge.executeInMainWorld({
  func: (
    url: string,
    theme: HostTheme,
    skills: AvailableSkill[],
  ) => {
    window.handAgentThreadWindowConfig = {
      threadWebSocketURL: url,
      availableSkills: skills,
    };
    window.handAgentTheme = theme;
    window.handAgentPendingInitialPrompts = Array.isArray(window.handAgentPendingInitialPrompts)
      ? window.handAgentPendingInitialPrompts
      : [];
    if (typeof window.handAgentReceiveInitialPrompt !== "function") {
      window.handAgentReceiveInitialPrompt = (payload: unknown) => {
        window.handAgentPendingInitialPrompts?.push(payload);
      };
    }
    window.handAgentPendingThreadOpens = Array.isArray(window.handAgentPendingThreadOpens)
      ? window.handAgentPendingThreadOpens
      : [];
    if (typeof window.handAgentReceiveThreadOpen !== "function") {
      window.handAgentReceiveThreadOpen = (threadId: string) => {
        window.handAgentPendingThreadOpens?.push(threadId);
      };
    }
  },
  args: [threadWebSocketURL, latestTheme, availableSkills],
});

contextBridge.exposeInMainWorld("handAgentSubscribeThemeChange", (handler: (theme: HostTheme) => void) => {
  handler(latestTheme);
  themeHandlers.add(handler);
  return () => {
    themeHandlers.delete(handler);
  };
});

contextBridge.exposeInMainWorld("handAgentElectron", {
  phase: "phase-0",
});

function readInitialTheme(): HostTheme {
  const raw = process.argv.find((arg) => arg.startsWith("--handagent-theme="));
  if (!raw) {
    return fallbackTheme;
  }
  try {
    const decoded = decodeURIComponent(raw.slice("--handagent-theme=".length));
    const parsed = JSON.parse(decoded) as unknown;
    return isHostTheme(parsed) ? parsed : fallbackTheme;
  } catch {
    return fallbackTheme;
  }
}

function readAvailableSkills(): AvailableSkill[] {
  const raw = process.argv.find((arg) => arg.startsWith("--handagent-available-skills="));
  if (!raw) {
    return [];
  }
  try {
    const decoded = decodeURIComponent(raw.slice("--handagent-available-skills=".length));
    const parsed = JSON.parse(decoded) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isAvailableSkill) : [];
  } catch {
    return [];
  }
}

function isHostTheme(value: unknown): value is HostTheme {
  return typeof value === "object"
    && value !== null
    && ["light", "dark", "system"].includes((value as HostTheme).preference)
    && ["light", "dark"].includes((value as HostTheme).resolved);
}

function isAvailableSkill(value: unknown): value is AvailableSkill {
  return typeof value === "object"
    && value !== null
    && typeof (value as AvailableSkill).actionId === "string"
    && typeof (value as AvailableSkill).title === "string"
    && typeof (value as AvailableSkill).prompt === "string"
    && ((value as AvailableSkill).description === undefined || typeof (value as AvailableSkill).description === "string");
}
