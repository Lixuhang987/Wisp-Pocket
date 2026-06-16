import { Copy } from 'lucide-react';
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

  return (
    <article
      className={cn(
        'group mx-auto w-full',
        isUser && 'flex justify-end'
      )}
    >
      <div className={cn(
        'w-full',
        isUser && 'max-w-[85%]'
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
            isUser && 'rounded-2xl border border-app-hairline/70 bg-app-user-bubble text-app-text-primary shadow-soft',
            isAssistant && 'bg-transparent text-app-text-primary',
            isTool && 'rounded-xl border border-app-hairline bg-app-tool-bubble/70 text-app-text-muted shadow-product-inner'
          )}
        >
          {message.toolName && (
            <div
              className={cn(
                'mb-xs font-code text-xs',
                isTool ? 'text-app-text-muted' : 'text-app-text-secondary'
              )}
            >
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
                'm-0 whitespace-pre-wrap break-words leading-[1.6]',
                isTool ? 'font-code text-[13px]' : 'text-[15px]',
                isAssistant && 'text-app-text-primary',
                isUser && 'text-app-text-primary',
                isTool && 'text-app-text-muted'
              )}
            >
              {message.text}
            </p>
          )}
          {message.pending && (
            <small
              className={cn(
                'mt-xs block text-xs',
                isTool ? 'text-app-text-muted' : 'text-app-text-secondary'
              )}
            >
              处理中...
            </small>
          )}

          {/* GPT 风格：assistant 消息运行时显示打字指示器 */}
          {isAssistant && isRunning && <TypingIndicator />}
        </div>

        <div
          className={cn(
            'mt-xs flex h-8 items-center gap-xs px-xs opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100',
            isUser && 'opacity-100'
          )}
        >
          <button
            onClick={handleCopy}
            className="flex h-7 items-center gap-1 rounded-md px-xs text-xs text-app-text-muted transition-colors duration-200 hover:bg-app-surface-muted hover:text-app-text-primary focus:outline-none focus:ring-4 focus:ring-app-accent-ring"
            aria-label="复制消息"
          >
            <Copy size={14} strokeWidth={1.2} aria-hidden="true" />
            <span>复制</span>
          </button>

          <button
            disabled
            className="h-7 cursor-not-allowed rounded-md px-xs text-xs text-app-text-muted/50"
            title="即将推出"
          >
            编辑
          </button>
          <button
            disabled
            className="h-7 cursor-not-allowed rounded-md px-xs text-xs text-app-text-muted/50"
            title="即将推出"
          >
            重新生成
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
