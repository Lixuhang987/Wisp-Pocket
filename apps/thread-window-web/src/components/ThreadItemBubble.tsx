import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Copy, Loader2, Pencil, RefreshCw } from 'lucide-react';
import type {
  AssistantMessageItem,
  ErrorItem,
  ThreadItem,
  ToolCallItem,
  UserMessageItem,
} from '../store/threadItems.ts';
import type { InputItem } from '../protocol/threadProtocol.ts';
import { cn } from '../utils/cn.ts';
import { TypingIndicator } from './TypingIndicator.tsx';
import { getThreadWebSocketURL } from '../native/nativeConfig.ts';
import { attachmentUrl } from '../thread/attachmentUrl.ts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ThreadItemBubbleProps {
  item: ThreadItem;
  onCopy: (text: string) => void;
  isRunning?: boolean;
  onRespond?: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function ThreadItemBubble({ item, onCopy, isRunning = false, onRespond }: ThreadItemBubbleProps) {
  switch (item.type) {
    case "tool_call":
      return <ToolCallBubble item={item} onCopy={onCopy} />;
    case "user_message":
      return <UserMessageBubble item={item} onCopy={onCopy} />;
    case "assistant_message":
      if (!item.text && !isRunning) return null;
      return <AssistantMessageBubble item={item} onCopy={onCopy} isRunning={isRunning} onRespond={onRespond} />;
    case "error":
      return <ErrorBubble item={item} />;
  }
}

// ---------------------------------------------------------------------------
// ToolCallBubble
// ---------------------------------------------------------------------------

