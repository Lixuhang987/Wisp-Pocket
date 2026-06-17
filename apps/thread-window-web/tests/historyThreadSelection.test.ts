import { describe, expect, it, vi } from "vitest";
import { openHistoryThread } from "../src/history/openHistoryThread.ts";

describe("openHistoryThread", () => {
  it("hydrates the target thread, switches the right pane, and resumes the snapshot in order", () => {
    const calls: Array<[string, string]> = [];
    const deps = {
      ensureThreadState: vi.fn((threadId: string) => {
        calls.push(["ensureThreadState", threadId]);
      }),
      setActiveThreadId: vi.fn((threadId: string) => {
        calls.push(["setActiveThreadId", threadId]);
      }),
      resumeThread: vi.fn((threadId: string) => {
        calls.push(["resumeThread", threadId]);
      }),
    };

    openHistoryThread("thread-history-1", deps);

    expect(calls).toEqual([
      ["ensureThreadState", "thread-history-1"],
      ["setActiveThreadId", "thread-history-1"],
      ["resumeThread", "thread-history-1"],
    ]);
  });

  it("passes the selected thread id through every recovery step unchanged", () => {
    const deps = {
      ensureThreadState: vi.fn(),
      setActiveThreadId: vi.fn(),
      resumeThread: vi.fn(),
    };

    openHistoryThread("thread-aa3a9918-1349-469c-874b-0e36924531ab", deps);

    expect(deps.ensureThreadState).toHaveBeenCalledWith("thread-aa3a9918-1349-469c-874b-0e36924531ab");
    expect(deps.setActiveThreadId).toHaveBeenCalledWith("thread-aa3a9918-1349-469c-874b-0e36924531ab");
    expect(deps.resumeThread).toHaveBeenCalledWith("thread-aa3a9918-1349-469c-874b-0e36924531ab");
  });
});
