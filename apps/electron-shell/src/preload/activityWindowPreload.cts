import { contextBridge, ipcRenderer } from "electron";

type HostTheme = {
  preference: "light" | "dark" | "system";
  resolved: "light" | "dark";
};

declare global {
  interface Window {
    handAgentActivityWindowConfig?: { activityWebSocketURL?: string };
    handAgentTheme?: HostTheme;
    handAgentSubscribeThemeChange?: (handler: (theme: HostTheme) => void) => () => void;
    handAgentActivityWindow?: {
      focusThread(threadId: string | null): void;
    };
  }
}

const activityWebSocketURL = "ws://127.0.0.1:4317/api/activity";
const fallbackTheme: HostTheme = { preference: "system", resolved: "light" };
let latestTheme = readInitialTheme();
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
  func: (url: string, theme: HostTheme) => {
    window.handAgentActivityWindowConfig = { activityWebSocketURL: url };
    window.handAgentTheme = theme;
  },
  args: [activityWebSocketURL, latestTheme],
});

contextBridge.exposeInMainWorld("handAgentSubscribeThemeChange", (handler: (theme: HostTheme) => void) => {
  handler(latestTheme);
  themeHandlers.add(handler);
  return () => {
    themeHandlers.delete(handler);
  };
});

contextBridge.exposeInMainWorld("handAgentActivityWindow", {
  focusThread(threadId: string | null): void {
    ipcRenderer.send("activity-window:focus-thread", threadId);
  },
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

function isHostTheme(value: unknown): value is HostTheme {
  return typeof value === "object"
    && value !== null
    && ["light", "dark", "system"].includes((value as HostTheme).preference)
    && ["light", "dark"].includes((value as HostTheme).resolved);
}
