import type { KeyboardEvent } from "react";
import type { ThreadListEntry } from "../protocol/threadProtocol.ts";
import { createThreadWindowStore } from "../store/threadWindowStore.ts";
import { cn } from "../utils/cn.ts";

interface ThreadItemProps {
  thread: ThreadListEntry;
  isActive: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

export function ThreadItem({ thread, isActive, onOpen, onDelete }: ThreadItemProps) {
  const threadsById = createThreadWindowStore((state) => state.threadsById);
  const threadState = threadsById[thread.id];
  const isRunning = threadState?.status === "running";

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isActive ? "page" : undefined}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex items-center gap-xs rounded-lg px-sm py-1.5 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-app-accent-ring",
        isActive
          ? "bg-app-accent-subtle text-app-text-primary"
          : "hover:bg-app-surface-soft/80",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-[13px] font-medium text-app-text-primary">
            {thread.preview || "新对话"}
          </span>
          <span className="flex-shrink-0 text-[10px] text-app-text-secondary">
            {formatRelativeTime(new Date(thread.updatedAt))}
          </span>
        </div>
      </div>

      {isRunning && <RunningThreadIcon />}

      <button
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-app-text-secondary opacity-0 transition-all duration-200 group-hover:opacity-70 hover:!opacity-100 hover:bg-app-surface-muted hover:text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent-ring"
        aria-label="删除对话"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
          <path
            d="M3 3L11 11M11 3L3 11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

function RunningThreadIcon() {
  return (
    <span
      className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center text-app-accent"
      aria-label="运行中"
      title="运行中"
    >
      <span className="absolute h-3 w-3 animate-ping rounded-full bg-app-accent/30" />
      <span className="h-2 w-2 rounded-full bg-app-accent" />
    </span>
  );
}

function formatRelativeTime(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) {
    return "刚刚";
  }
  if (diffHours < 24) {
    return `${diffHours}小时`;
  }
  if (diffDays < 7) {
    return `${diffDays}天`;
  }
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}
