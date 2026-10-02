import type { PetWindowCollection } from "./windows/petWindowCollection.js";
import type { Rectangle } from "electron";
import type { ActivityWindowController } from "./windows/activityWindowController.js";

type IpcEvent = { sender: unknown };
type IpcListener = (event: IpcEvent, ...args: unknown[]) => void;
type IpcMain = {
  on(channel: string, listener: IpcListener): unknown;
  removeListener(channel: string, listener: IpcListener): unknown;
};

export function registerPetWindowIpc(ipcMain: IpcMain, source: ActivityWindowController | PetWindowCollection): () => void {
  let controller: Pick<ActivityWindowController, "setLayout" | "setInteractiveRegions" | "beginMove" | "move" | "endMove">;
  let sender: unknown;
  const listeners: Array<[string, IpcListener]> = [];
  const register = (channel: string, receive: (...args: unknown[]) => void): void => {
    const listener: IpcListener = (event, ...args) => {
      const matched = "controllerForSender" in source ? source.controllerForSender(event.sender) : source.currentWebContents() === event.sender ? source : undefined;
      if (!matched) return;
      controller = matched; sender = event.sender;
      receive(...args);
    };
    listeners.push([channel, listener]);
    ipcMain.on(channel, listener);
  };
  register("pet-window:set-layout", (...args) => {
    if (args.length < 1 || args.length > 2) return;
    const [mode, contentHeight] = args;
    if (contentHeight !== undefined && (typeof contentHeight !== "number" || !Number.isFinite(contentHeight) || contentHeight < 0 || contentHeight > 16_384)) return;
    if (mode === "pet" || mode === "compact" || mode === "expanded") controller.setLayout(mode, contentHeight);
  });
  register("pet-window:set-interactive-regions", (...args) => {
    if (args.length === 1 && isRegions(args[0])) controller.setInteractiveRegions(args[0]);
  });
  register("pet-window:begin-move", (...args) => { if (args.length === 0) controller.beginMove(); });
  register("pet-window:move", (...args) => { if (args.length === 0) controller.move(); });
  register("pet-window:end-move", (...args) => { if (args.length === 0) controller.endMove(); });
  register("pet-window:hide", (...args) => { if (args.length===0 && "petIdForSender" in source) { const id=source.petIdForSender(sender); if(id)void source.hidePet(id); } });
  register("pet-window:receiving", (...args) => { if(args.length===1 && typeof args[0]==="boolean" && "petIdForSender" in source) { const id=source.petIdForSender(sender);if(id)source.setReceiving(id,args[0]); } });
  return () => {
    for (const [channel, listener] of listeners) ipcMain.removeListener(channel, listener);
  };
}

function isRegions(value: unknown): value is Rectangle[] {
  return Array.isArray(value) && value.length <= 64 && value.every((region: unknown) => {
    if (typeof region !== "object" || region === null) return false;
    const rect = region as Partial<Rectangle>;
    return [rect.x, rect.y, rect.width, rect.height].every((coordinate) => (
      typeof coordinate === "number" && Number.isFinite(coordinate) && Math.abs(coordinate) <= 16_384
    )) && rect.width! >= 0 && rect.height! >= 0;
  });
}
