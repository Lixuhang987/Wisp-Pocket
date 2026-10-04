import { contextBridge, ipcRenderer, webUtils } from "electron";

type HostTheme = {
  preference: "light" | "dark" | "system";
  resolved: "light" | "dark";
};

declare global {
  interface Window {
    handAgentActivityWindowConfig?: { threadWebSocketURL?: string; petId?: string };
    handAgentTheme?: HostTheme;
    handAgentSubscribeThemeChange?: (handler: (theme: HostTheme) => void) => () => void;
    handAgentPet?: {
      setLayout(mode: "pet" | "compact" | "expanded", contentHeight?: number): void;
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
const revealHandlers = new Set<() => void>();
let pendingReveal = false;
ipcRenderer.on("pet-window:reveal", () => { pendingReveal = revealHandlers.size === 0; for (const handler of revealHandlers) handler(); });

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
  func: (url: string, theme: HostTheme, petId: string) => {
    window.handAgentActivityWindowConfig = { threadWebSocketURL: url, petId };
    window.handAgentTheme = theme;
  },
  args: [threadWebSocketURL, latestTheme, decodeURIComponent(process.argv.find(arg => arg.startsWith("--handagent-pet-id="))?.slice("--handagent-pet-id=".length) ?? "")],
});

contextBridge.exposeInMainWorld("handAgentSubscribeThemeChange", (handler: (theme: HostTheme) => void) => {
  handler(latestTheme);
  themeHandlers.add(handler);
  return () => {
    themeHandlers.delete(handler);
  };
});

contextBridge.exposeInMainWorld("handAgentPet", {
  getPathForFile(file: File): string { return webUtils.getPathForFile(file); },
  chooseFiles(): Promise<string[]> { return ipcRenderer.invoke("pet-window:choose-files"); },
  showPet(petId: string): Promise<void> { return ipcRenderer.invoke("pet-window:show-pet", petId); },
  hidePet(): void { ipcRenderer.send("pet-window:hide"); },
  setReceiving(value: boolean): void { ipcRenderer.send("pet-window:receiving",value); },
  onReveal(handler: () => void): () => void { revealHandlers.add(handler); if (pendingReveal) { pendingReveal = false; handler(); } return () => { revealHandlers.delete(handler); }; },
  setLayout(mode: "pet" | "compact" | "expanded", contentHeight?: number): void {
    if (contentHeight === undefined) ipcRenderer.send("pet-window:set-layout", mode);
    else ipcRenderer.send("pet-window:set-layout", mode, contentHeight);
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

// Management intent only; main validates the settings or registered pet sender.
contextBridge.exposeInMainWorld("handAgentSettings", {
  chooseDirectory: () => ipcRenderer.invoke("settings:choose-directory"),
  chooseImage: () => ipcRenderer.invoke("settings:choose-image"),
  showPet: (petId: string) => ipcRenderer.invoke("settings:show-pet", petId),
  hidePet: (petId: string) => ipcRenderer.invoke("settings:hide-pet", petId),
  getPetVisibility: () => ipcRenderer.invoke("settings:pet-visibility"),
  listPets: () => ipcRenderer.invoke("settings:list-pets"),
  savePet: (input: unknown, commandId?: string) => ipcRenderer.invoke("settings:save-pet", input, commandId),
  assignPet: (input: unknown) => ipcRenderer.invoke("settings:assign-pet", input),
  openWorkspaceThread: (workspaceId: string, threadId: string | null) => ipcRenderer.invoke("settings:open-workspace-thread", workspaceId, threadId),
  summonPet: (workspaceId: string) => ipcRenderer.invoke("settings:summon-pet", workspaceId),
  importPetImage: (image: unknown) => ipcRenderer.invoke("settings:import-pet-image", image),
  setPetSize: (petId: string, size: number) => ipcRenderer.invoke("settings:set-pet-size", petId, size),
  onPetsChanged: (handler: (pets: unknown[]) => void) => {
    const listener = (_event: unknown, pets: unknown[]) => handler(pets);
    ipcRenderer.on("settings:pets-changed", listener);
    return () => { ipcRenderer.removeListener("settings:pets-changed", listener); };
  },
});
