import { useEffect, useState, useLayoutEffect, useRef } from "react";
import type { ThreadState } from "../../../thread-window-web/src/store/threadWindowStore.ts";
import type { AssistantMessageItem, ThreadItem } from "../../../thread-window-web/src/store/threadItems.ts";
import { attachmentUrl } from "../../../thread-window-web/src/thread/attachmentUrl.ts";
import type { PetThreadController } from "./petThreadController.ts";

export function PetConversation({ thread, latestAssistant, expanded, status, error, controller, attempt, onRespond, threadURL }: {
  thread?: ThreadState;
  latestAssistant?: AssistantMessageItem;
  expanded: boolean;
  status?: string;
  error?: string | null;
  controller: PetThreadController;
  attempt: (action: () => void) => boolean;
  onRespond: (text: string) => void;
  threadURL: string;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { if (!expanded || !thread?.permissionRequests.length) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [expanded, thread?.permissionRequests.length]);
  const historyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  useLayoutEffect(() => {
    followLatest.current = true;
  }, [expanded, thread?.threadId]);
  useLayoutEffect(() => {
    const history = historyRef.current!;
    const follow = () => {
      if (!expanded || followLatest.current) history.scrollTop = history.scrollHeight;
    };
    follow();
    const observer = new ResizeObserver(follow);
    observer.observe(history);
    observer.observe(contentRef.current!);
    return () => observer.disconnect();
  }, [expanded, thread?.threadId, thread?.messages, thread?.permissionRequests, status, error]);

  const messages = expanded ? thread?.messages ?? [] : latestAssistant ? [latestAssistant] : [];
  const suggestedReplies = latestAssistant?.awaitingReply ? latestAssistant.suggestedReplies ?? [] : [];
  return <div className={`pet-history ${expanded ? "is-expanded" : ""}`} data-pet-scroll-viewport
    role={expanded ? "log" : undefined} aria-label={expanded ? "对话历史" : undefined} ref={historyRef} onScroll={() => {
      if (expanded) {
        const history = historyRef.current!;
        followLatest.current = history.scrollHeight - history.scrollTop - history.clientHeight < 32;
      }
    }}>
    <div className="pet-history-content" ref={contentRef}>
      {messages.map((message) => <PetMessage key={message.id} message={message}
        latest={message.id === latestAssistant?.id} threadURL={threadURL} />)}
      {(status || error) && <div className="pet-message pet-notice" data-pet-interactive>
        {status && <span className="pet-status" role="status">{status}</span>}
        {error && <p className="pet-error" role="alert">{error}</p>}
      </div>}
      {expanded && thread?.permissionRequests.map((request) => <section className="pet-request" data-pet-interactive key={request.id} aria-label="执行权限">
        <p>{controller.getSnapshot().pet?.name} · {thread.title || thread.threadId}<br />允许使用 {request.toolName}？</p>
        <pre>{request.argumentsJSON}</pre>
        {request.expiresAt && <small>剩余 {Math.max(0, Math.ceil((request.expiresAt - now) / 1000))} 秒</small>}
        <div className="pet-request__actions">
          <button type="button" disabled={!!request.expiresAt && request.expiresAt <= now} onClick={() => attempt(() => controller.answerPermission(request.id, "allow"))}>允许一次</button>
          <button type="button" disabled={!!request.expiresAt && request.expiresAt <= now} onClick={() => attempt(() => controller.answerPermission(request.id, "deny"))}>拒绝</button>
          <button type="button" disabled={!!request.expiresAt && request.expiresAt <= now} onClick={() => attempt(() => controller.answerPermission(request.id, "allow", "always"))}>永久允许</button>
          <button type="button" disabled={!!request.expiresAt && request.expiresAt <= now} onClick={() => attempt(() => controller.answerPermission(request.id, "deny", "always"))}>永久拒绝</button>
          <small>永久决定对所有桌宠的此工具生效。</small>
        </div>
      </section>)}
      {suggestedReplies.length > 0 && <div className="pet-suggestions pet-current-suggestions" aria-label="当前建议">
        {suggestedReplies.map((reply) => <button type="button" data-pet-interactive key={reply}
          onClick={() => onRespond(reply)}>{reply}</button>)}
      </div>}
    </div>
  </div>;
}

function PetMessage({ message, latest, threadURL }: { message: ThreadItem; latest: boolean; threadURL: string }) {
  if (message.type === "tool_call") return null;
  if (message.type === "error") return <p className="pet-message pet-error" data-pet-interactive>{message.message}</p>;
  const user = message.type === "user_message";
  return <article className="pet-message" data-pet-interactive data-author={user ? "user" : "assistant"}>
    {user && message.inputItems.map((item) => item.type === "image"
      ? <img key={item.id} src={attachmentUrl(item, threadURL)} alt={item.name ?? "交给桌宠的图片"} draggable={false} />
      : item.type === "pdf" ? <span className="pet-attachment" key={item.id}>PDF · {item.name}</span> : null)}
    {message.text && <p className={latest ? "pet-latest" : undefined} data-testid={latest ? "pet-latest" : undefined}
      aria-live={latest ? "polite" : undefined}>{message.text}</p>}
    {user && message.pending && <small>待处理</small>}
  </article>;
}
