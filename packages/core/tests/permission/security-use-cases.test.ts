import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FilePermissionPolicy } from "../../src/permission/FilePermissionPolicy.ts";
import { AgentRuntime, type AgentRuntimeEvent } from "../../src/runtime/AgentRuntime";
import { ToolRegistry } from "../../src/tools/ToolRegistry";
import type { AgentTool } from "../../src/tools/AgentTool";
import type { AgentMessage } from "../../src/runtime/AgentMessage";
import type {
  PermissionPolicy,
  PermissionResolution,
} from "../../src/permission/PermissionPolicy";
import { DENY_TOOL_RESULT_TEXT } from "../../src/permission/PermissionPolicy";

describe("FilePermissionPolicy", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "perm-policy-"));
    filePath = join(dir, "permissions.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function requestFor(relativePath: string) {
    return {
      toolName: "file.write",
      arguments: { workspaceId: "default", relativePath },
      toolCallId: `tc-${relativePath}`,
    };
  }

  it("returns ask when no rule exists", async () => {
    const policy = new FilePermissionPolicy({ filePath });
    const decision = await policy.check({
      toolName: "file.write",
      arguments: { workspaceId: "default", relativePath: "x.md" },
      toolCallId: "tc-1",
    });
    expect(decision).toBe("ask");
  });

  it("thread-scope rule survives within instance but not across instances", async () => {
    const policy = new FilePermissionPolicy({ filePath });
    const req = {
      toolName: "file.write",
      arguments: { workspaceId: "default", relativePath: "x.md" },
      toolCallId: "tc-1",
    };
    await policy.remember(req, { decision: "allow", remember: "thread" });

    expect(await policy.check(req)).toBe("allow");

    const fresh = new FilePermissionPolicy({ filePath });
    expect(await fresh.check(req)).toBe("ask");
  });

  it("always-scope rule persists across instances and matches stable arg hash", async () => {
    const policy = new FilePermissionPolicy({ filePath });
    const req = {
      toolName: "file.write",
      arguments: { workspaceId: "default", relativePath: "x.md" },
      toolCallId: "tc-1",
    };
    await policy.remember(req, { decision: "allow", remember: "always" });

    const fresh = new FilePermissionPolicy({ filePath });
    expect(await fresh.check(req)).toBe("allow");
    expect(
      await fresh.check({
        ...req,
        arguments: { relativePath: "x.md", workspaceId: "default" },
      }),
    ).toBe("allow");
    expect(fresh.listPersistedRules()[0].arguments).toEqual({
      workspaceId: "default",
      relativePath: "x.md",
    });
  });

  it("does not reuse file tool allow rules for separate tool names with the same arguments", async () => {
    const policy = new FilePermissionPolicy({ filePath });
    const args = { workspaceId: "default", relativePath: "x.md" };
    const otherToolName = "external" + ".writer";
    await policy.remember(
      {
        toolName: "file.write",
        arguments: args,
        toolCallId: "tc-file",
      },
      { decision: "allow", remember: "always" },
    );

    expect(
      await policy.check({
        toolName: otherToolName,
        arguments: args,
        toolCallId: "tc-external",
      }),
    ).toBe("ask");
  });

  it("once-scope rule is not remembered", async () => {
    const policy = new FilePermissionPolicy({ filePath });
    const req = {
      toolName: "file.write",
      arguments: { workspaceId: "default" },
      toolCallId: "tc-1",
    };
    await policy.remember(req, { decision: "allow", remember: "once" });
    expect(await policy.check(req)).toBe("ask");
  });

  it("revoke removes a persisted rule", async () => {
    const policy = new FilePermissionPolicy({ filePath });
    const req = {
      toolName: "file.write",
      arguments: { workspaceId: "default" },
      toolCallId: "tc-1",
    };
    await policy.remember(req, { decision: "deny", remember: "always" });

    const rules = policy.listPersistedRules();
    expect(rules).toHaveLength(1);

    await policy.revoke(rules[0].argHash);
    expect(policy.listPersistedRules()).toHaveLength(0);
  });

  it("resolveAsk delegates to provided askResolver", async () => {
    const policy = new FilePermissionPolicy({
      filePath,
      askResolver: async () => ({ decision: "deny", reason: "user clicked deny" }),
    });
    const resolution = await policy.resolveAsk({
      toolName: "x",
      arguments: {},
      toolCallId: "tc-1",
    });
    expect(resolution).toEqual({ decision: "deny", reason: "user clicked deny" });
  });

  it("thread-scope rules are isolated by threadId", async () => {
    const policy = new FilePermissionPolicy({ filePath });
    const baseArgs = { workspaceId: "default", relativePath: "secret.md" };

    const reqA = {
      toolName: "file.write",
      arguments: baseArgs,
      threadId: "thread-A",
      toolCallId: "tc-a",
    };
    const reqB = {
      toolName: "file.write",
      arguments: baseArgs,
      threadId: "thread-B",
      toolCallId: "tc-b",
    };

    await policy.remember(reqA, { decision: "allow", remember: "thread" });

    expect(await policy.check(reqA)).toBe("allow");
    expect(await policy.check(reqB)).toBe("ask");
  });

  it("clearThreadRules removes only rules for the given threadId", async () => {
    const policy = new FilePermissionPolicy({ filePath });
    const baseArgs = { workspaceId: "default", relativePath: "x.md" };

    const reqA = {
      toolName: "file.write",
      arguments: baseArgs,
      threadId: "thread-A",
      toolCallId: "tc-a",
    };
    const reqB = {
      toolName: "file.write",
      arguments: baseArgs,
      threadId: "thread-B",
      toolCallId: "tc-b",
    };

    await policy.remember(reqA, { decision: "allow", remember: "thread" });
    await policy.remember(reqB, { decision: "deny", remember: "thread" });

    policy.clearThreadRules("thread-A");

    expect(await policy.check(reqA)).toBe("ask");
    expect(await policy.check(reqB)).toBe("deny");
  });

  it("reloads external file changes before check", async () => {
    const policy = new FilePermissionPolicy({ filePath });
    const req = requestFor("external.md");
    expect(await policy.check(req)).toBe("ask");

    const writer = new FilePermissionPolicy({ filePath });
    await writer.remember(req, { decision: "allow", remember: "always" });

    expect(await policy.check(req)).toBe("allow");
  });

  it("reloads external file changes before listPersistedRules and revoke", async () => {
    const policy = new FilePermissionPolicy({ filePath });
    const firstReq = requestFor("first.md");
    await policy.remember(firstReq, { decision: "allow", remember: "always" });
    const firstRule = policy.listPersistedRules()[0];

    const writer = new FilePermissionPolicy({ filePath });
    const secondReq = requestFor("second.md");
    await writer.remember(secondReq, { decision: "deny", remember: "always" });

    expect(policy.listPersistedRules().map((r) => r.argHash)).toContain(
      writer.listPersistedRules()[0].argHash,
    );

    const raw = JSON.parse(await readFile(filePath, "utf8"));
    raw.rules.push({
      toolName: "file.write",
      argHash: "externally-added",
      decision: "deny",
      createdAt: "2026-05-18T00:00:00.000Z",
    });
    await writeFile(filePath, JSON.stringify(raw, null, 2), "utf8");

    await policy.revoke(firstRule.argHash);

    const rules = JSON.parse(await readFile(filePath, "utf8")).rules;
    expect(rules.map((r: { argHash: string }) => r.argHash)).toContain(
      "externally-added",
    );
    expect(rules.map((r: { argHash: string }) => r.argHash)).not.toContain(
      firstRule.argHash,
    );
  });
});

