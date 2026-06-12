import { describe, expect, it, vi } from "vitest";
import { AgentManager, createSharedAgentStatus, type Agent } from "../../src/agent/AgentManager.ts";

describe("AgentManager", () => {
  it("stores a thread agent and forwards op.submit to it", async () => {
    const manager = new AgentManager();
    const sent: string[] = [];
    manager.register("thread-1", makeAgent(async (op) => {
      sent.push(op.type);
    }));

    await manager.submit("thread-1", {
      type: "interrupt",
      opId: "op-1",
      timestamp: "2026-06-10T00:00:00.000Z",
      payload: { reason: "user" },
    });

    expect(sent).toEqual(["interrupt"]);
  });

  it("closes and removes registered agents on delete", async () => {
    const manager = new AgentManager();
    const close = vi.fn(async () => {});
    manager.register("thread-1", { ...makeAgent(), close });

    await expect(manager.delete("thread-1")).resolves.toBe(true);

    expect(close).toHaveBeenCalled();
    expect(manager.has("thread-1")).toBe(false);
  });

});

function makeAgent(send: Agent["tx_sub"]["send"] = async () => {}): Agent {
  return {
    tx_sub: { send },
    rx_event: (async function* emptyRuntimeEventStream() {})(),
    agent_status: createSharedAgentStatus(),
    session: {},
    close: vi.fn(async () => {}),
  };
}
