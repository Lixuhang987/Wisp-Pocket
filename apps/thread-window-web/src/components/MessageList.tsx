import type { ThreadItem } from '../store/threadWindowStore.ts';
import { ThreadItemBubble } from './ThreadItemBubble.tsx';

interface MessageListProps {
  items: ThreadItem[];
  errorMessage: string | null;
  isRunning?: boolean; // 是否正在运行
}

export function MessageList({ items, errorMessage, isRunning = false }: MessageListProps) {
  const handleCopy = (text: string) => {
    // 显示复制成功反馈（可选）
    console.log('已复制:', text.slice(0, 50));
  };

  // 找到最后一条 assistant 消息的索引
  const lastAssistantIndex = items.reduce((lastIdx, item, idx) => {
    return item.type === 'assistant_message' ? idx : lastIdx;
  }, -1);

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-sm overflow-y-auto overflow-x-hidden bg-transparent px-lg py-md">
      {items.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <span className="text-sm text-app-text-muted">等待输入</span>
        </div>
      ) : null}

      {/* GPT 风格：消息区域居中，max-width 720pt */}
      <div className="mx-auto min-w-0 w-full max-w-[720pt] space-y-sm">
        {items.map((item, index) => (
          <ThreadItemBubble
            key={item.id}
            item={item}
            onCopy={handleCopy}
            // 只有最后一条 assistant 消息在运行时显示打字指示器
            isRunning={isRunning && item.type === 'assistant_message' && index === lastAssistantIndex}
          />
        ))}

        {errorMessage && (
          <div className="rounded-lg border border-app-error/30 bg-app-error/10 px-md py-sm text-sm text-app-error">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
