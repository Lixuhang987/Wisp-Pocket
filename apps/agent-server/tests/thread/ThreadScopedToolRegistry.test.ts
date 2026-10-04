import { expect, it } from "vitest";
import { ThreadTools } from "@handagent/core/thread/ThreadTools.ts";
import type { AgentTool } from "@handagent/core/tools/types/AgentTool.ts";

const tool = (name: string): AgentTool => ({name,description:name,inputSchema:{type:"object"},call:async()=>"done"});

// Retained catalogue refresh and Thread isolation cases; activation-only cases are removed.
it("exposes configured default tools before and after each Turn refresh", async () => {
  let catalogue = [tool("file.read"), tool("codex.execute"), tool("file.read")];
  const tools = new ThreadTools({resolveTools:()=>catalogue});
  await tools.refresh();
  expect(tools.registry.list().map(tool=>tool.name)).toEqual(["file.read","codex.execute"]);
  catalogue = [tool("file.read"), {...tool("codex.execute"),description:"已关联会话"}];
  await tools.refresh();
  expect(tools.registry.list().find(tool=>tool.name==="codex.execute")!.description).toBe("已关联会话");
});

it("does not rewrite one Thread registry when another Thread refreshes", async () => {
  const slow = Promise.withResolvers<AgentTool[]>();
  let pending = false;
  const first = new ThreadTools({resolveTools:()=>pending?slow.promise:[tool("file.read")]});
  const second = new ThreadTools({resolveTools:()=>[tool("codex.execute")]});
  await first.refresh();pending=true;
  const refreshing=first.refresh();first.cancelRefresh();await second.refresh();
  slow.resolve([tool("stale")]);await refreshing;
  expect(first.registry.list().map(tool=>tool.name)).toEqual(["file.read"]);
  expect(second.registry.list().map(tool=>tool.name)).toEqual(["codex.execute"]);
});
