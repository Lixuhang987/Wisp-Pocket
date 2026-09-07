import { useEffect, useMemo, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ArrowUp, Plus, Square, Trash2 } from 'lucide-react';
import type { AvailableSkill, InputItem, RuntimeOp, UserInput } from '../protocol/threadProtocol.ts';
import type { QueuedComposerInput } from '../store/threadWindowStore.ts';
import { cn } from '../utils/cn.ts';

interface ComposerProps {
  disabled: boolean;
  stopDisabled: boolean;
  queuedInputs?: QueuedComposerInput[];
  availableSkills?: AvailableSkill[];
  inputItems: InputItem[];
  onInputItemsChange: (items: InputItem[]) => void;
  onSubmit: (input: UserInput) => void;
  onStop: () => void;
  onRemoveQueuedInput?: (index: number) => void;
}

const MAX_ROWS = 5;
const LINE_HEIGHT = 24;
export const SLASH_MENU_COLLISION_PADDING = 8;
export const SLASH_MENU_CONTENT_STYLE: React.CSSProperties = {
  width: 'var(--radix-popover-trigger-width)',
  maxHeight: 'min(320px, var(--radix-popover-content-available-height))',
};

export function Composer({
  disabled,
  stopDisabled,
  queuedInputs = [],
  availableSkills = [],
  inputItems,
  onInputItemsChange,
  onSubmit,
  onStop,
  onRemoveQueuedInput,
}: ComposerProps) {
  const items = useMemo(() => normalizeComposerItems(inputItems), [inputItems]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textItem = useMemo(() => getEditableTextItem(items), [items]);
  const chipItems = items.filter((item) => item.type !== "text");
  const slashState = useMemo(() => getSlashMenuState(textItem.text, availableSkills), [textItem.text, availableSkills]);

  const [highlightedIndex, setHighlightedIndex] = useState(0);
  useEffect(() => {
    setHighlightedIndex(0);
  }, [slashState.query, slashState.filteredSkills.length]);
  const activeSkill = slashState.filteredSkills[highlightedIndex] ?? slashState.filteredSkills[0] ?? null;

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    onInputItemsChange(updateEditableText(items, target.value));

    // 自动调整高度
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, MAX_ROWS * LINE_HEIGHT)}px`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isComposerInputSubmittable(items) || disabled) return;

    onSubmit(toUserInput(items));
    onInputItemsChange(createEmptyComposerItems());

    // 重置高度
    if (textareaRef.current) {
      textareaRef.current.style.height = '52px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slashState.visible) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, slashState.filteredSkills.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onInputItemsChange(updateEditableText(items, ''));
        return;
      }
      if (e.key === "Tab" && activeSkill) {
        e.preventDefault();
        onInputItemsChange(selectSlashSkill(items, activeSkill));
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
      return;
    }
    if (
      e.key === "Backspace"
      && e.currentTarget instanceof HTMLTextAreaElement
      && e.currentTarget.selectionStart === 0
      && e.currentTarget.selectionEnd === 0
      && textItem.text.length === 0
    ) {
      const nextItems = removeChipBeforeText(items);
      if (nextItems !== items) {
        e.preventDefault();
        onInputItemsChange(nextItems);
      }
    }
  };

  const isRunning = !stopDisabled;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-w-0 flex-col items-center justify-end overflow-hidden bg-app-canvas/85 px-lg py-md"
    >
      {queuedInputs.length > 0 ? (
        <div
          data-queued-composer-panel="true"
          className="mb-xs max-h-[156px] min-w-0 w-full max-w-[720pt] overflow-y-auto rounded-2xl border border-app-hairline bg-app-surface-elevated/95 px-xs py-xs shadow-[var(--thread-window-floating-shadow)]"
        >
          <div className="space-y-1">
            {queuedInputs.map((queuedInput, index) => {
              const queuedText = inputItemsPreview(queuedInput.op);
              return (
              <div
                key={`${index}-${queuedText}`}
                data-queued-composer-item="true"
                className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-xs rounded-xl px-xs py-1 text-sm text-app-text-muted transition-colors duration-200 hover:bg-app-surface-muted/60"
              >
                <span className="font-code text-xs text-app-text-muted/70">↳</span>
                <span className="truncate text-app-text-primary" title={queuedText}>
                  {queuedText}
                </span>
                <span className="whitespace-nowrap text-xs text-app-text-muted">待发送</span>
                <button
                  type="button"
                  aria-label={`移除排队输入 ${index + 1}`}
                  onClick={() => onRemoveQueuedInput?.(index)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-app-text-muted transition-colors duration-200 hover:bg-app-surface-muted hover:text-app-text-primary focus:outline-none focus:ring-4 focus:ring-app-accent-ring"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <Popover.Root
        open={slashState.visible}
        onOpenChange={(open) => {
          if (!open) {
            onInputItemsChange(updateEditableText(items, ''));
          }
        }}
      >
        <Popover.Anchor className="mx-auto min-w-0 block w-full max-w-[720pt]">
          <div
            data-composer-input-box="true"
            className="rounded-3xl border border-app-hairline bg-app-surface-elevated/98 px-md py-xs shadow-[var(--thread-window-floating-shadow),var(--thread-window-inset-line)] transition-shadow duration-200 focus-within:border-app-accent focus-within:ring-4 focus-within:ring-app-accent-ring"
          >
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-xs">
            <div className="flex min-w-0 flex-wrap items-center gap-xs py-xs">
              {chipItems.map((item) => {
                const label = chipLabel(item);
                return (
                  <span
                    key={item.id}
                    data-composer-chip="true"
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-app-hairline bg-app-surface-muted px-xs py-1 text-sm text-app-text-primary"
                  >
                    <span className="truncate">{label}</span>
                    <button
                      type="button"
                      aria-label={`移除 ${label}`}
                      onClick={() => onInputItemsChange(removeInputItem(items, item.id))}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-app-text-muted transition-colors hover:bg-app-surface-soft hover:text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent-ring"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              <textarea
                ref={textareaRef}
                value={textItem.text}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={chipItems.length > 0 ? "" : "Ask Wisp Pocket"}
                disabled={disabled}
                className="min-h-[52px] min-w-[180px] flex-1 resize-none overflow-y-auto overflow-x-hidden bg-transparent px-xs py-xs text-[16px] leading-[1.5] text-app-text-primary placeholder:text-app-text-muted outline-none disabled:cursor-not-allowed disabled:text-app-text-muted/50"
                style={{ minHeight: '52px', maxHeight: `${MAX_ROWS * LINE_HEIGHT}px` }}
              />
            </div>

            {/* 右侧按钮区域 */}
            <div className="flex flex-shrink-0 items-center gap-xs pb-xs">
              {/* 附件按钮 - 占位 */}
              <button
                type="button"
                disabled
                className="flex h-8 w-8 items-center justify-center rounded-xl text-app-text-muted transition-colors duration-200 hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                title="附件（即将推出）"
              >
                <Plus size={20} strokeWidth={2} />
              </button>

              {isRunning ? (
                <button
                  type="button"
                  onClick={onStop}
                  disabled={stopDisabled}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-app-accent text-app-on-accent transition-colors duration-200 hover:bg-app-accent-hover focus:outline-none focus:ring-4 focus:ring-app-accent-ring disabled:cursor-not-allowed disabled:bg-app-surface-muted disabled:text-app-text-secondary"
                  title="停止"
                >
                  <Square size={12} fill="currentColor" />
                </button>
              ) : null}
              <button
                type="submit"
                disabled={disabled || !isComposerInputSubmittable(items)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-app-accent text-app-on-accent transition-colors duration-200 hover:bg-app-accent-hover focus:outline-none focus:ring-4 focus:ring-app-accent-ring disabled:cursor-not-allowed disabled:bg-app-surface-muted disabled:text-app-text-muted"
                title="发送"
              >
                <ArrowUp size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
          </div>
        </Popover.Anchor>

        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={4}
            collisionPadding={SLASH_MENU_COLLISION_PADDING}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            data-slash-menu="true"
            className="z-20 min-w-0 overflow-y-auto rounded-2xl border border-app-hairline bg-app-surface-elevated/98 p-xs text-sm text-app-text-primary shadow-[var(--thread-window-floating-shadow)]"
            style={SLASH_MENU_CONTENT_STYLE}
          >
            <div className="mb-1 px-xs text-xs font-medium text-app-text-muted">技能</div>
            {slashState.filteredSkills.length > 0 ? (
              <div className="space-y-1" role="listbox" aria-label="技能">
                {slashState.filteredSkills.map((skill, index) => (
                  <div
                    key={skill.actionId}
                    data-slash-skill={skill.actionId}
                    role="option"
                    aria-selected={index === highlightedIndex}
                    className={cn(
                      "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-xs rounded-xl px-sm py-xs",
                      index === highlightedIndex ? "bg-app-surface-muted text-app-text-primary" : "text-app-text-secondary",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-medium">{skill.title}</div>
                      <div className="truncate text-xs text-app-text-muted">{skill.description ?? skill.prompt}</div>
                    </div>
                    <span className="text-xs text-app-text-muted">Tab</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl px-sm py-xs text-sm text-app-text-muted">没有匹配的技能</div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </form>
  );
}

export function inputItemsPreview(input: QueuedComposerInput | UserInput | InputItem[] | RuntimeOp): string {
  if (!Array.isArray(input) && "op" in input) {
    return inputItemsPreview(input.op);
  }

  if (!Array.isArray(input) && "type" in input && input.type === "interrupt") {
    return "停止当前运行";
  }

  const items = Array.isArray(input)
    ? input
    : "items" in input
      ? input.items
      : input.payload.items;

  const parts = items.map((item) => {
    switch (item.type) {
      case "text":
        return item.text;
      case "text_selection":
        return item.text;
      case "skill":
        return item.title || item.prompt;
      case "image":
        return "图片附件";
    }
  }).filter((part) => part.length > 0);

  return parts.join(" ") || "后续输入";
}

export function createEmptyComposerItems(): InputItem[] {
  return [{ type: "text", id: newId("text"), text: "" }];
}

export function normalizeComposerItems(inputItems: InputItem[] | undefined): InputItem[] {
  if (!inputItems || inputItems.length === 0) {
    return createEmptyComposerItems();
  }
  const textItems = inputItems.filter((item) => item.type === "text");
  const text = textItems.map((item) => item.text).join("");
  const textId = textItems[0]?.id ?? newId("text");
  const chips = inputItems.filter((item) => item.type !== "text");
  return [...chips, { type: "text", id: textId, text }];
}

export function updateEditableText(inputItems: InputItem[], text: string): InputItem[] {
  const normalized = normalizeComposerItems(inputItems);
  return normalized.map((item) => item.type === "text" ? { ...item, text } : item);
}

export function removeInputItem(inputItems: InputItem[], itemId: string): InputItem[] {
  return normalizeComposerItems(inputItems).filter((item) => item.id !== itemId || item.type === "text");
}

export function removeChipBeforeText(inputItems: InputItem[]): InputItem[] {
  const normalized = normalizeComposerItems(inputItems);
  const textIndex = normalized.findIndex((item) => item.type === "text");
  const removeIndex = textIndex - 1;
  if (removeIndex < 0) return inputItems;
  return normalized.filter((_, index) => index !== removeIndex);
}

export function isComposerInputSubmittable(inputItems: InputItem[]): boolean {
  return normalizeComposerItems(inputItems).some((item) => {
    if (item.type === "text") return item.text.trim().length > 0;
    if (item.type === "text_selection") return item.text.trim().length > 0;
    if (item.type === "skill") return item.prompt.trim().length > 0;
    return item.base64.length > 0;
  });
}

export function toUserInput(inputItems: InputItem[]): UserInput {
  return { items: structuredClone(normalizeComposerItems(inputItems)) };
}

export function getSlashMenuState(text: string, availableSkills: AvailableSkill[]): {
  visible: boolean;
  query: string;
  filteredSkills: AvailableSkill[];
  highlightedSkill: AvailableSkill | null;
} {
  if (!text.startsWith("/")) {
    return { visible: false, query: "", filteredSkills: [], highlightedSkill: null };
  }

  const query = text.slice(1).trim().toLowerCase();
  const filteredSkills = availableSkills.filter((skill) => {
    if (query.length === 0) {
      return true;
    }
    return skill.title.toLowerCase().includes(query)
      || skill.actionId.toLowerCase().includes(query)
      || skill.prompt.toLowerCase().includes(query)
      || (skill.description?.toLowerCase().includes(query) ?? false);
  });

  return {
    visible: true,
    query,
    filteredSkills,
    highlightedSkill: filteredSkills[0] ?? null,
  };
}

export function selectSlashSkill(inputItems: InputItem[], skill: AvailableSkill): InputItem[] {
  const normalized = normalizeComposerItems(inputItems);
  const textItem = getEditableTextItem(normalized);
  const chips = normalized.filter((item) => item.type !== "text");
  return [
    ...chips,
    {
      type: "skill",
      id: newId("skill"),
      actionId: skill.actionId,
      title: skill.title,
      prompt: skill.prompt,
    },
    { ...textItem, text: "" },
  ];
}

function getEditableTextItem(inputItems: InputItem[]): Extract<InputItem, { type: "text" }> {
  return normalizeComposerItems(inputItems).find((item): item is Extract<InputItem, { type: "text" }> => item.type === "text")!;
}

function chipLabel(item: Exclude<InputItem, { type: "text" }>): string {
  switch (item.type) {
    case "skill":
      return `Skill · ${item.title || item.actionId}`;
    case "image":
      return "Image region";
    case "text_selection":
      return "Text selection";
  }
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
