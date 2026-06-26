type MacOSDockElectronApp = {
  setActivationPolicy(policy: "regular" | "accessory" | "prohibited"): void;
  dock?: {
    show(): Promise<void> | void;
  };
};

export function configureMacOSDockApp(
  app: MacOSDockElectronApp,
  platform: NodeJS.Platform = process.platform,
): void {
  if (platform !== "darwin") {
    return;
  }

  app.setActivationPolicy("regular");
  void app.dock?.show();
}
