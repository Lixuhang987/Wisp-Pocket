import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAvailableSkills, installInitialPromptReceiver } from "../src/native/nativeConfig.ts";

describe("nativeConfig", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function nativeWindow() {
    return window as typeof window & {
      handAgentThreadWindowConfig?: {
        threadWebSocketURL?: string;
        availableSkills?: Array<{
          actionId: string;
          title: string;
          prompt: string;
          description?: string;
        }>;
      };
      handAgentPendingInitialPrompts?: Array<{
        clientRequestId: string;
        userInput: {
          items: Array<{ type: "text"; id: string; text: string }>;
        };
      }>;
    };
  }

  it("flushes initial prompts queued before React installs the receiver", () => {
    nativeWindow().handAgentPendingInitialPrompts = [{
      clientRequestId: "prompt-1",
      userInput: {
        items: [{ type: "text", id: "text-1", text: "hello" }],
      },
    }];
    const received: string[] = [];

    installInitialPromptReceiver((payload) => {
      received.push(payload.userInput.items[0]?.type === "text" ? payload.userInput.items[0].text : "");
    });

    expect(received).toEqual(["hello"]);
    expect(nativeWindow().handAgentPendingInitialPrompts).toEqual([]);
  });

  it("reads available skills from host config", () => {
    const original = [
      { actionId: "review/code", title: "Review", prompt: "Review this code" },
      { actionId: "bad", title: "Bad", prompt: 123 as never },
    ];
    nativeWindow().handAgentThreadWindowConfig = { availableSkills: original };

    const skills = getAvailableSkills();
    expect(skills).toEqual([
      { actionId: "review/code", title: "Review", prompt: "Review this code" },
    ]);
    expect(skills).not.toBe(original);
  });
});
