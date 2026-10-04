import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type DragEvent, type ReactElement } from "react";
import { PetThreadController, type PetDropTarget } from "./petThreadController.ts";
import { PetConversation } from "./PetConversation.tsx";
import { PetSprite } from "./PetSprite.tsx";
import { PetReply } from "./PetReply.tsx";
import { PetSizeControl, usePetSize } from "./PetSizeControl.tsx";
import { PetManager } from "./PetManager.tsx";
import { PetContextMenu, type PetMenuAction } from "./PetContextMenu.tsx";
import { readDroppedItems } from "./readDroppedItems.ts";
import { petWindowLayout } from "../petWindowLayout.ts";

type HostTheme = { preference: "light" | "dark" | "system"; resolved: "light" | "dark" };

declare global {
  interface Window {
    handAgentActivityWindowConfig?: { threadWebSocketURL?: string; petId?: string };
    handAgentTheme?: HostTheme;
    handAgentSubscribeThemeChange?: (handler: (theme: HostTheme) => void) => () => void;
    handAgentPet?: {
      getPathForFile(file: File): string;
      chooseFiles(): Promise<string[]>;
      setReceiving(receiving: boolean): void;
      showPet(petId: string): Promise<void>;
      hidePet(): void;
      onReveal(handler: () => void): () => void;
      setLayout(mode: "pet" | "compact" | "expanded", contentHeight?: number): void;
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
  const [controller] = useState(() => suppliedController ?? new PetThreadController({ url: threadURL(), petId: window.handAgentActivityWindowConfig?.petId ?? "" }));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const thread = snapshot.threadId ? controller.store.getState().threadsById[snapshot.threadId] : undefined;
  const [hovered, setHovered] = useState(false);
  const draft = snapshot.draft;
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionPending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const displayedError = error ?? snapshot.error ?? thread?.errorMessage ?? controller.store.getState().windowErrorMessage;
  const [reading, setReading] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [dropTarget, setDropTarget] = useState<PetDropTarget | null>(null);
  const [moving, setMoving] = useState(false);
  const [petSize, setPetSize] = usePetSize(controller.petId, snapshot.pet?.size ?? 100, setError);
  const [sizeControlsOpen, setSizeControlsOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const petScale = petWindowLayout.character.defaultScale * (petSize / 100);
  const petWidth = petWindowLayout.character.width * petScale;
  const petHeight = petWindowLayout.character.height * petScale;
  const petRef = useRef<HTMLButtonElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const focusRequested = useRef(false);
  const stageRef = useRef<HTMLElement>(null);
  const movement = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const ignoreClick = useRef(false);
  const visible = snapshot.bubbleVisible;
  const expanded = visible && hovered;
  const layout = managerOpen || historyOpen || workspaceOpen ? "expanded" : expanded ? "expanded" : visible || sizeControlsOpen || contextMenuOpen ? "compact" : "pet";
  const pending = thread?.messages.filter((item) => item.type === "user_message" && item.pending).length ?? 0;
  const waiting = !!(snapshot.latestAssistant?.awaitingReply || thread?.permissionRequests.length);
  const status = snapshot.connection !== "connected" ? "正在连接…"
    : reading ? "正在接收…" : submitting ? "正在发送…" : pending ? `${pending} 条待处理`
    : waiting ? "等你回复" : thread?.status === "running" ? "正在处理…" : snapshot.pet?.name ?? "月见八千代";
  const showStatus = snapshot.connection !== "connected" || reading || submitting || pending > 0 || thread?.status === "running"
    || !!thread?.permissionRequests.length;

  useEffect(() => {
    controller.connect();
    return () => controller.disconnect();
  }, [controller]);

  useEffect(() => {
    const applyTheme = (theme: HostTheme) => { document.documentElement.dataset.theme = theme.resolved; };
    applyTheme(window.handAgentTheme ?? { preference: "system", resolved: "light" });
    return window.handAgentSubscribeThemeChange?.(applyTheme);
  }, []);

  useEffect(() => setImageFailed(false), [snapshot.pet?.imageRef]);
  useEffect(() => window.handAgentPet?.onReveal(() => controller.revealBubble()), [controller]);
  useEffect(() => { window.handAgentPet?.setReceiving(choosing || reading || snapshot.receiving); }, [choosing, reading, snapshot.receiving]);

  useLayoutEffect(() => {
    if (visible && focusRequested.current) {
      focusRequested.current = false;
      replyRef.current?.focus({ preventScroll: true });
    }
  }, [visible]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const elements = [...stage?.querySelectorAll<HTMLElement>("[data-pet-interactive]") ?? []];
    const content = stage?.querySelector<HTMLElement>(".pet-history-content");
    const reportRegions = () => {
      const reply = stage?.querySelector<HTMLElement>(".pet-reply");
      const sizeControl = stage?.querySelector<HTMLElement>(".pet-size-control");
      const contextMenu = stage?.querySelector<HTMLElement>(".pet-context-menu");
      const conversationHeight = content && reply
        ? content.scrollHeight + reply.offsetHeight + petWindowLayout.inset * (content.children.length ? 3 : 2) : 0;
      const sizeControlHeight = sizeControl ? sizeControl.offsetHeight + petHeight + petWindowLayout.inset * 2 : 0;
      const contextMenuHeight = contextMenu ? contextMenu.offsetHeight + petHeight + petWindowLayout.inset * 2 : 0;
      window.handAgentPet?.setLayout(layout, layout === "compact" ? Math.ceil(Math.max(conversationHeight, sizeControlHeight, contextMenuHeight)) : undefined);
      window.handAgentPet?.setInteractiveRegions(elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const clip = element.closest<HTMLElement>("[data-pet-scroll-viewport]")?.getBoundingClientRect();
        const x = Math.max(rect.left, clip?.left ?? rect.left);
        const y = Math.max(rect.top, clip?.top ?? rect.top);
        return {
          x, y,
          width: Math.min(rect.right, clip?.right ?? rect.right) - x,
          height: Math.min(rect.bottom, clip?.bottom ?? rect.bottom) - y,
        };
      }).filter((rect) => rect.width > 0 && rect.height > 0));
    };
    reportRegions();
    const observer = new ResizeObserver(reportRegions);
    observer.observe(document.documentElement);
    if (content) observer.observe(content);
    for (const element of elements) observer.observe(element);
    stage?.addEventListener("scroll", reportRegions, true);
    window.addEventListener("resize", reportRegions);
    return () => {
      observer.disconnect();
      stage?.removeEventListener("scroll", reportRegions, true);
      window.removeEventListener("resize", reportRegions);
    };
  }, [layout, historyOpen, managerOpen, workspaceOpen, petSize, sizeControlsOpen, contextMenuOpen, visible, status, displayedError, thread?.messages, thread?.permissionRequests, snapshot.files, snapshot.pet]);

  function attempt(action: () => void): boolean {
    try { action(); setError(null); return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); return false; }
  }

  function updateDraft(text: string): void {
    controller.setDraft(text);
  }

  function respond(text: string, includeFiles = false): void {
    if ((!text.trim() && (!includeFiles || !snapshot.files.length)) || submissionPending.current) return;
    attempt(() => {
      const accepted = controller.respond(text, includeFiles);
      if (!accepted) { updateDraft(""); return; }
      submissionPending.current = true;
      setSubmitting(true);
      void accepted.catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : String(failure));
      }).finally(() => {
        submissionPending.current = false;
        setSubmitting(false);
      });
    });
  }

  async function chooseFiles(): Promise<void> {
    const targetThreadId = snapshot.threadId;
    setChoosing(true);
    setError(null);
    try {
      const paths = await window.handAgentPet?.chooseFiles();
      if (paths?.length) controller.addFiles(paths, targetThreadId);
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setChoosing(false); }
  }

  function newTopic(): void {
    void controller.newTopic().then(() => controller.revealBubble()).catch(failure => setError(failure instanceof Error ? failure.message : String(failure)));
    setHistoryOpen(false);
    setError(null);
    replyRef.current?.focus({ preventScroll: true });
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
    const submissionId = crypto.randomUUID();
    const items = readDroppedItems(event.dataTransfer);
    setDropTarget(null);
    setError(null);
    setReading(true);
    controller.revealBubble();
    try { await controller.drop(await items, target, capturedThreadId, submissionId); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setReading(false); }
  }

  function hide(): void {
    controller.hideBubble();
    setError(null);
    setHovered(false);
    replyRef.current?.blur();
  }

  function selectMenuAction(action: PetMenuAction): void {
    setContextMenuOpen(false);
    setSizeControlsOpen(action === "size");
    setManagerOpen(action === "manager");
    setHistoryOpen(action === "history");
    setWorkspaceOpen(action === "workspace");
    if (action === "summon") {
      const workspaceId = snapshot.pet?.workspaceId;
      if (!workspaceId) { setError("请先选择工作区。"); return; }
      void window.handAgentSettings?.summonPet(workspaceId).catch(failure=>setError(failure instanceof Error?failure.message:String(failure)));
    }
    if (action === "hide") window.handAgentPet?.hidePet();
  }

  return (
    <main ref={stageRef} className="pet-stage" data-layout={layout} style={{
      "--pet-character-right": `${petWindowLayout.character.right}px`,
      "--pet-conversation-left": `${petWindowLayout.conversationLeft}px`,
      "--pet-conversation-width": `${petWindowLayout.conversationWidth}px`,
      "--pet-inset": `${petWindowLayout.inset}px`,
      "--pet-reply-height": `${petWindowLayout.replyHeight}px`,
      "--pet-toolbar-height": `${petWindowLayout.toolbarHeight}px`,
    } as CSSProperties} onDragLeave={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
    }}>
      {contextMenuOpen && <PetContextMenu name={snapshot.pet?.name ?? "月见八千代"} petId={controller.petId} bottom={petHeight + 8}
        onSelect={selectMenuAction} onClose={() => setContextMenuOpen(false)} onEscape={() => petRef.current?.focus({ preventScroll: true })} />}
      {managerOpen && <PetManager controller={controller} threadURL={threadURL()} onClose={() => setManagerOpen(false)} />}
      {workspaceOpen && <PetManager controller={controller} threadURL={threadURL()} assignOnly onClose={() => setWorkspaceOpen(false)} />}
      {historyOpen && <section className="pet-popover" data-pet-interactive aria-label="工作区对话">
        <header><span>{controller.store.getState().workspaces.find(workspace=>workspace.id===snapshot.pet?.workspaceId)?.name ?? "当前工作区"}的对话</span><button onClick={() => setHistoryOpen(false)}>关闭</button></header>
        {snapshot.history.map(item => <div className="pet-history-row" key={item.id}>
          <button onClick={() => { void controller.selectThread(item.id).then(()=>{controller.revealBubble();setHistoryOpen(false);}).catch(failure=>setError(failure instanceof Error?failure.message:String(failure))); }}>{item.preview || "新对话"}<small>{item.status} · {item.updatedAt.slice(0,16).replace("T"," ")}</small></button>
          <button aria-label={`删除 ${item.preview || "新对话"}`} onClick={() => setDeleteTarget(item.id)}>删除</button>
        </div>)}
        {snapshot.nextCursor && <button onClick={() => controller.listMore()}>更多对话</button>}
        {deleteTarget && <div role="alertdialog"><p>删除此对话的本地历史？</p><button onClick={() => { attempt(() => controller.deleteThread(deleteTarget)); setDeleteTarget(null); }}>确认删除</button><button onClick={() => setDeleteTarget(null)}>取消</button></div>}
      </section>}
      {visible && (
        <section data-testid="pet-conversation" aria-label="当前对话"
          className={`pet-conversation ${expanded ? "is-expanded" : ""} ${dropTarget === "conversation" ? "is-drop-target" : ""}`}
          onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
          onDragEnter={(event) => dragOver(event, "conversation")}
          onDragOver={(event) => dragOver(event, "conversation")} onDrop={(event) => void drop(event, "conversation")}>
          <PetConversation thread={thread} latestAssistant={snapshot.latestAssistant} expanded={expanded}
            status={showStatus ? status : undefined} error={displayedError}
            controller={controller} attempt={attempt} onRespond={respond} threadURL={threadURL()} />
          <PetReply draft={draft} setDraft={updateDraft} files={snapshot.files} onRemoveFile={id => controller.removeFile(id)}
            onChooseFiles={() => void chooseFiles()} onNewTopic={newTopic} onStop={() => attempt(() => controller.stop())}
            onRespond={text => respond(text, true)} inputRef={replyRef} submitting={submitting || snapshot.receiving}
            choosing={choosing} running={thread?.status === "running"} />
          {dropTarget === "conversation" && <div className="pet-drop-label">添加到当前对话</div>}
        </section>
      )}
      <button ref={petRef} data-pet-interactive className={`pet-character ${moving ? "is-moving" : ""} ${dropTarget === "pet" ? "is-drop-target" : ""}`}
        style={{ width: petWidth, height: petHeight }}
        type="button" aria-label={`${snapshot.pet?.name ?? "月见八千代"}，点击切换对话，拖动移动位置`} title="点击显示或隐藏对话 · 拖入内容开始新对话 · 右键打开菜单"
        onContextMenu={(event) => { event.preventDefault(); setSizeControlsOpen(false); setContextMenuOpen(true); }}
        onClick={() => {
          if (ignoreClick.current) { ignoreClick.current = false; return; }
          if (visible) hide();
          else { focusRequested.current = true; controller.revealBubble(); }
        }}
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
        {snapshot.pet?.imageRef.type === "imported" && !imageFailed ? <img className="pet-custom-image" draggable={false} alt={snapshot.pet.name} src={snapshot.pet.imageRef.url} onError={event => { setImageFailed(true); setError("桌宠图片不可用，请在伙伴设置中重新导入。"); }} /> : <PetSprite scale={petScale} state={moving ? "moving" : displayedError || thread?.status === "failed" ? "failed" : waiting ? "waiting" : thread?.status === "running" ? "running" : "idle"} />}
        {dropTarget === "pet" && <span className="pet-drop-label">{snapshot.pet?.name} · 新对话</span>}
      </button>
      {sizeControlsOpen && <PetSizeControl size={petSize} bottom={petHeight + 8}
        onChange={setPetSize} onClose={() => setSizeControlsOpen(false)} />}
    </main>
  );
}
