import { describe, expect, it } from "vitest";
import {
  normalizeSelectedText,
  selectionResultFromText,
  type SelectionCapture,
  type SelectionCaptureResult,
} from "../../src/selection/SelectionCapture";

class FakeSelectionCapture implements SelectionCapture {
  constructor(private readonly value: SelectionCaptureResult) {}

  async captureSelectedText(): Promise<SelectionCaptureResult> {
    return this.value;
  }
}

describe("selection capture", () => {
  it("normalizes empty selections to null", () => {
    expect(normalizeSelectedText("")).toBeNull();
    expect(normalizeSelectedText("   ")).toBeNull();
    expect(normalizeSelectedText("a\r\nb")).toBe("a\nb");
  });

  it("maps selected text into a selected result", () => {
    expect(selectionResultFromText("用户刚刚选中的文本")).toEqual({
      kind: "selected",
      text: "用户刚刚选中的文本",
    });
  });

  it("maps empty selections into an empty result", () => {
    expect(selectionResultFromText("   ")).toEqual({
      kind: "empty",
    });
  });

  it("captures selected text through the interface", async () => {
    const capture = new FakeSelectionCapture({
      kind: "selected",
      text: "用户刚刚选中的文本",
    });

    await expect(capture.captureSelectedText()).resolves.toEqual({
      kind: "selected",
      text: "用户刚刚选中的文本",
    });
  });

});
