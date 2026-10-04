import { WorkspaceRegistry } from "@handagent/core/workspace/WorkspaceRegistry.ts";
import { ThreadRegistry } from "@handagent/core/thread/ThreadRegistry.ts";
import { ThreadTools } from "@handagent/core/thread/ThreadTools.ts";
import { AgentRuntime } from "@handagent/core/runtime/AgentRuntime.ts";
import { ThreadStore } from "@handagent/thread-store/index.ts";
import { ThreadPersistence } from "../../src/thread/ThreadPersistence.ts";
import { ThreadCommandRouter } from "../../src/thread/ThreadCommandRouter.ts";
import { ThreadNotificationPublisher } from "../../src/thread/ThreadNotificationPublisher.ts";
import * as projection from "../../src/protocol/MessageTranslator.ts";
import { MemoryBlobStore } from "./MemoryBlobStore.ts";
import type { LLMClientLike } from "@handagent/core/llm/LLMClient.ts";
import type { ThreadServices } from "@handagent/core/thread/types/ThreadServices.ts";
import type { ThreadNotification } from "@handagent/core/protocol/types/ThreadNotification.ts";
import type { ServerRequest } from "@handagent/core/protocol/types/ServerRequest.ts";

export function threadHarness(client: LLMClientLike, options: Partial<ThreadServices> = {}, dbPath = ":memory:") {
  const store = new ThreadStore({ dbPath });
  const workspace = store.createWorkspace("/tmp").workspace;
  const workspaces = new WorkspaceRegistry(store);
  const persistence = new ThreadPersistence(store, undefined, new MemoryBlobStore());
  const events: (ThreadNotification | ServerRequest)[] = [];
  const publisher = new ThreadNotificationPublisher((event) => events.push(event));
  const threads = new ThreadRegistry({
    storage: persistence,
    projection: { runtimeMessages: projection.agentMessagesToRuntimeMessages, conversation: projection.agentMessagesToConversation,
      notification: projection.toThreadNotification, audit: projection.toAuditEvent, summarizeInput: projection.summarizeUserInput },
    publish: (event) => publisher.publish(event),
    createTools: () => new ThreadTools({ resolveTools: () => [] }),
    createRuntime: (_id, tools) => new AgentRuntime(client, tools.registry),
    stopTimeoutMs: 20,
    ...options,
  });
  const router = new ThreadCommandRouter(threads, publisher, workspaces);
  return { workspace, workspaces, store, persistence, threads, router, publisher, events,
    async close() { await threads.close(); store.close(); } };
}
export function input(text: string) {
  return { type: "user_input" as const, opId: crypto.randomUUID(), timestamp: new Date().toISOString(),
    payload: { items: [{ type: "text" as const, id: crypto.randomUUID(), text }] } };
}
