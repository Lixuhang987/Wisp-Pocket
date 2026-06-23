export const nativeHostName = "com.handagent.chrome_bookmarks";
export const protocolVersion = 1;

export type ChromeBookmarkNode = {
  id: string;
  parentId?: string;
  title?: string;
  url?: string;
};

export type ChromeBookmarksNativeMessage =
  | {
      type: "handagent.bookmarks.hello";
      protocolVersion: 1;
      extensionVersion: string;
      extensionInstanceId: string;
      profileId: string;
      sentAt: string;
    }
  | {
      type: "handagent.bookmarks.created";
      protocolVersion: 1;
      eventId: string;
      bookmarkId: string;
      parentId: string;
      title: string;
      url: string;
      profileId: string;
      occurredAt: string;
    };

type NativePort = {
  postMessage(message: ChromeBookmarksNativeMessage): void;
  onDisconnect: {
    addListener(listener: () => void): void;
  };
};

type ChromeStorageArea = {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

export type ChromeBookmarksRuntimeChrome = {
  bookmarks: {
    onCreated: {
      addListener(listener: (id: string, bookmark: ChromeBookmarkNode) => void): void;
    };
  };
  runtime: {
    connectNative(hostName: string): NativePort;
    getManifest(): { version: string };
    lastError?: { message?: string };
  };
  storage: {
    local: ChromeStorageArea;
  };
};

type ChromeBookmarksRuntimeOptions = {
  chrome: ChromeBookmarksRuntimeChrome;
  now?: () => string;
  randomUUID?: () => string;
  reconnectDelayMs?: number;
  setTimeout?: (callback: () => void, delayMs: number) => unknown;
};

const extensionInstanceIdKey = "HANDAGENT_EXTENSION_INSTANCE_ID";
const profileIdKey = "HANDAGENT_PROFILE_ID";
const nativeStatusKey = "HANDAGENT_NATIVE_HOST_STATUS";

export class ChromeBookmarksBackgroundRuntime {
  private readonly chrome: ChromeBookmarksRuntimeChrome;
  private readonly now: () => string;
  private readonly randomUUID: () => string;
  private readonly reconnectDelayMs: number;
  private readonly scheduleTimeout: (callback: () => void, delayMs: number) => unknown;
  private port: NativePort | null = null;
  private extensionInstanceId: string | null = null;
  private profileId: string | null = null;
  private reconnectScheduled = false;

  constructor(options: ChromeBookmarksRuntimeOptions) {
    this.chrome = options.chrome;
    this.now = options.now ?? (() => new Date().toISOString());
    this.randomUUID = options.randomUUID ?? (() => crypto.randomUUID());
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1_000;
    this.scheduleTimeout = options.setTimeout ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  }

  async start(): Promise<void> {
    await this.ensureIdentity();
    this.connectNativeHost();
    this.chrome.bookmarks.onCreated.addListener((id, bookmark) => {
      this.handleBookmarkCreated(id, bookmark);
    });
  }

  handleBookmarkCreated(id: string, bookmark: ChromeBookmarkNode): void {
    if (!this.port || !this.extensionInstanceId || !this.profileId) {
      return;
    }
    if (!bookmark.url || !bookmark.parentId) {
      return;
    }
    this.port.postMessage({
      type: "handagent.bookmarks.created",
      protocolVersion,
      eventId: this.randomUUID(),
      bookmarkId: id,
      parentId: bookmark.parentId,
      title: bookmark.title ?? "",
      url: bookmark.url,
      profileId: this.profileId,
      occurredAt: this.now(),
    });
  }

  private async ensureIdentity(): Promise<void> {
    const stored = await this.chrome.storage.local.get([extensionInstanceIdKey, profileIdKey]);
    let extensionInstanceId = readString(stored[extensionInstanceIdKey]);
    let profileId = readString(stored[profileIdKey]);
    const updates: Record<string, string> = {};
    if (!extensionInstanceId) {
      extensionInstanceId = this.randomUUID();
      updates[extensionInstanceIdKey] = extensionInstanceId;
    }
    if (!profileId) {
      profileId = "chrome-default";
      updates[profileIdKey] = profileId;
    }
    if (Object.keys(updates).length > 0) {
      await this.chrome.storage.local.set(updates);
    }
    this.extensionInstanceId = extensionInstanceId;
    this.profileId = profileId;
  }

  private connectNativeHost(): void {
    try {
      const port = this.chrome.runtime.connectNative(nativeHostName);
      this.port = port;
      this.reconnectScheduled = false;
      port.onDisconnect.addListener(() => {
        this.port = null;
        void this.writeStatus("disconnected", this.chrome.runtime.lastError?.message);
        this.scheduleReconnect();
      });
      void this.writeStatus("connected");
      this.sendHello();
    } catch (error) {
      this.port = null;
      void this.writeStatus("disconnected", error instanceof Error ? error.message : String(error));
      this.scheduleReconnect();
    }
  }

  private sendHello(): void {
    if (!this.port || !this.extensionInstanceId || !this.profileId) {
      return;
    }
    this.port.postMessage({
      type: "handagent.bookmarks.hello",
      protocolVersion,
      extensionVersion: this.chrome.runtime.getManifest().version,
      extensionInstanceId: this.extensionInstanceId,
      profileId: this.profileId,
      sentAt: this.now(),
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectScheduled) {
      return;
    }
    this.reconnectScheduled = true;
    this.scheduleTimeout(() => {
      this.reconnectScheduled = false;
      this.connectNativeHost();
    }, this.reconnectDelayMs);
  }

  private async writeStatus(state: "connected" | "disconnected", error?: string): Promise<void> {
    await this.chrome.storage.local.set({
      [nativeStatusKey]: {
        state,
        hostName: nativeHostName,
        updatedAt: this.now(),
        ...(error ? { error } : {}),
      },
    });
  }
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