class EchoTool implements AgentTool {
  name = "echo";
  description = "echo";
  inputSchema = {
    type: "object",
    properties: { value: { type: "string" } },
    required: ["value"],
    additionalProperties: false,
  } as const;
  call = vi.fn(async (input: unknown) => ({ echoed: input }));
}

function makeClient() {
  let calls = 0;
  return {
    async complete(messages: AgentMessage[]) {
      void messages;
      calls += 1;
      if (calls === 1) {
        return {
          message: { role: "assistant" as const, content: "calling tool" },
          toolCalls: [
            { id: "call-1", name: "echo", arguments: { value: "x" } },
          ],
        };
      }
      return {
        message: { role: "assistant" as const, content: "done" },
        toolCalls: [],
      };
    },
  };
}

describe("PermissionPolicy runtime integration", () => {
  it("denies tool call and injects denial result without invoking the tool", async () => {
    const tool = new EchoTool();
    const policy: PermissionPolicy = {
      async check() { return "deny"; },
      async resolveAsk() { return { decision: "deny" } as PermissionResolution; },
      async remember() {},
    };
    const events: AgentRuntimeEvent[] = [];
    const runtime = new AgentRuntime(makeClient(), new ToolRegistry([tool]), {
      permissionPolicy: policy,
    });

    const result = await runtime.runWithMessages(
      [{ role: "user", content: "hi" }],
      (e) => events.push(e),
    );

    expect(tool.call).not.toHaveBeenCalled();
    const toolMessage = result.messages.find((m) => m.role === "tool");
    expect(toolMessage?.content).toBe(DENY_TOOL_RESULT_TEXT);
    expect(events.find((e) => e.type === "tool_result")).toMatchObject({
      status: "error",
      output: DENY_TOOL_RESULT_TEXT,
    });
  });

  it("ask -> allow goes through normal tool path", async () => {
    const tool = new EchoTool();
    const policy: PermissionPolicy = {
      async check() { return "ask"; },
      async resolveAsk() { return { decision: "allow", remember: "thread" }; },
      async remember() {},
    };
    const events: AgentRuntimeEvent[] = [];
    const runtime = new AgentRuntime(makeClient(), new ToolRegistry([tool]), {
      permissionPolicy: policy,
    });

    await runtime.runWithMessages(
      [{ role: "user", content: "hi" }],
      (e) => events.push(e),
    );

    expect(tool.call).toHaveBeenCalledTimes(1);
    expect(events.find((e) => e.type === "permission_decision")).toMatchObject({
      decision: "allow",
      scope: "thread",
    });
    expect(events.find((e) => e.type === "tool_result")).toMatchObject({
      status: "success",
    });
  });

  it("ask -> deny short-circuits without invoking tool", async () => {
    const tool = new EchoTool();
    const policy: PermissionPolicy = {
      async check() { return "ask"; },
      async resolveAsk() { return { decision: "deny", reason: "no" }; },
      async remember() {},
    };
    const runtime = new AgentRuntime(makeClient(), new ToolRegistry([tool]), {
      permissionPolicy: policy,
    });

    await runtime.runWithMessages([{ role: "user", content: "hi" }]);

    expect(tool.call).not.toHaveBeenCalled();
  });
});
