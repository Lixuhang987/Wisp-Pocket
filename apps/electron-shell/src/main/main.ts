import { BrowserWindow, app, dialog, ipcMain, screen, shell, utilityProcess, nativeImage, Notification } from "electron";
import { basename, dirname, extname, join, resolve } from "node:path";
import { mkdirSync, readFileSync } from "node:fs";
import { PetWindowCollection } from "./windows/petWindowCollection.js";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { ElectronShellRuntime, errorMessage } from "./electronShellRuntime.js";
import { registerSettingsManagementIpc } from "./settingsManagementIpc.js";
import { registerPetWindowIpc } from "./petWindowIpc.js";
import {
  parseCommand,
  type ElectronToSwiftEvent,
  type SwiftToElectronCommand,
} from "./protocol/electronShellProtocol.js";
import { createAgentServerSupervisor } from "./serverSupervisor/agentServerSupervisorFactory.js";
import { JsonLineBridge } from "./swiftBridge/jsonLineBridge.js";
import { CommandSocketServer } from "./swiftBridge/commandSocketServer.js";
import { ActivityWindowController } from "./windows/activityWindowController.js";
import { FrontendPetStore } from "./pets/frontendPetStore.js";
import { ThreadWindowPrewarmer } from "./windows/threadWindowPrewarmer.js";
import { configureMacOSDockApp } from "./macosDockApp.js";
import { readAvailableSkillsFromActionsDirectory } from "./availableSkills.js";
import { readInitialHostTheme } from "./initialHostTheme.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.HANDAGENT_REPO_ROOT ?? resolve(currentDir, "../../../..");
const actionsDirectory = process.env.HANDAGENT_ACTIONS_DIR ?? join(homedir(), ".spotAgent/actions");
const nodePath = process.env.HANDAGENT_NODE_PATH ?? "node";
const threadWindowURL =
  process.env.HANDAGENT_THREAD_WINDOW_WEB_URL ?? "http://127.0.0.1:4317/thread-window/index.html";
const threadPreloadPath = join(currentDir, "../preload/threadWindowPreload.cjs");
const activityWindowHTMLPath = join(currentDir, "../activity-window/index.html");
const activityPreloadPath = join(currentDir, "../preload/activityWindowPreload.cjs");
const commandSocketPath = process.env.HANDAGENT_ELECTRON_COMMAND_SOCKET;
const initialTheme = readInitialHostTheme(process.env.HANDAGENT_INITIAL_THEME);

const bridge = new JsonLineBridge({ input: process.stdin, output: process.stdout });
let commandSocketServer: CommandSocketServer | null = null;
const supervisor = createAgentServerSupervisor({
  repoRoot,
  nodePath,
  env: process.env.HANDAGENT_LLM_MODE
    ? { HANDAGENT_LLM_MODE: process.env.HANDAGENT_LLM_MODE }
    : {},
  forkUtilityProcess: (modulePath, args, options) =>
    utilityProcess.fork(modulePath, args, options),
  logSink: (line) => process.stderr.write(line),
});

const prewarmer = new ThreadWindowPrewarmer({
  threadWindowURL,
  preloadPath: threadPreloadPath,
  availableSkills: readAvailableSkillsFromActionsDirectory(actionsDirectory),
  initialTheme,
  onClosed: (event) => {
    if (hasStoppedSupervisor) {
      return;
    }
    runtime.handleThreadWindowClosed(event);
  },
  createWindow: (options) => {
    const window = new BrowserWindow(options);
    window.webContents.on("render-process-gone", (_event, details) => {
      if (details.reason === "clean-exit") {
        return;
      }
      send({
        channel: "electron_shell",
        type: "renderer.crashed",
        window: "thread",
        reason: details.reason,
      });
    });
    return window;
  },
});

const settingsURL = new URL(threadWindowURL);
settingsURL.searchParams.set("surface", "settings");
const settingsWindow = new ThreadWindowPrewarmer({
  threadWindowURL: settingsURL.toString(), preloadPath: threadPreloadPath,
  availableSkills: [], initialTheme,
  createWindow: options => {
    const window = new BrowserWindow({ ...options, title: "设置" });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", event => event.preventDefault());
    return window;
  },
});

