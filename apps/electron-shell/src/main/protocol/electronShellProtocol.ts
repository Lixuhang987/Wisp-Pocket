import type { UserInput } from "@handagent/core/protocol/types/Op.ts";
import { z } from "zod";

export type InitialPromptPayload = {
  clientRequestId: string;
  userInput: UserInput;
};

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type HostTheme = { preference: ThemePreference; resolved: ResolvedTheme };

export type OpenInitialPromptCommand = {
  channel: "electron_shell";
  type: "thread_window.open_initial_prompt";
  commandId: string;
  payload: InitialPromptPayload;
};

export type OpenHistoryCommand = {
  channel: "electron_shell";
  type: "thread_window.open_history";
  commandId: string;
};

export type FocusThreadWindowCommand = {
  channel: "electron_shell";
  type: "thread_window.focus";
  commandId: string;
  threadId?: string | null;
};

export type ShowActivityWindowCommand = {
  channel: "electron_shell";
  type: "activity_window.show";
  commandId: string;
};

export type ThemeChangedCommand = {
  channel: "electron_shell";
  type: "theme.changed";
  commandId: string;
  theme: HostTheme;
};

export type ShutdownCommand = {
  channel: "electron_shell";
  type: "shutdown";
  commandId: string;
};

export type SwiftToElectronCommand =
  | OpenInitialPromptCommand
  | OpenHistoryCommand
  | FocusThreadWindowCommand
  | ShowActivityWindowCommand
  | ThemeChangedCommand
  | ShutdownCommand;

export type ElectronReadyEvent = {
  channel: "electron_shell";
  type: "electron.ready";
  timestamp: string;
};

export type ThreadWindowPreparedEvent = {
  channel: "electron_shell";
  type: "thread_window.prepared";
  timestamp: string;
};

export type ThreadWindowPrepareFailedEvent = {
  channel: "electron_shell";
  type: "thread_window.prepare_failed";
  message: string;
};

export type CommandAckEvent = {
  channel: "electron_shell";
  type: "command.ack";
  commandId: string;
  ok: boolean;
  error?: string;
};

export type ThreadWindowClosedEvent = {
  channel: "electron_shell";
  type: "thread_window.closed";
  timestamp: string;
  wasVisible: boolean;
};

export type RendererCrashedEvent = {
  channel: "electron_shell";
  type: "renderer.crashed";
  window: "thread" | "activity";
  reason: string;
};

export type AgentServerHealthEvent = {
  channel: "electron_shell";
  type: "agent_server.health";
  available: boolean;
  message?: string;
};

export type ElectronToSwiftEvent =
  | ElectronReadyEvent
  | ThreadWindowPreparedEvent
  | ThreadWindowPrepareFailedEvent
  | CommandAckEvent
  | ThreadWindowClosedEvent
  | RendererCrashedEvent
  | AgentServerHealthEvent;

export function parseCommand(raw: string): SwiftToElectronCommand {
  const value = JSON.parse(raw) as unknown;
  if (!isSwiftToElectronCommand(value)) {
    throw new Error("unsupported electron shell command");
  }
  return value;
}

export function encodeEvent(event: ElectronToSwiftEvent): string {
  return JSON.stringify(event);
}

export function isSwiftToElectronCommand(value: unknown): value is SwiftToElectronCommand {
  return SwiftToElectronCommandSchema.safeParse(value).success;
}

export function isHostTheme(value: unknown): value is HostTheme {
  return HostThemeSchema.safeParse(value).success;
}

const HostThemeSchema = z.object({
  preference: z.enum(["light", "dark", "system"]),
  resolved: z.enum(["light", "dark"]),
});

const InputItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    id: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("text_selection"),
    id: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("image"),
    id: z.string(),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    base64: z.string(),
  }),
  z.object({
    type: z.literal("skill"),
    id: z.string(),
    actionId: z.string(),
    title: z.string(),
    prompt: z.string(),
  }),
]);

const UserInputSchema = z.object({
  items: z.array(InputItemSchema).min(1),
}) satisfies z.ZodType<UserInput>;

const BaseCommandSchema = z.object({
  channel: z.literal("electron_shell"),
  commandId: z.string(),
});

const SwiftToElectronCommandSchema = z.discriminatedUnion("type", [
  BaseCommandSchema.extend({
    type: z.literal("thread_window.open_initial_prompt"),
    payload: z.object({
      clientRequestId: z.string(),
      userInput: UserInputSchema,
    }),
  }),
  BaseCommandSchema.extend({
    type: z.literal("thread_window.open_history"),
  }),
  BaseCommandSchema.extend({
    type: z.literal("thread_window.focus"),
    threadId: z.string().nullable().optional(),
  }),
  BaseCommandSchema.extend({
    type: z.literal("activity_window.show"),
  }),
  BaseCommandSchema.extend({
    type: z.literal("theme.changed"),
    theme: HostThemeSchema,
  }),
  BaseCommandSchema.extend({
    type: z.literal("shutdown"),
  }),
]) satisfies z.ZodType<SwiftToElectronCommand>;
