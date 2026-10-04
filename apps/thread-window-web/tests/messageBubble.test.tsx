import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ThreadItemBubble } from "../src/components/ThreadItemBubble.tsx";

describe("ThreadItemBubble", () => {
  it("renders assistant content, suggestions and running placeholders while keeping tool items distinct", () => {
    const renderAssistant = (text: string, extra = {}) => renderToStaticMarkup(React.createElement(ThreadItemBubble, {
      item: { type: "assistant_message", id: "assistant", text }, onCopy: vi.fn(), ...extra,
    }));
    expect(renderAssistant(" \n ")).toBe("");
    expect(renderAssistant("", { isRunning: true })).not.toBe("");
    const respond = vi.fn();
    const suggestions = renderToStaticMarkup(React.createElement(ThreadItemBubble, {
      item: { type: "assistant_message", id: "suggestions", text: "", suggestedReplies: ["进一步读取"], awaitingReply: true },
      onCopy: vi.fn(), onRespond: respond,
    }));
    expect(suggestions).toContain("进一步读取");
    const tool = renderToStaticMarkup(React.createElement(ThreadItemBubble, {
      item: { type: "tool_call", id: "read", toolName: "context_history.sample_details", input: "{}", output: "已读取", status: "completed" }, onCopy: vi.fn(),
    }));
    expect(tool).toContain("context_history.sample_details");
    expect(renderAssistant("已读取桌面上下文")).toContain("已读取桌面上下文");
  });

  it("renders persisted image copies, file names and pending input from the shared history", () => {
    const html = renderToStaticMarkup(React.createElement(ThreadItemBubble, {
      item: { type: "user_message", id: "saved", text: "/tmp/保存的报告.pdf", pending: true, inputItems: [
        { type: "image", id: "image", mimeType: "image/png", blobId: "blob-saved-image" },
        { type: "file_reference", id: "file", name: "保存的报告.pdf", path: "/tmp/保存的报告.pdf" },
        { type: "text", id: "text", text: "讲解一下这个项目" },
        { type: "skill", id: "role", actionId: "initial-role", title: "角色提示", prompt: "根据用户的实际任务提供清晰、可靠的帮助。" },
      ] }, onCopy: vi.fn(),
    }));
    expect(html).toContain('src="http://127.0.0.1:4317/api/blobs/blob-saved-image"');
    expect(html).toContain("保存的报告.pdf");
    expect(html).toContain("待处理");
    expect(html).not.toContain("/tmp/保存的报告.pdf");
    expect(html).not.toContain("base64,undefined");
    expect(html).toContain('data-attachment-type="role_prompt"');
    expect(html).toContain('title="根据用户的实际任务提供清晰、可靠的帮助。"');
    expect(html).toMatch(/<p[^>]*>讲解一下这个项目<\/p>/);
  });

  it("renders user messages as image strip, chip row, and text block based on input items", () => {
    const html = renderToStaticMarkup(
      React.createElement(ThreadItemBubble, {
        item: {
          type: "user_message",
          id: "user-1",
          text: "focus on regressions",
          inputItems: [
            { type: "image", id: "image-1", mimeType: "image/png", base64: "abc" },
            { type: "skill", id: "skill-1", actionId: "review/code", title: "Review", prompt: "Review this code" },
            { type: "text_selection", id: "selection-1", text: "selected code" },
            { type: "text", id: "text-1", text: "focus on regressions" },
          ],
        },
        onCopy: vi.fn(),
      }),
    );

    expect(html).toContain('data-testid="user-message-images"');
    expect(html).toContain('data-testid="user-message-bubble"');
    expect(html).toContain('src="data:image/png;base64,abc"');
    expect(html.indexOf('data-testid="user-message-images"')).toBeLessThan(html.indexOf('data-testid="user-message-bubble"'));
    expect(html).toContain("Skill · Review");
    expect(html).toContain("选区 · selected code");
    expect(html).toContain("focus on regressions");
  });

  it("does not render an empty text block when the user message only has image and chip items", () => {
    const html = renderToStaticMarkup(
      React.createElement(ThreadItemBubble, {
        item: {
          type: "user_message",
          id: "user-2",
          text: "",
          inputItems: [
            { type: "image", id: "image-1", mimeType: "image/png", base64: "abc" },
            { type: "skill", id: "skill-1", actionId: "review/code", title: "Review", prompt: "Review this code" },
          ],
        },
        onCopy: vi.fn(),
      }),
    );

    expect(html).toContain("Skill · Review");
    expect(html).not.toContain(">focus on regressions<");
  });
});
