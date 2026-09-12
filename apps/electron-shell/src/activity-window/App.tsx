import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type DragEvent, type ReactElement } from "react";
import { PetThreadController, type PetDropTarget } from "./petThreadController.ts";
import { PetConversation } from "./PetConversation.tsx";
import { PetSprite } from "./PetSprite.tsx";
import { readDroppedItems } from "./readDroppedItems.ts";

type HostTheme = { preference: "light" | "dark" | "system"; resolved: "light" | "dark" };

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

function threadURL(): string {
  return window.handAgentActivityWindowConfig?.threadWebSocketURL ?? "ws://127.0.0.1:4317/api/thread?acceptServerRequests=1";
}

export function App({ controller: suppliedController }: { controller?: PetThreadController } = {}): ReactElement {
  const [controller] = useState(() => suppliedController ?? new PetThreadController({ url: threadURL() }));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const thread = snapshot.threadId ? controller.store.getState().threadsById[snapshot.threadId] : undefined;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const displayedError = error ?? thread?.errorMessage ?? controller.store.getState().windowErrorMessage;
  const [reading, setReading] = useState(false);
  const [dropTarget, setDropTarget] = useState<PetDropTarget | null>(null);
  const [moving, setMoving] = useState(false);
  const petRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLElement>(null);
  const movement = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const ignoreClick = useRef(false);
  const visible = snapshot.bubbleVisible || error !== null || reading;
  const expanded = visible && (hovered || focused);
  const layout = !visible ? "pet" : expanded ? "expanded" : "compact";
  const pending = thread?.messages.filter((item) => item.type === "user_message" && item.pending).length ?? 0;
  const waiting = !!(snapshot.latestAssistant?.awaitingReply || thread?.permissionRequests.length || thread?.workspaceRequests.length);
  const status = snapshot.connection !== "connected" ? "正在连接…"
    : reading ? "正在接收…" : pending ? `${pending} 条待处理`
    : waiting ? "等你回复" : thread?.status === "running" ? "正在处理…" : "月见八千代";

  useEffect(() => {
    controller.connect();
    return () => controller.disconnect();
  }, [controller]);

  useEffect(() => {
    const applyTheme = (theme: HostTheme) => { document.documentElement.dataset.theme = theme.resolved; };
    applyTheme(window.handAgentTheme ?? { preference: "system", resolved: "light" });
    return window.handAgentSubscribeThemeChange?.(applyTheme);
  }, []);

  useEffect(() => { setDraft(""); setFocused(false); }, [snapshot.threadId]);

  useLayoutEffect(() => {
    window.handAgentPet?.setLayout(layout);
    const reportRegions = () => {
      const elements = [petRef.current, bubbleRef.current].filter((element): element is HTMLElement => element !== null);
      window.handAgentPet?.setInteractiveRegions(elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }));
    };
    reportRegions();
    const observer = new ResizeObserver(reportRegions);
    observer.observe(document.documentElement);
    if (bubbleRef.current) observer.observe(bubbleRef.current);
    window.addEventListener("resize", reportRegions);
    return () => { observer.disconnect(); window.removeEventListener("resize", reportRegions); };
  }, [layout]);

  function attempt(action: () => void): boolean {
    try { action(); setError(null); return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); return false; }
  }

  function respond(text: string): void {
    if (text.trim() && attempt(() => controller.respond(text))) setDraft("");
  }

  function dragOver(event: DragEvent, target: PetDropTarget): void {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setDropTarget(target);
  }

  async function drop(event: DragEvent, target: PetDropTarget): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    // The destination is captured at release, before asynchronous file reads.
    const capturedThreadId = snapshot.threadId ?? undefined;
    const items = readDroppedItems(event.dataTransfer);
    setDropTarget(null);
    setError(null);
    setReading(true);
    controller.revealBubble();
    try { controller.drop(await items, target, capturedThreadId); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setReading(false); }
  }

  function hide(): void {
    controller.hideBubble();
    setError(null);
    setHovered(false);
    setFocused(false);
  }

  return (
    <main className="pet-stage" data-layout={layout} onDragLeave={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
    }}>
      {visible && (
        <section ref={bubbleRef} data-testid="pet-conversation" aria-label="当前对话"
          className={`pet-conversation ${expanded ? "is-expanded" : ""} ${dropTarget === "conversation" ? "is-drop-target" : ""}`}
          onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
          onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
          }}
          onDragEnter={(event) => dragOver(event, "conversation")}
          onDragOver={(event) => dragOver(event, "conversation")} onDrop={(event) => void drop(event, "conversation")}>
          <header className="pet-heading">
            <span className="pet-heading__status"><i data-busy={thread?.status === "running"} />{status}</span>
            <div className="pet-heading__actions">
              <button type="button" aria-label="隐藏气泡" title="隐藏气泡" onClick={hide}>×</button>
            </div>
          </header>
          {displayedError && <p className="pet-error" role="alert">{displayedError}</p>}
          {expanded && thread ? (
            <PetConversation thread={thread} controller={controller} draft={draft} setDraft={setDraft}
              onRespond={respond} attempt={attempt} threadURL={threadURL()} />
          ) : (
            <p className="pet-latest" data-testid="pet-latest" aria-live="polite">
              {snapshot.latestAssistant?.text ?? (reading ? "正在接收你交给我的内容。" : thread?.status === "running" ? "我先看看你交给我的内容。" : "把内容拖给我，我们接着聊。")}
            </p>
          )}
          {dropTarget === "conversation" && <div className="pet-drop-label">添加到当前对话</div>}
        </section>
      )}
      <button ref={petRef} className={`pet-character ${moving ? "is-moving" : ""} ${dropTarget === "pet" ? "is-drop-target" : ""}`}
        type="button" aria-label="月见八千代，点击显示对话，拖动移动位置" title="拖入内容开始新对话 · 拖动我更换位置"
        onClick={() => { if (ignoreClick.current) { ignoreClick.current = false; return; } controller.revealBubble(); }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          movement.current = { x: event.screenX, y: event.screenY, moved: false };
          ignoreClick.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
          window.handAgentPet?.beginMove();
        }}
        onPointerMove={(event) => {
          const start = movement.current;
          if (!start) return;
          if (Math.hypot(event.screenX - start.x, event.screenY - start.y) > 4) start.moved = true;
          if (start.moved) { setMoving(true); window.handAgentPet?.move(); }
        }}
        onPointerUp={(event) => {
          ignoreClick.current = movement.current?.moved ?? false;
          movement.current = null;
          setMoving(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          window.handAgentPet?.endMove();
        }}
        onPointerCancel={() => { movement.current = null; setMoving(false); window.handAgentPet?.endMove(); }}
        onDragEnter={(event) => dragOver(event, "pet")} onDragOver={(event) => dragOver(event, "pet")}
        onDrop={(event) => void drop(event, "pet")}>
        <PetSprite state={moving ? "moving" : displayedError || thread?.status === "failed" ? "failed" : waiting ? "waiting" : thread?.status === "running" ? "running" : "idle"} />
        {dropTarget === "pet" && <span className="pet-drop-label">新对话</span>}
      </button>
    </main>
  );
}
