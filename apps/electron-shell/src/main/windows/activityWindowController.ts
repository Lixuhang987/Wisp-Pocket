import type { BrowserWindowConstructorOptions, Point, Rectangle } from "electron";
import type { HostTheme } from "../protocol/electronShellProtocol.js";
import { PetPositionStore, type PetPosition } from "./petPositionStore.js";
import { petWindowLayout, type PetLayout } from "../../petWindowLayout.js";

export type { PetLayout } from "../../petWindowLayout.js";

export type BrowserWindowLike = {
  webContents: {
    on(event: "render-process-gone", listener: (event: unknown, details: { reason: string }) => void): unknown;
    send(channel: string, theme?: HostTheme): void;
  };
  on(event: "closed", listener: () => void): unknown;
  loadFile(filePath: string): Promise<unknown> | unknown;
  setBounds(bounds: Rectangle): void;
  getBounds(): Rectangle;
  setIgnoreMouseEvents(ignore: boolean, options: { forward: boolean }): void;
  showInactive(): void;
  hide?(): void;
  close?(): void;
};

type ScreenProvider = {
  getPrimaryWorkArea(): Rectangle;
  getDisplayForPoint?(point: Point): {id:string;workArea:Rectangle};
  getWorkAreaForDisplay?(id: string): Rectangle | undefined;
  getWorkAreaForPoint(point: Point): Rectangle;
  getCursorScreenPoint(): Point;
  subscribeWorkAreaChanges(listener: () => void): () => void;
};

type Options = {
  activityWindowHTMLPath: string;
  preloadPath: string;
  threadWebSocketURL?: string;
  petId?: string;
  initialOffset?: number;
  initialTheme?: HostTheme;
  createWindow: (options: BrowserWindowConstructorOptions) => BrowserWindowLike;
  screenProvider: ScreenProvider;
  positionStore: PetPositionStore;
  onRendererCrashed?: (reason: string) => void;
};

const WINDOW_MARGIN = 24;
const layoutSizes = petWindowLayout.sizes;
const fallbackTheme: HostTheme = { preference: "system", resolved: "light" };

export class ActivityWindowController {
  private window: BrowserWindowLike | null = null;
  private bounds: Rectangle | null = null;
  private position: PetPosition | null = null;
  private layout: PetLayout = "pet";
  private contentHeight: number = layoutSizes.pet.height;
  private interactiveRegions: Rectangle[] = [];
  private mouseIgnored: boolean | null = null;
  private moveOrigin: { cursor: Point; position: PetPosition } | null = null;
  private cursorTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeScreen: (() => void) | null = null;
  private hasLoaded = false;
  private loadPromise: Promise<void> | null = null;
  private theme: HostTheme;
  private pendingThemeBroadcast = false;

  constructor(private readonly options: Options) {
    this.theme = options.initialTheme ?? fallbackTheme;
  }

  async show(): Promise<void> {
    const window = this.ensureWindow();
    if (!this.hasLoaded) {
      this.loadPromise ??= this.load(window).finally(() => {
        if (this.window === window) this.loadPromise = null;
      });
      await this.loadPromise;
    }
    if (this.window !== window) throw new Error("pet window closed before it was shown");
    this.startWatchingScreen();
    this.updateMouseHit();
    window.showInactive();
  }

  hide(): void { this.window?.hide?.(); }
  close(): void { this.window?.close?.(); }
  reveal(): void { this.window?.webContents.send("pet-window:reveal"); }

  currentWebContents(): BrowserWindowLike["webContents"] | null {
    return this.window?.webContents ?? null;
  }

  setLayout(layout: PetLayout, contentHeight: number = layoutSizes[layout].height): void {
    const height = layout === "compact" ? Math.max(layoutSizes.pet.height, Math.min(contentHeight, layoutSizes.expanded.height)) : layoutSizes[layout].height;
    if (!this.window || !this.position || this.layout === layout && this.contentHeight === height) return;
    this.layout = layout;
    this.contentHeight = height;
    const oldPosition = this.position;
    this.place(this.position, this.workAreaForPosition(this.position));
    if (!samePosition(oldPosition, this.position)) this.savePosition();
  }

  setInteractiveRegions(regions: Rectangle[]): void {
    if (!this.bounds) return;
    this.interactiveRegions = clipRegions(regions, this.bounds);
    this.updateMouseHit();
  }

