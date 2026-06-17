export type OpenHistoryThreadDeps = {
  ensureThreadState(threadId: string): void;
  setActiveThreadId(threadId: string): void;
  resumeThread(threadId: string): void;
};

export function openHistoryThread(
  threadId: string,
  deps: OpenHistoryThreadDeps,
): void {
  deps.ensureThreadState(threadId);
  deps.setActiveThreadId(threadId);
  deps.resumeThread(threadId);
}
