import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ThreadItemBubble } from "../src/components/ThreadItemBubble.tsx";

describe("ThreadItemBubble", () => {
  it("renders persisted image copies, file names and pending input from the shared history", () => {
    const html = renderToStaticMarkup(React.createElement(ThreadItemBubble, {
      item: { type: "user_message", id: "saved", text: "/tmp/保存的报告.pdf", pending: true, inputItems: [
        { type: "image", id: "image", mimeType: "image/png", blobId: "blob-saved-image" },
        { type: "file_reference", id: "file", name: "保存的报告.pdf", path: "/tmp/保存的报告.pdf" },
      ] }, onCopy: vi.fn(),
    }));
    expect(html).toContain('src="http://127.0.0.1:4317/api/blobs/blob-saved-image"');
    expect(html).toContain("保存的报告.pdf");
    expect(html).toContain("待处理");
    expect(html).not.toContain("/tmp/保存的报告.pdf");
    expect(html).not.toContain("base64,undefined");
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