  beginMove(): void {
    if (!this.window || !this.position || !this.hasLoaded || this.moveOrigin) return;
    this.moveOrigin = {
      cursor: this.options.screenProvider.getCursorScreenPoint(),
      position: this.position,
    };
    this.updateMouseHit();
  }

  move(): void {
    if (!this.moveOrigin || !this.window) return;
    const cursor = this.options.screenProvider.getCursorScreenPoint();
    this.place({
      right: this.moveOrigin.position.right + cursor.x - this.moveOrigin.cursor.x,
      bottom: this.moveOrigin.position.bottom + cursor.y - this.moveOrigin.cursor.y,
    }, this.options.screenProvider.getWorkAreaForPoint(cursor));
  }

  endMove(): void {
    if (!this.moveOrigin) return;
    this.move();
    this.moveOrigin = null;
    this.savePosition();
    this.updateMouseHit();
  }

  async updateTheme(theme: HostTheme): Promise<void> {
    this.theme = theme;
    if (this.window && this.hasLoaded) {
      this.window.webContents.send("handagent:theme-changed", theme);
    } else if (this.window) {
      this.pendingThemeBroadcast = true;
    }
  }

  private ensureWindow(): BrowserWindowLike {
    if (this.window) return this.window;
    const primaryArea = this.options.screenProvider.getPrimaryWorkArea();
    this.position ??= this.restorePosition(this.options.positionStore.load()) ?? {
      right: primaryArea.x + primaryArea.width - WINDOW_MARGIN - (this.options.initialOffset ?? 0) - layoutSizes.compact.width + petWindowLayout.character.right,
      bottom: primaryArea.y + primaryArea.height - WINDOW_MARGIN,
    };
    const additionalArguments = [`--handagent-pet-id=${encodeURIComponent(this.options.petId ?? "")}`,`--handagent-theme=${encodeURIComponent(JSON.stringify(this.theme))}`];
    if (this.options.threadWebSocketURL) {
      additionalArguments.push(`--handagent-pet-thread-websocket-url=${encodeURIComponent(this.options.threadWebSocketURL)}`);
    }
    const bounds = boundsFor(this.position, this.layout, this.workAreaForPosition(this.position), this.contentHeight);
    const window = this.options.createWindow({
      ...bounds,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: true,
      acceptFirstMouse: true,
      resizable: false,
      webPreferences: {
        preload: this.options.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        additionalArguments,
      },
    });
    this.window = window;
    this.place(this.position, this.workAreaForPosition(this.position));
    this.savePosition();
    window.on("closed", () => {
      if (this.window !== window) return;
      if (this.moveOrigin) this.savePosition();
      if (this.cursorTimer) clearInterval(this.cursorTimer);
      this.unsubscribeScreen?.();
      this.cursorTimer = null;
      this.unsubscribeScreen = null;
      this.window = null;
      this.bounds = null;
      this.layout = "pet";
      this.contentHeight = layoutSizes.pet.height;
      this.interactiveRegions = [];
      this.moveOrigin = null;
      this.mouseIgnored = null;
      this.hasLoaded = false;
      this.loadPromise = null;
      this.pendingThemeBroadcast = false;
    });
    window.webContents.on("render-process-gone", (_event, details) => {
      if (this.window !== window || details.reason === "clean-exit") return;
      this.moveOrigin = null;
      this.interactiveRegions = [];
      this.updateMouseHit();
      window.close?.();
      this.options.onRendererCrashed?.(details.reason);
    });
    return window;
  }

  private async load(window: BrowserWindowLike): Promise<void> {
    await window.loadFile(this.options.activityWindowHTMLPath);
    if (this.window !== window) throw new Error("pet window closed before it was shown");
    this.hasLoaded = true;
    if (this.pendingThemeBroadcast) {
      this.pendingThemeBroadcast = false;
      window.webContents.send("handagent:theme-changed", this.theme);
    }
  }

