import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Copy, Loader2, Pencil, RefreshCw } from 'lucide-react';
import type { ThreadMessage } from '../store/threadWindowStore.ts';
import { cn } from '../utils/cn.ts';
import { TypingIndicator } from './TypingIndicator.tsx';

interface MessageBubbleProps {
  message: ThreadMessage;
  onCopy: (text: string) => void;
  isRunning?: boolean; // 是否正在运行（用于显示打字指示器）
}

export function MessageBubble({ message, onCopy, isRunning = false }: MessageBubbleProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    onCopy(message.text);
  };

  // GPT 风格：assistant 消息透明无背景，user 消息右对齐带背景
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isTool = message.role === 'tool';
  const userSections = isUser ? splitUserMessageSections(message.userInputItems ?? []) : null;

  // Tool 消息展开/收起状态
  const isToolRunning = isTool && message.status === 'running';
  const [isToolExpanded, setIsToolExpanded] = useState(isToolRunning);
  // 追踪用户是否手动操作过，避免自动收起覆盖用户意图
  const userToggledRef = useRef(false);

  useEffect(() => {
    if (!isTool) return;
    if (userToggledRef.current) return; // 用户手动操作过，不再自动切换
    if (message.status === 'running') {
      setIsToolExpanded(true);
    } else {
      setIsToolExpanded(false);
    }
  }, [isTool, message.status]);

  const handleToolToggle = () => {
    userToggledRef.current = true;
    setIsToolExpanded((prev) => !prev);
  };

  // Tool 消息使用独立的紧凑布局
  if (isTool) {
    return (
      <article className="group mx-auto w-full">
        <div className="w-full">
          <div className="rounded-xl bg-app-tool-bubble px-md py-sm">
            {/* 可点击的 header */}
            <button
              type="button"
              onClick={handleToolToggle}
              className="flex w-full items-center gap-xs text-left focus:outline-none"
              aria-expanded={isToolExpanded}
              aria-label={isToolExpanded ? '收起工具调用详情' : '展开工具调用详情'}
            >
              <ChevronRight
                size={12}
                strokeWidth={1.5}
                className={cn(
                  'flex-shrink-0 text-app-text-muted transition-transform duration-200',
                  isToolExpanded && 'rotate-90'
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate font-code text-xs text-app-text-muted">
                [{message.toolName}]
              </span>
              {/* 状态指示器 */}
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

            {/* 可折叠内容区 */}
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: isToolExpanded ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="m-0 mt-xs whitespace-pre-wrap break-words font-code text-[13px] leading-[1.6] text-app-text-muted">
                  {message.text}
                </p>
              </div>
            </div>
          </div>

          {/* 展开时显示操作栏 */}
          {isToolExpanded && (
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

  return (
    <article
      className={cn(
        'group mx-auto w-full',
        isUser && 'flex justify-end'
      )}
    >
      <div className={cn(
        'w-full',
        isUser && 'max-w-[75%]'
      )}>
        {isUser && userSections?.images.length ? (
          <div data-testid="user-message-images" className="mb-xs grid justify-items-end gap-xs">
            {userSections.images.map((image) => (
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
          data-testid={isUser ? "user-message-bubble" : undefined}
          className={cn(
            'px-lg py-md',
            isUser && 'rounded-2xl border border-app-hairline/70 bg-app-user-bubble text-app-text-primary',
            isAssistant && 'bg-transparent text-app-text-primary',
          )}
        >
          {message.toolName && (
            <div className="mb-xs font-code text-xs text-app-text-secondary">
              [{message.toolName}]
            </div>
          )}
          {isUser && userSections ? (
            <div className="space-y-xs">
              {userSections.chips.length > 0 ? (
                <div data-testid="user-message-chips" className="flex flex-wrap gap-xs">
                  {userSections.chips.map((chip) => (
                    <span key={chip.id} className="inline-flex rounded-full border border-app-hairline bg-app-surface-muted px-xs py-1 text-sm text-app-text-primary">
                      {chip.type === "skill" ? `Skill · ${chip.label}` : `选区 · ${chip.label}`}
                    </span>
                  ))}
                </div>
              ) : null}
              {userSections.text ? (
                <p
                  className={cn(
                    'm-0 whitespace-pre-wrap break-words leading-[1.6] text-[15px] text-app-text-primary',
                  )}
                >
                  {userSections.text}
                </p>
              ) : null}
            </div>
          ) : (
            <p
              className={cn(
                'm-0 whitespace-pre-wrap break-words leading-[1.6] text-[15px]',
                isAssistant && 'text-app-text-primary',
                isUser && 'text-app-text-primary',
              )}
            >
              {message.text}
            </p>
          )}
          {message.pending && (
            <small className="mt-xs block text-xs text-app-text-secondary">
              处理中...
            </small>
          )}

          {/* GPT 风格：assistant 消息运行时显示打字指示器 */}
          {isAssistant && isRunning && <TypingIndicator />}
        </div>

        <div
          className="mt-xs flex h-8 items-center gap-xs px-xs"
        >
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

function splitUserMessageSections(items: ThreadMessage["userInputItems"]): {
  images: Array<{ id: string; previewUrl: string }>;
  chips: Array<{ id: string; type: "skill" | "text_selection"; label: string }>;
  text: string | null;
} | null {
  if (!items || items.length === 0) {
    return null;
  }

  const images: Array<{ id: string; previewUrl: string }> = [];
  const chips: Array<{ id: string; type: "skill" | "text_selection"; label: string }> = [];
  const textParts: string[] = [];

  for (const item of items) {
    if (item.type === "image") {
      images.push({ id: item.id, previewUrl: `data:${item.mimeType};base64,${item.base64}` });
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
    chips,
    text: textParts.length > 0 ? textParts.join("\n\n") : null,
  };
}