const petStore = new FrontendPetStore(process.env.HANDAGENT_PET_STORE_PATH ?? join(homedir(), ".spotAgent/pets.json"), image => {
  const decoded=nativeImage.createFromDataURL(image.url);
  const size=decoded.getSize();
  if(decoded.isEmpty() || size.width!==image.width || size.height!==image.height)throw new Error("图片无法解码或尺寸不一致");
});

const createPetWindow = (petId: string, index: number) => new ActivityWindowController({
  petId, initialOffset: (index % 6) * 110,
  activityWindowHTMLPath,
  preloadPath: activityPreloadPath,
  openExternal: async (url) => {
    try { await shell.openExternal(url); }
    catch (error) { process.stderr.write(`[electron-shell] open link: ${errorMessage(error)}\n`); }
  },
  threadWebSocketURL: process.env.HANDAGENT_PET_THREAD_WEBSOCKET_URL,
  initialTheme,
  positionStore: {load: () => petStore.get(petId).position ?? null, save: position => petStore.setPosition(petId,position)},
  createWindow: (options) => new BrowserWindow(options),
  screenProvider: {
    getPrimaryWorkArea: () => screen.getPrimaryDisplay().workArea,
    getDisplayForPoint: point => { const display = screen.getDisplayNearestPoint(point); return {id:String(display.id),workArea:display.workArea}; },
    getWorkAreaForDisplay: id => screen.getAllDisplays().find(display => String(display.id) === id)?.workArea,
    getWorkAreaForPoint: (point) => screen.getDisplayNearestPoint(point).workArea,
    getCursorScreenPoint: () => screen.getCursorScreenPoint(),
    subscribeWorkAreaChanges: (listener) => {
      screen.on("display-added", listener);
      screen.on("display-removed", listener);
      screen.on("display-metrics-changed", listener);
      return () => {
        screen.off("display-added", listener);
        screen.off("display-removed", listener);
        screen.off("display-metrics-changed", listener);
      };
    },
  },
  onRendererCrashed: (reason) => {
    void activityWindow.recover(petId).catch(error => process.stderr.write(`[electron-shell] pet recovery: ${errorMessage(error)}\n`));
    send({
      channel: "electron_shell",
      type: "renderer.crashed",
      window: "activity",
      reason,
    });
  },
});

const defaultWorkspaceRoot = join(homedir(), ".spotAgent/workspaces/default");
mkdirSync(defaultWorkspaceRoot,{recursive:true});
const activityWindow = new PetWindowCollection({
  url: process.env.HANDAGENT_PET_THREAD_WEBSOCKET_URL ?? "ws://127.0.0.1:4317/api/thread",
  createController: createPetWindow, store: petStore, defaultWorkspaceRoot,
  onNotice: message => { if(Notification.isSupported())new Notification({title:"HandAgent",body:message}).show(); },
  onError: error => process.stderr.write(`[electron-shell] pet windows: ${errorMessage(error)}\n`),
});
petStore.subscribe(pets => { for(const window of BrowserWindow.getAllWindows())if(settingsWindow.ownsSender(window.webContents) || activityWindow.controllerForSender(window.webContents)){try {window.webContents.send("settings:pets-changed",pets);}catch(error){process.stderr.write(`[electron-shell] pet broadcast: ${errorMessage(error)}\n`);}} });

let hasStartedSupervisor = false;
let hasStoppedSupervisor = false;

function send(event: ElectronToSwiftEvent): void {
  bridge.send(event);
}

function now(): string {
  return new Date().toISOString();
}

function commandIdFromRawLine(line: string): string | null {
  try {
    const value = JSON.parse(line) as unknown;
    if (typeof value === "object" && value !== null && "commandId" in value) {
      const commandId = (value as { commandId?: unknown }).commandId;
      return typeof commandId === "string" ? commandId : null;
    }
  } catch {
    return null;
  }
  return null;
}

function startSupervisor(): void {
  if (hasStartedSupervisor || hasStoppedSupervisor) {
    return;
  }

  hasStartedSupervisor = true;
  supervisor.start();
}

