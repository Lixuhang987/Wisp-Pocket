import { useLayoutEffect, useRef } from "react";
import type { ThreadState } from "../../../thread-window-web/src/store/threadWindowStore.ts";
import { attachmentUrl } from "../../../thread-window-web/src/thread/attachmentUrl.ts";
import type { PetThreadController } from "./petThreadController.ts";

export function PetConversation({ thread, latestAssistantId, controller, attempt, threadURL }: {
  thread: ThreadState;
  latestAssistantId?: string;
  controller: PetThreadController;
  attempt: (action: () => void) => boolean;
  threadURL: string;
}) {
  const historyRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  useLayoutEffect(() => {
    const history = historyRef.current;
    if (history && followLatest.current) history.scrollTop = history.scrollHeight;
  }, [thread.messages, thread.permissionRequests, thread.workspaceRequests]);

  return <div className="pet-history" data-pet-scroll-viewport role="log" aria-label="对话历史" ref={historyRef} onScroll={() => {
      const history = historyRef.current!;
      followLatest.current = history.scrollHeight - history.scrollTop - history.clientHeight < 32;
    }}>
      {thread.messages.map((message) => {
        if (message.type === "tool_call") return null;
        if (message.type === "error") return <p className="pet-message pet-error" data-pet-interactive key={message.id}>{message.message}</p>;
        if (message.type === "assistant_message" && message.id === latestAssistantId) return null;
        const user = message.type === "user_message";
        return <article className="pet-message" data-pet-interactive data-author={user ? "user" : "assistant"} key={message.id}>
          {user && message.inputItems.map((item) => item.type === "image"
            ? <img key={item.id} src={attachmentUrl(item, threadURL)} alt={item.name ?? "交给桌宠的图片"} draggable={false} />
            : item.type === "pdf" ? <span className="pet-attachment" key={item.id}>PDF · {item.name}</span> : null)}
          {message.text && <p>{message.text}</p>}
          {user && message.pending && <small>待处理</small>}
        </article>;
      })}
      {thread.permissionRequests.map((request) => <section className="pet-request" data-pet-interactive key={request.id} aria-label="执行权限">
        <p>允许使用 {request.toolName}？</p>
        <pre>{request.argumentsJSON}</pre>
        <div className="pet-request__actions">
          <button type="button" onClick={() => attempt(() => controller.answerPermission(request.id, "allow"))}>允许一次</button>
          <button type="button" onClick={() => attempt(() => controller.answerPermission(request.id, "deny"))}>拒绝</button>
        </div>
      </section>)}
      {thread.workspaceRequests.map((request) => <section className="pet-request" data-pet-interactive key={request.id} aria-label="选择工作区">
        <p>{request.prompt}</p>
        <div className="pet-suggestions">
          {request.candidates.map((candidate) => <button key={candidate.id} type="button" title={candidate.description}
            onClick={() => attempt(() => controller.answerWorkspace(request.id, candidate.id))}>{candidate.name}</button>)}
          <button type="button" onClick={() => attempt(() => controller.answerWorkspace(request.id))}>取消</button>
        </div>
      </section>)}
    </div>;
}
