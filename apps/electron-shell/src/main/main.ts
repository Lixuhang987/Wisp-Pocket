import { BrowserWindow, app, dialog, ipcMain, screen, utilityProcess } from "electron";
import { dirname, join, resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { PetWindowCollection } from "./windows/petWindowCollection.js";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { ElectronShellRuntime, errorMessage } from "./electronShellRuntime.js";
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
import { PetPositionStore } from "./windows/petPositionStore.js";
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

const createPetWindow = (petId: string, index: number) => new ActivityWindowController({
  petId, initialOffset: (index % 6) * 110,
  activityWindowHTMLPath,
  preloadPath: activityPreloadPath,
  threadWebSocketURL: process.env.HANDAGENT_PET_THREAD_WEBSOCKET_URL,
  initialTheme,
  positionStore: new PetPositionStore(
    process.env.HANDAGENT_PET_POSITION_PATH ? `${process.env.HANDAGENT_PET_POSITION_PATH}.${petId}` : join(homedir(), ".spotAgent/pet-positions", `${petId}.json`),
    (error) => process.stderr.write(`[electron-shell] pet position: ${errorMessage(error)}\n`),
  ),
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

const visibilityPath = join(homedir(), ".spotAgent/pet-visibility.json");
const activityWindow = new PetWindowCollection({
  url: process.env.HANDAGENT_PET_THREAD_WEBSOCKET_URL ?? "ws://127.0.0.1:4317/api/thread",
  createController: createPetWindow,
  preferences: {
    load: () => { try { const value = JSON.parse(readFileSync(visibilityPath,"utf8")); return Object.fromEntries(Object.entries(value).filter(([,v])=>typeof v==="boolean")) as Record<string,boolean>; } catch { return {}; } },
    save: value => { mkdirSync(dirname(visibilityPath),{recursive:true});writeFileSync(`${visibilityPath}.tmp`,JSON.stringify(value));renameSync(`${visibilityPath}.tmp`,visibilityPath); },
  },
  onError: error => process.stderr.write(`[electron-shell] pet windows: ${errorMessage(error)}\n`),
});

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
