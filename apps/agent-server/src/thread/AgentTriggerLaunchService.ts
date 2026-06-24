import { randomUUID } from "node:crypto";
import type { AgentTriggerFireRequest, AgentTriggerFireResult } from "@handagent/core/protocol/AgentTrigger.ts";
import type { ThreadNotificationPublisher } from "./ThreadNotificationPublisher.ts";
import type { ThreadPersistence } from "./ThreadPersistence.ts";
import type { AgentManager, Agent } from "../agent/AgentManager.ts";
import type { ThreadNotification } from "@handagent/core/protocol/ThreadNotification.ts";
import type { AgentTriggerAttentionPublisher } from "./AgentTriggerAttentionPublisher.ts";
import type { DynamicToolSpec } from "@handagent/core/protocol/DynamicTool.ts";
import { DEFAULT_HOST_MACOS_DYNAMIC_TOOLS } from "@handagent/core/protocol/HostDynamicTools.ts";

type AgentTriggerLaunchServiceOptions = {
  defaultDynamicTools?: DynamicToolSpec[];
  onThreadDynamicTools?: (threadId: string, dynamicTools: DynamicToolSpec[]) => void;
};

export class AgentTriggerLaunchService {
  constructor(
    private readonly persistence: ThreadPersistence,
    private readonly agentManager: AgentManager,
    private readonly createAgent: (threadId: string) => Agent,
    private readonly publisher: ThreadNotificationPublisher,
    private readonly attentionPublisher: AgentTriggerAttentionPublisher,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly options: AgentTriggerLaunchServiceOptions = {},
  ) {}

  async fire(request: AgentTriggerFireRequest): Promise<AgentTriggerFireResult> {
    const dynamicTools = cloneDynamicTools(
      this.options.defaultDynamicTools ?? DEFAULT_HOST_MACOS_DYNAMIC_TOOLS,
    );
    const thread = await this.persistence.createThread({
      preview: request.threadTitleHint ?? request.sourceEvent.summary,
      dynamicTools,
    });
    const threadId = thread.metadata.id;
    this.options.onThreadDynamicTools?.(threadId, dynamicTools);
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

function cloneDynamicTools(tools: DynamicToolSpec[]): DynamicToolSpec[] {
  return tools.map((tool) => ({
    ...tool,
    inputSchema: { ...tool.inputSchema },
  }));
}
