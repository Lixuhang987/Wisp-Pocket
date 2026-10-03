type IpcMain = {
  handle(channel: string, handler: (event: { sender: unknown }, ...args: unknown[]) => unknown): unknown;
};

export type PickedPetImage = { name: string; mimeType: string; bytesBase64: string };

/** Only native picker results leave main; callers cannot submit filesystem paths. */
export function registerSettingsManagementIpc(ipcMain: IpcMain, options: {
  isManagementSender(sender: unknown): boolean;
  chooseDirectory(): Promise<string | null>;
  chooseImage(): Promise<PickedPetImage | null>;
  showPet(petId: string): Promise<void>;
  hidePet(petId: string): Promise<void>;
  getPetVisibility(): Record<string, boolean>;
}): void {
  const requireSender = (sender: unknown) => {
    if (!options.isManagementSender(sender)) throw new Error("Invalid settings window sender");
  };
  for (const [channel, action] of [
    ["settings:choose-directory", () => options.chooseDirectory()],
    ["settings:choose-image", () => options.chooseImage()],
    ["settings:pet-visibility", () => options.getPetVisibility()],
  ] as const) {
    ipcMain.handle(channel, (event, ...args) => {
      requireSender(event.sender);
      if (args.length) throw new Error("Invalid settings request");
      return action();
    });
  }
  for (const [channel, action] of [
    ["settings:show-pet", (petId: string) => options.showPet(petId)],
    ["settings:hide-pet", (petId: string) => options.hidePet(petId)],
  ] as const) {
    ipcMain.handle(channel, (event, petId, ...args) => {
      requireSender(event.sender);
      if (typeof petId !== "string" || !petId.trim() || args.length) throw new Error("Invalid pet management request");
      return action(petId);
    });
  }
}
