import { randomUUID } from "node:crypto";
import type { AgentTriggerFireRequest, AgentTriggerFireResult } from "@handagent/core/protocol/AgentTrigger.ts";
import type { ThreadNotificationPublisher } from "./ThreadNotificationPublisher.ts";
import type { ThreadPersistence } from "./ThreadPersistence.ts";
import type { AgentManager, Agent } from "../agent/AgentManager.ts";
import type { ThreadNotification } from "@handagent/core/protocol/ThreadNotification.ts";
import type { AgentTriggerAttentionPublisher } from "./AgentTriggerAttentionPublisher.ts";

export class AgentTriggerLaunchService {
  constructor(
    private readonly persistence: ThreadPersistence,
    private readonly agentManager: AgentManager,
    private readonly createAgent: (threadId: string) => Agent,
    private readonly publisher: ThreadNotificationPublisher,
    private readonly attentionPublisher: AgentTriggerAttentionPublisher,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async fire(request: AgentTriggerFireRequest): Promise<AgentTriggerFireResult> {
    const thread = await this.persistence.createThread(request.threadTitleHint ?? request.sourceEvent.summary);
    const threadId = thread.metadata.id;
    this.attentionPublisher.registerTriggerThread(
      threadId,
      request.triggerInstanceId,
      request.notificationPolicy.mode,
    );
    this.agentManager.register(threadId, this.createAgent(threadId));
    this.publishThreadStarted(threadId, thread.metadata.preview ?? null);

    await this.agentManager.submit(threadId, {
      type: "user_input",
      opId: randomUUID(),
      timestamp: this.now(),
      payload: request.userInput,
    });

    return {
      threadId,
      acceptedAt: this.now(),
    };
  }

  private publishThreadStarted(threadId: string, preview: string | null): void {
    const event: ThreadNotification = {
      type: "thread.started",
      threadId,
      notificationId: `notification-${randomUUID()}`,
      timestamp: this.now(),
      payload: { preview },
    };
    this.publisher.publish(event);
  }
}