function ToolCallBubble({ item, onCopy }: { item: ToolCallItem; onCopy: (text: string) => void }) {
  const isToolRunning = item.status === 'running';
  const [isExpanded, setIsExpanded] = useState(isToolRunning);
  const userToggledRef = useRef(false);

  useEffect(() => {
    if (userToggledRef.current) return;
    if (item.status === 'running') {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [item.status]);

  const handleToggle = () => {
    userToggledRef.current = true;
    setIsExpanded((prev) => !prev);
  };

  const handleCopy = () => {
    const text = item.output ?? item.input ?? '';
    navigator.clipboard.writeText(text);
    onCopy(text);
  };

  return (
    <article className="group mx-auto w-full">
      <div className="w-full">
        <div className="rounded-xl bg-app-tool-bubble px-md py-sm">
          {/* Clickable header */}
          <button
            type="button"
            onClick={handleToggle}
            className="flex w-full items-center gap-xs text-left focus:outline-none"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? '收起工具调用详情' : '展开工具调用详情'}
          >
            <ChevronRight
              size={12}
              strokeWidth={1.5}
              className={cn(
                'flex-shrink-0 text-app-text-muted transition-transform duration-200',
                isExpanded && 'rotate-90'
              )}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate font-code text-xs text-app-text-muted">
              [{item.toolName}]
            </span>
            {isToolRunning ? (
              <Loader2
                size={12}
                strokeWidth={1.5}
                className="flex-shrink-0 animate-spin text-app-accent"
                aria-label="运行中"
              />
            ) : (
              <Check
                size={12}
                strokeWidth={1.5}
                className="flex-shrink-0 text-green-500"
                aria-label="已完成"
              />
            )}
          </button>

          {/* Collapsible content */}
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              {item.input !== null && (
                <p className="m-0 mt-xs whitespace-pre-wrap break-words font-code text-[13px] leading-[1.6] text-app-text-muted">
                  {item.input}
                </p>
              )}
              {item.output !== null && (
                <p className="m-0 mt-xs whitespace-pre-wrap break-words font-code text-[13px] leading-[1.6] text-app-text-muted">
                  {item.output}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action bar (visible when expanded) */}
        {isExpanded && (
          <div className="mt-xs flex h-8 items-center gap-xs px-xs">
            <button
              onClick={handleCopy}
              className="flex h-7 w-7 items-center justify-center rounded-md text-app-text-muted transition-colors duration-200 hover:bg-app-surface-muted hover:text-app-text-primary focus:outline-none focus:ring-4 focus:ring-app-accent-ring"
              aria-label="复制消息"
              title="复制"
            >
              <Copy size={14} strokeWidth={1.2} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// UserMessageBubble
// ---------------------------------------------------------------------------

function UserMessageBubble({ item, onCopy }: { item: UserMessageItem; onCopy: (text: string) => void }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(item.text);
    onCopy(item.text);
  };

  const sections = splitUserMessageSections(item.inputItems);

  return (
    <article className="group mx-auto w-full flex justify-end">
      <div className="w-full max-w-[75%]">
        {sections?.images.length ? (
          <div data-testid="user-message-images" className="mb-xs grid justify-items-end gap-xs">
            {sections.images.map((image) => (
              <img
                key={image.id}
                src={image.previewUrl}
                alt="用户上传的图片"
                className="max-h-[240px] max-w-full rounded-2xl border border-app-hairline bg-app-surface-muted object-contain shadow-soft"
              />
            ))}
          </div>
        ) : null}

        <div
          data-testid="user-message-bubble"
          className="rounded-2xl border border-app-hairline/70 bg-app-user-bubble px-lg py-md text-app-text-primary"
        >
          {sections ? (
            <div className="space-y-xs">
              {sections.chips.length > 0 ? (
                <div data-testid="user-message-chips" className="flex flex-wrap gap-xs">
                  {sections.chips.map((chip) => (
                    <span key={chip.id} className="inline-flex rounded-full border border-app-hairline bg-app-surface-muted px-xs py-1 text-sm text-app-text-primary">
                      {chip.type === "skill" ? `Skill · ${chip.label}` : `选区 · ${chip.label}`}
                    </span>
                  ))}
                </div>
              ) : null}
              {sections.text ? (
                <p className="m-0 whitespace-pre-wrap break-words text-[15px] leading-[1.6] text-app-text-primary">
                  {sections.text}
                </p>
              ) : null}
              {sections.pdfs.map((pdf) => (
                <div key={pdf.id} className="rounded-lg border border-app-hairline bg-app-surface-muted px-sm py-xs text-sm">
                  PDF · {pdf.name}
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 whitespace-pre-wrap break-words text-[15px] leading-[1.6] text-app-text-primary">
              {item.text}
            </p>
          )}
          {item.pending && (
            <small className="mt-xs block text-xs text-app-text-secondary">
              待处理
            </small>
          )}
        </div>

        <div className="mt-xs flex h-8 items-center gap-xs px-xs">
          <button
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded-md text-app-text-muted transition-colors duration-200 hover:bg-app-surface-muted hover:text-app-text-primary focus:outline-none focus:ring-4 focus:ring-app-accent-ring"
            aria-label="复制消息"
            title="复制"
          >
            <Copy size={14} strokeWidth={1.2} aria-hidden="true" />
          </button>
          <button
            disabled
            className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-md text-app-text-muted/50"
            title="编辑（即将推出）"
            aria-label="编辑"
          >
            <Pencil size={14} strokeWidth={1.2} aria-hidden="true" />
          </button>
          <button
            disabled
            className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-md text-app-text-muted/50"
            title="重新生成（即将推出）"
            aria-label="重新生成"
          >
            <RefreshCw size={14} strokeWidth={1.2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// AssistantMessageBubble
// ---------------------------------------------------------------------------

function AssistantMessageBubble({ item, onCopy, isRunning, onRespond }: { item: AssistantMessageItem; onCopy: (text: string) => void; isRunning: boolean; onRespond?: (text: string) => void }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(item.text);
    onCopy(item.text);
  };

  return (
    <article className="group mx-auto w-full">
      <div className="w-full">
        <div className="bg-transparent px-lg py-md text-app-text-primary">
          <p className="m-0 whitespace-pre-wrap break-words text-[15px] leading-[1.6] text-app-text-primary">
            {item.text}
          </p>
          {isRunning && <TypingIndicator />}
          {item.awaitingReply && onRespond && !!item.suggestedReplies?.length && (
            <div className="mt-sm flex flex-wrap gap-xs">
              {item.suggestedReplies.map((reply) => (
                <button key={reply} type="button" onClick={() => onRespond(reply)}
                  className="rounded-lg border border-app-hairline bg-app-surface px-sm py-xs text-sm text-app-accent transition-colors hover:bg-app-surface-soft focus:outline-none focus:ring-4 focus:ring-app-accent-ring">
                  {reply}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-xs flex h-8 items-center gap-xs px-xs">
          <button
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded-md text-app-text-muted transition-colors duration-200 hover:bg-app-surface-muted hover:text-app-text-primary focus:outline-none focus:ring-4 focus:ring-app-accent-ring"
            aria-label="复制消息"
            title="复制"
          >
            <Copy size={14} strokeWidth={1.2} aria-hidden="true" />
          </button>
          <button
            disabled
            className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-md text-app-text-muted/50"
            title="编辑（即将推出）"
            aria-label="编辑"
          >
            <Pencil size={14} strokeWidth={1.2} aria-hidden="true" />
          </button>
          <button
            disabled
            className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-md text-app-text-muted/50"
            title="重新生成（即将推出）"
            aria-label="重新生成"
          >
            <RefreshCw size={14} strokeWidth={1.2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// ErrorBubble
// ---------------------------------------------------------------------------

function ErrorBubble({ item }: { item: ErrorItem }) {
  return (
    <article className="group mx-auto w-full">
      <div className="rounded-lg border border-app-error/30 bg-app-error/10 px-md py-sm text-sm text-app-error">
        {item.message}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function splitUserMessageSections(items: InputItem[]): {
  images: Array<{ id: string; previewUrl: string }>;
  pdfs: Array<{ id: string; name: string }>;
  chips: Array<{ id: string; type: "skill" | "text_selection"; label: string }>;
  text: string | null;
} | null {
  if (!items || items.length === 0) {
    return null;
  }

  const images: Array<{ id: string; previewUrl: string }> = [];
  const pdfs: Array<{ id: string; name: string }> = [];
  const chips: Array<{ id: string; type: "skill" | "text_selection"; label: string }> = [];
  const textParts: string[] = [];

  for (const item of items) {
    if (item.type === "image") {
      const url = typeof window === "undefined" ? "ws://127.0.0.1:4317/api/thread" : getThreadWebSocketURL();
      images.push({ id: item.id, previewUrl: attachmentUrl(item, url) });
    } else if (item.type === "pdf") {
      pdfs.push({ id: item.id, name: item.name });
    } else if (item.type === "skill") {
      chips.push({ id: item.id, type: "skill", label: item.title });
    } else if (item.type === "text_selection") {
      chips.push({ id: item.id, type: "text_selection", label: item.text.slice(0, 24) });
    } else if (item.type === "text" && item.text.trim().length > 0) {
      textParts.push(item.text);
    }
  }

  return {
    images,
    pdfs,
    chips,
    text: textParts.length > 0 ? textParts.join("\n\n") : null,
  };
}
