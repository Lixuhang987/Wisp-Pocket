import { describe, expect, it } from "vitest";
import type { AgentTool } from "../../src/tools/AgentTool.ts";
import {
  registerTools,
  type RegisterToolsOptions,
} from "../../src/tools/registerTools.ts";

describe("registerTools", () => {
  it("ignores extra external loader options while registering builtin tools", async () => {
    const externalLoaderOption = "external" + "Loaders";
    const externalToolName = "external" + ".echo";
    const options = {
      [externalLoaderOption]: [
        async () => ({
          tools: [makeTool(externalToolName)],
          disabled: [],
        }),
      ],
    } as unknown as RegisterToolsOptions;

    const result = await registerTools(options);

    expect(result.registered).not.toContain(externalToolName);
    expect(result.registry.get(externalToolName)).toBeUndefined();
  });
});

function makeTool(name: string): AgentTool {
  return {
    name,
    description: name,
    inputSchema: { type: "object" },
    async call() {
      return {};
    },
  };
}