function stopSupervisor(): void {
  if (hasStoppedSupervisor) {
    return;
  }

  hasStoppedSupervisor = true;
  if (hasStartedSupervisor) {
    supervisor.stop();
  }
}

const runtime = new ElectronShellRuntime({
  prewarmer,
  settingsWindow,
  activityWindow,
  send,
  now,
  stopSupervisor,
  quit: () => app.quit(),
});

registerPetWindowIpc(ipcMain, activityWindow);
ipcMain.handle("pet-window:show-pet", async (event, petId: unknown) => {
  if (!activityWindow.controllerForSender(event.sender) || typeof petId !== "string") throw new Error("Invalid pet window sender");
  await activityWindow.showPet(petId);
});
ipcMain.handle("pet-window:choose-files", async event => {
  if (!activityWindow.controllerForSender(event.sender)) throw new Error("Invalid pet window sender");
  const result = await dialog.showOpenDialog({properties:["openFile","multiSelections"]});return result.canceled ? [] : result.filePaths;
});

registerSettingsManagementIpc(ipcMain, {
  store: petStore, allocation: activityWindow,
  importPetImage: image => {
    if(!image || !["image/png","image/jpeg","image/webp"].includes(image.mimeType) || typeof image.bytesBase64!=="string")throw new Error("无效图片");
    const bytes=Buffer.from(image.bytesBase64,"base64");
    if(!bytes.length || bytes.length>20*1024*1024)throw new Error("图片必须介于 1 byte 与 20 MiB");
    const decoded=nativeImage.createFromBuffer(bytes);
    if(decoded.isEmpty())throw new Error("无法解码图片");
    const {width,height}=decoded.getSize();
    return {type:"imported",url:decoded.toDataURL(),mimeType:"image/png",width,height};
  },
  isManagementSender: sender => settingsWindow.ownsSender(sender) || !!activityWindow.controllerForSender(sender),
  chooseDirectory: async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    return result.canceled ? null : result.filePaths[0] ?? null;
  },
  chooseImage: async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }] });
    const path = result.canceled ? undefined : result.filePaths[0];
    if (!path) return null;
    const mimeTypes: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
    const mimeType = mimeTypes[extname(path).toLowerCase()];
    if (!mimeType) throw new Error("不支持的图片格式");
    const bytes = readFileSync(path);
    if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error("图片必须介于 1 byte 与 20 MiB");
    return { name: basename(path), mimeType, bytesBase64: bytes.toString("base64") };
  },
  showPet: petId => activityWindow.showPet(petId),
  hidePet: petId => activityWindow.hidePet(petId),
  getPetVisibility: () => activityWindow.getVisibility(),
});

async function handleCommandLine(line: string): Promise<void> {
  let command: SwiftToElectronCommand;
  try {
    command = parseCommand(line);
  } catch (error) {
    const commandId = commandIdFromRawLine(line);
    if (commandId) {
      send({
        channel: "electron_shell",
        type: "command.ack",
        commandId,
        ok: false,
        error: errorMessage(error),
      });
    }
    return;
  }

  await runtime.handleCommand(command);
}

supervisor.onHealth((event) => {
  runtime.handleAgentServerHealth(event);
});

bridge.onLine((line) => {
  void handleCommandLine(line);
});

process.stdin.on("end", () => {
  if (!commandSocketPath) {
    stopSupervisor();
    app.quit();
  }
});

app.on("before-quit", () => {
  commandSocketServer?.close();
  activityWindow.stop();
  stopSupervisor();
});

void bootElectronShell();

async function bootElectronShell(): Promise<void> {
  try {
    await app.whenReady();
    configureMacOSDockApp(app);
    if (commandSocketPath) {
      commandSocketServer = new CommandSocketServer(commandSocketPath);
      commandSocketServer.onLine((line) => {
        void handleCommandLine(line);
      });
    }
    await commandSocketServer?.start();
    send({ channel: "electron_shell", type: "electron.ready", timestamp: now() });
    process.stderr.write(`[electron-shell] agent-server supervisor: ${JSON.stringify(supervisor.describe())}\n`);
    startSupervisor();
  } catch (error) {
    send({
      channel: "electron_shell",
      type: "thread_window.prepare_failed",
      message: errorMessage(error),
    });
    app.exit(1);
  }
}
