import type {
  ElectronToSwiftEvent,
  HostTheme,
  SwiftToElectronCommand,
} from "./protocol/electronShellProtocol.js";

type ThreadWindowClosedEvent = {
  wasPrepared: boolean;
  wasVisible: boolean;
};

type InitialPromptCommand = Extract<
  SwiftToElectronCommand,
  { type: "thread_window.open_initial_prompt" }
>;

type ThreadWindowHost = {
  prepare(): Promise<void>;
  openInitialPrompt(payload: InitialPromptCommand["payload"]): Promise<void>;
  openThread(threadId: string): Promise<void>;
  openHistory(): Promise<void>;
  focus(): boolean;
  updateTheme(theme: HostTheme): Promise<void>;
};

type ActivityWindowHost = {
  showPet?(petId:string): Promise<void>;
  hidePet?(petId:string): Promise<void>;
  show(): Promise<void>;
  updateTheme(theme: HostTheme): Promise<void>;
};

type Options = {
  prewarmer: ThreadWindowHost;
  activityWindow: ActivityWindowHost;
  send: (event: ElectronToSwiftEvent) => void;
  now: () => string;
  stopSupervisor: () => void;
  quit: () => void;
};

export class ElectronShellRuntime {
  private hasAgentServerHealth = false;
  private prewarmAfterServerReadyPromise: Promise<void> | null = null;

  constructor(private readonly options: Options) {}

  handleAgentServerHealth(event: { available: boolean; message?: string }): void {
    this.hasAgentServerHealth = event.available;
    this.options.send({
      channel: "electron_shell",
      type: "agent_server.health",
      available: event.available,
      ...(event.message ? { message: event.message } : {}),
    });

    if (event.available) {
      void this.prewarmThreadWindowAfterServerReady();
    }
  }

  handleThreadWindowClosed(event: ThreadWindowClosedEvent): void {
    this.options.send({
      channel: "electron_shell",
      type: "thread_window.closed",
      timestamp: this.options.now(),
      wasVisible: event.wasVisible,
    });

    if (event.wasPrepared && this.hasAgentServerHealth) {
      void this.prewarmThreadWindowAfterServerReady();
    }
  }

  async handleCommand(command: SwiftToElectronCommand): Promise<void> {
    switch (command.type) {
      case "thread_window.open_initial_prompt":
        await this.runCommand(command, () => this.options.prewarmer.openInitialPrompt(command.payload));
        return;
      case "thread_window.open_history":
        await this.runCommand(command, () => this.options.prewarmer.openHistory());
        return;
      case "thread_window.focus": {
        const threadId = command.threadId;
        if (threadId) {
          await this.runCommand(command, () => this.options.prewarmer.openThread(threadId));
        } else if (this.options.prewarmer.focus()) {
          this.ack(command, true);
        } else {
          await this.runCommand(command, () => this.options.prewarmer.openHistory());
        }
        return;
      }
      case "activity_window.show":
        await this.runCommand(command, () => this.options.activityWindow.show());
        return;
      case "pet.show":
      case "pet.hide":
        await this.runCommand(command, async () => {
          const action = command.type === "pet.show" ? this.options.activityWindow.showPet : this.options.activityWindow.hidePet;
          if (!action) throw new Error("Pet windows unavailable");
          await action.call(this.options.activityWindow, command.petId);
        });
        return;
      case "theme.changed":
        await this.runCommand(command, async () => {
          await this.options.prewarmer.updateTheme(command.theme);
          await this.options.activityWindow.updateTheme(command.theme);
        });
        return;
      case "shutdown":
        this.ack(command, true);
        this.options.stopSupervisor();
        this.options.quit();
        return;
    }
  }

  private async prewarmThreadWindowAfterServerReady(): Promise<void> {
    if (this.prewarmAfterServerReadyPromise) {
      return this.prewarmAfterServerReadyPromise;
    }

    this.prewarmAfterServerReadyPromise = this.options.prewarmer.prepare()
      .then(() => {
        this.options.send({
          channel: "electron_shell",
          type: "thread_window.prepared",
          timestamp: this.options.now(),
        });
      })
      .catch((error: unknown) => {
        this.options.send({
          channel: "electron_shell",
          type: "thread_window.prepare_failed",
          message: errorMessage(error),
        });
      })
      .finally(() => {
        this.prewarmAfterServerReadyPromise = null;
      });

    return this.prewarmAfterServerReadyPromise;
  }

  private async runCommand(command: SwiftToElectronCommand, operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
      this.ack(command, true);
    } catch (error) {
      this.ack(command, false, errorMessage(error));
    }
  }

  private ack(command: SwiftToElectronCommand, ok: boolean, error?: string): void {
    this.options.send({
      channel: "electron_shell",
      type: "command.ack",
      commandId: command.commandId,
      ok,
      ...(error ? { error } : {}),
    });
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
