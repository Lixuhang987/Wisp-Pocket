import { randomUUID } from "node:crypto";
import type { AgentEvent } from "@handagent/core/protocol/AgentEvent.ts";
import type { Op } from "@handagent/core/protocol/Op.ts";
import type { RunStatus } from "@handagent/core/protocol/ThreadProtocolShared.ts";

export type AgentTxSub = {
  send(op: Op): Promise<void>;
};

export type SharedAgentStatus = {
  get(): RunStatus;
  set(value: RunStatus): void;
};

export type Agent = {
  tx_sub: AgentTxSub;
  rx_event: AsyncIterable<AgentEvent>;
  agent_status: SharedAgentStatus;
  session: unknown;
  close(): Promise<void>;
};

export class AgentManager {
  private readonly agents = new Map<string, Agent>();

  register(threadId: string, agent: Agent): void {
    this.agents.set(threadId, agent);
  }

  get(threadId: string): Agent | undefined {
    return this.agents.get(threadId);
  }

  has(threadId: string): boolean {
    return this.agents.has(threadId);
  }

  async submit(threadId: string, op: Op): Promise<boolean> {
    const agent = this.agents.get(threadId);
    if (!agent) {
      return false;
    }

    await agent.tx_sub.send(op);
    return true;
  }

  async interrupt(threadId: string): Promise<boolean> {
    return this.submit(threadId, {
      type: "interrupt",
      opId: randomUUID(),
      timestamp: new Date().toISOString(),
      payload: { reason: "user" },
    });
  }

  isRunning(threadId: string): boolean {
    return this.agents.get(threadId)?.agent_status.get() === "running";
  }

  async delete(threadId: string): Promise<boolean> {
    const agent = this.agents.get(threadId);
    if (!agent) {
      return false;
    }

    await agent.close();
    this.agents.delete(threadId);
    return true;
  }
}

export function createSharedAgentStatus(initial: RunStatus = "idle"): SharedAgentStatus {
  let value = initial;
  return {
    get: () => value,
    set: (next) => {
      value = next;
    },
  };
}
