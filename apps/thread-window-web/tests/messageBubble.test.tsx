import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MessageBubble } from "../src/components/MessageBubble.tsx";

describe("MessageBubble", () => {
  it("renders user messages as image strip, chip row, and text block based on input items", () => {
    const html = renderToStaticMarkup(
      React.createElement(MessageBubble, {
        message: {
          id: "user-1",
          role: "user",
          text: "focus on regressions",
          userInputItems: [
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
      React.createElement(MessageBubble, {
        message: {
          id: "user-2",
          role: "user",
          text: "",
          userInputItems: [
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
