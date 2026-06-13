import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Composer,
  inputItemsPreview,
  isComposerInputSubmittable,
  normalizeComposerItems,
  removeChipBeforeText,
  removeInputItem,
  toUserInput,
} from "../src/components/Composer.tsx";
import type { InputItem, RuntimeOp } from "../src/protocol/threadProtocol.ts";

const skill: InputItem = {
  type: "skill",
  id: "skill-1",
  actionId: "review",
  title: "Review",
  prompt: "Review this code",
};

describe("Composer input items", () => {
  it("renders controlled prefix chips inside the input box before the editable text item", () => {
    const html = renderToStaticMarkup(
      React.createElement(Composer, {
        disabled: false,
        stopDisabled: true,
        inputItems: [
          skill,
          { type: "image", id: "image-1", mimeType: "image/png", base64: "abc" },
          { type: "text", id: "text-1", text: "focus on regressions" },
        ],
        onInputItemsChange: () => {},
        onSubmit: () => {},
        onStop: () => {},
      }),
    );

    expect(html).toContain('data-composer-chip="true"');
    expect(html).toContain("Skill · Review");
    expect(html).toContain("Image region");
    expect(html.indexOf("Skill · Review")).toBeLessThan(html.indexOf("focus on regressions"));
  });

  it("normalizes input to prefix chips plus exactly one editable text item", () => {
    expect(normalizeComposerItems([
      { type: "text", id: "text-a", text: "hello " },
      skill,
      { type: "text", id: "text-b", text: "world" },
    ])).toEqual([
      skill,
      { type: "text", id: "text-a", text: "hello world" },
    ]);
  });

  it("removes chips directly and via Backspace-at-text-start behavior", () => {
    const items = normalizeComposerItems([
      skill,
      { type: "text_selection", id: "selection-1", text: "selected" },
      { type: "text", id: "text-1", text: "" },
    ]);

    expect(removeInputItem(items, "skill-1").map((item) => item.id)).toEqual([
      "selection-1",
      "text-1",
    ]);
    expect(removeChipBeforeText(items).map((item) => item.id)).toEqual([
      "skill-1",
      "text-1",
    ]);
  });

  it("submits skill-only inputs and keeps the original item array", () => {
    const items = normalizeComposerItems([skill, { type: "text", id: "text-1", text: "" }]);

    expect(isComposerInputSubmittable(items)).toBe(true);
    expect(toUserInput(items)).toEqual({
      items: [skill, { type: "text", id: "text-1", text: "" }],
    });
  });

  it("previews queued skill input by title instead of flattening to prompt text", () => {
    expect(inputItemsPreview({
      op: {
        type: "user_input",
        opId: "op-1",
        timestamp: "2026-06-12T00:00:00.000Z",
        payload: {
          items: [
            skill,
            { type: "text", id: "text-1", text: "with edge cases" },
          ],
        },
      },
    })).toBe("Review with edge cases");
  });

  it("previews queued interrupt ops without requiring UserInput payload items", () => {
    const interruptOp: RuntimeOp = {
      type: "interrupt",
      opId: "op-stop",
      timestamp: "2026-06-12T00:00:01.000Z",
      payload: {
        reason: "user",
      },
    };

    expect(inputItemsPreview(interruptOp)).toBe("停止当前运行");
    expect(inputItemsPreview({ op: interruptOp })).toBe("停止当前运行");
  });
});
