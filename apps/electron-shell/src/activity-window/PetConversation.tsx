import { useEffect, useState, useLayoutEffect, useRef } from "react";
import type { ThreadState } from "../../../thread-window-web/src/store/threadWindowStore.ts";
import type { AssistantMessageItem, ThreadItem } from "../../../thread-window-web/src/messages/threadItems.ts";
import { hasAssistantText, hasSuggestedReplies, rolePromptAttachment } from "../../../thread-window-web/src/messages/threadItems.ts";
import { attachmentUrl } from "../../../thread-window-web/src/thread/attachmentUrl.ts";
import type { PetThreadController } from "./petThreadController.ts";
import { PetMarkdown } from "./PetMarkdown.tsx";

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
  const suggestedReplies = latestAssistant && hasSuggestedReplies(latestAssistant) ? latestAssistant.suggestedReplies ?? [] : [];
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
  if (message.type === "assistant_message" && !hasAssistantText(message)) return null;
  if (message.type === "error") return <p className="pet-message pet-error" data-pet-interactive>{message.message}</p>;
  const user = message.type === "user_message";
  const text = user && message.inputItems.length
    ? message.inputItems.flatMap(item => item.type === "text" || item.type === "text_selection" ? [item.text] : item.type === "skill" && !rolePromptAttachment(item) ? [item.prompt] : []).join("\n\n")
    : message.text;
  return <article className="pet-message" data-pet-interactive data-author={user ? "user" : "assistant"}>
    {user && message.inputItems.map(item => {
      const attachment = rolePromptAttachment(item);
      return attachment && <span className="pet-attachment pet-role-attachment" key={attachment.id} data-attachment-type={attachment.type} title={attachment.text}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 22v-2a8 8 0 0 1 16 0v2" /></svg>
        <span>{attachment.label}</span>
      </span>;
    })}
    {user && message.inputItems.map((item) => item.type === "image"
      ? <img key={item.id} src={attachmentUrl(item, threadURL)} alt={item.name ?? "交给桌宠的图片"} draggable={false} />
      : item.type === "file_reference" ? <span className="pet-attachment" key={item.id}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>{item.name}</span> : null)}
    {text && (user ? <p>{text}</p> : <div className={`pet-markdown${latest ? " pet-latest" : ""}`} data-testid={latest ? "pet-latest" : undefined}
      aria-live={latest ? "polite" : undefined}><PetMarkdown text={text} /></div>)}
    {user && message.pending && <small>待处理</small>}
  </article>;
}