  private startWatchingScreen(): void {
    if (!this.cursorTimer) {
      // 系统光标轮询也覆盖跨应用拖入；不能等被穿透窗口收到 mousemove 才恢复命中。
      this.cursorTimer = setInterval(() => this.updateMouseHit(), 16);
      this.cursorTimer.unref();
    }
    this.unsubscribeScreen ??= this.options.screenProvider.subscribeWorkAreaChanges(() => {
      if (!this.position) return;
      const restored = this.restorePosition(this.options.positionStore.load()) ?? this.position;
      this.place(restored, this.workAreaForPosition(restored));
      this.savePosition();
    });
  }

  private workAreaForPosition(position: PetPosition): Rectangle {
    return this.options.screenProvider.getWorkAreaForPoint({
      x: position.right - petWindowLayout.character.width / 2,
      y: position.bottom - petWindowLayout.character.height / 2,
    });
  }

  private place(position: PetPosition, workArea: Rectangle): void {
    if (!this.window) return;
    const previousBounds = this.bounds;
    this.window.setBounds(boundsFor(position, this.layout, workArea, this.contentHeight));
    this.bounds = this.window.getBounds();
    this.position = { right: this.bounds.x + Math.min(petWindowLayout.character.right, this.bounds.width), bottom: this.bounds.y + this.bounds.height };
    if (previousBounds) {
      // 对话列在角色右侧；宽度变化不改变本地 x，展开只增加锚点上方的空间。
      this.interactiveRegions = clipRegions(this.interactiveRegions.map((region) => ({
        ...region,
        y: region.y + this.bounds!.height - previousBounds.height,
      })), this.bounds);
    }
    this.updateMouseHit();
  }

  private updateMouseHit(): void {
    if (!this.window || !this.bounds) return;
    const cursor = this.options.screenProvider.getCursorScreenPoint();
    const localX = cursor.x - this.bounds.x;
    const localY = cursor.y - this.bounds.y;
    const interactive = this.moveOrigin !== null || this.interactiveRegions.some((region) => (
      localX >= region.x && localX < region.x + region.width
      && localY >= region.y && localY < region.y + region.height
    ));
    if (this.mouseIgnored === !interactive) return;
    this.mouseIgnored = !interactive;
    this.window.setIgnoreMouseEvents(!interactive, { forward: true });
  }

  private restorePosition(saved: PetPosition | null): PetPosition | null {
    if (!saved?.display || !this.options.screenProvider.getWorkAreaForDisplay) return saved;
    const area = this.options.screenProvider.getWorkAreaForDisplay(saved.display.id) ?? this.options.screenProvider.getPrimaryWorkArea();
    return {right:area.x + saved.display.x * area.width,bottom:area.y + saved.display.y * area.height};
  }

  private savePosition(): void {
    if (!this.position) return;
    const display = this.options.screenProvider.getDisplayForPoint?.({x:this.position.right - 1,y:this.position.bottom - 1});
    this.options.positionStore.save({...this.position, ...(display ? {display:{id:display.id,x:(this.position.right-display.workArea.x)/display.workArea.width,y:(this.position.bottom-display.workArea.y)/display.workArea.height}} : {})});
  }
}

function boundsFor(position: PetPosition, layout: PetLayout, workArea: Rectangle, contentHeight: number): Rectangle {
  const width = Math.min(layoutSizes[layout].width, workArea.width);
  // 常态与悬停都只使用锚点上方的空间，不能为了内容推走回复框和角色。
  const availableHeight = layout !== "pet"
    ? Math.max(layoutSizes.pet.height, position.bottom - workArea.y)
    : workArea.height;
  const height = Math.min(contentHeight, workArea.height, availableHeight);
  return {
    x: Math.round(Math.min(Math.max(position.right - Math.min(petWindowLayout.character.right, width), workArea.x), workArea.x + workArea.width - width)),
    y: Math.round(Math.min(Math.max(position.bottom - height, workArea.y), workArea.y + workArea.height - height)),
    width,
    height,
  };
}

function clipRegions(regions: Rectangle[], bounds: Rectangle): Rectangle[] {
  return regions.map((region) => {
    const x = Math.max(0, region.x);
    const y = Math.max(0, region.y);
    return {
      x, y,
      width: Math.min(bounds.width, region.x + region.width) - x,
      height: Math.min(bounds.height, region.y + region.height) - y,
    };
  }).filter((region) => region.width > 0 && region.height > 0);
}

function samePosition(left: PetPosition, right: PetPosition): boolean {
  return left.right === right.right && left.bottom === right.bottom;
}
