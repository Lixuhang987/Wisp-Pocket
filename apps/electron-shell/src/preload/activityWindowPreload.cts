import { contextBridge, ipcRenderer } from "electron";

type HostTheme = {
  preference: "light" | "dark" | "system";
  resolved: "light" | "dark";
};

declare global {
  interface Window {
    handAgentActivityWindowConfig?: { threadWebSocketURL?: string };
    handAgentTheme?: HostTheme;
    handAgentSubscribeThemeChange?: (handler: (theme: HostTheme) => void) => () => void;
    handAgentPet?: {
      setLayout(mode: "pet" | "compact" | "expanded"): void;
      setInteractiveRegions(rectangles: Array<{ x: number; y: number; width: number; height: number }>): void;
      beginMove(): void;
      move(): void;
      endMove(): void;
    };
  }
}

const threadWebSocketURL = readThreadWebSocketURL();
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
    window.handAgentActivityWindowConfig = { threadWebSocketURL: url };
    window.handAgentTheme = theme;
  },
  args: [threadWebSocketURL, latestTheme],
});

contextBridge.exposeInMainWorld("handAgentSubscribeThemeChange", (handler: (theme: HostTheme) => void) => {
  handler(latestTheme);
  themeHandlers.add(handler);
  return () => {
    themeHandlers.delete(handler);
  };
});

contextBridge.exposeInMainWorld("handAgentPet", {
  setLayout(mode: "pet" | "compact" | "expanded"): void {
    ipcRenderer.send("pet-window:set-layout", mode);
  },
  setInteractiveRegions(rectangles: Array<{ x: number; y: number; width: number; height: number }>): void {
    ipcRenderer.send("pet-window:set-interactive-regions", rectangles);
  },
  beginMove(): void { ipcRenderer.send("pet-window:begin-move"); },
  move(): void { ipcRenderer.send("pet-window:move"); },
  endMove(): void { ipcRenderer.send("pet-window:end-move"); },
});

function readThreadWebSocketURL(): string {
  const fallback = "ws://127.0.0.1:4317/api/thread?acceptServerRequests=1";
  const prefix = "--handagent-pet-thread-websocket-url=";
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;
  try {
    const url = new URL(decodeURIComponent(raw.slice(prefix.length)));
    if (url.protocol !== "ws:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/api/thread") {
      return fallback;
    }
    url.searchParams.set("acceptServerRequests", "1");
    return url.toString();
  } catch {
    return fallback;
  }
}

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
