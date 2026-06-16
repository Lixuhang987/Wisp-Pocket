import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export type OpenAIApiType = "responses" | "chat" | "completion";
export type LLMProvider = "openai-compatible" | "anthropic";

export type ModelSettings = {
  provider: LLMProvider;
  model: string;
  summarizerModel: string;
  apiKey?: string;
  baseUrl?: string;
  api: OpenAIApiType;
};

type PersistedModelSettings = {
  llm?: {
    model?: unknown;
    summarizerModel?: unknown;
    apiKey?: unknown;
    baseUrl?: unknown;
    api?: unknown;
    provider?: unknown;
  };
};

const OpenAIApiTypeSchema = z.enum(["responses", "chat", "completion"]);
const LLMProviderSchema = z.enum(["openai-compatible", "anthropic"]);
const OptionalTrimmedStringSchema = z.string().transform((value) => value.trim()).pipe(z.string().min(1));

export const defaultModelSettings: ModelSettings = {
  provider: "openai-compatible",
  model: "gpt-5-mini",
  summarizerModel: "claude-haiku-4-5-20251001",
  api: "responses",
};

export function modelSettingsFilePath(homeDir = homedir()): string {
  return join(homeDir, ".spotAgent", "settings.json");
}

export function loadModelSettings(homeDir = homedir()): ModelSettings {
  const filePath = modelSettingsFilePath(homeDir);
  if (!existsSync(filePath)) {
    return defaultModelSettings;
  }

  let parsed: PersistedModelSettings;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8")) as PersistedModelSettings;
  } catch (error) {
    throw new Error(
      `Failed to parse settings at ${filePath}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  const llm = parsePersistedModelSettings(parsed).llm ?? {};
  return {
    provider: normalizeProvider(llm.provider),
    model: normalizeRequiredString(llm.model) ?? defaultModelSettings.model,
    summarizerModel:
      normalizeRequiredString(llm.summarizerModel) ??
      defaultModelSettings.summarizerModel,
    apiKey: normalizeOptionalString(llm.apiKey),
    baseUrl: normalizeOptionalString(llm.baseUrl),
    api: normalizeApiType(llm.api),
  };
}

function parsePersistedModelSettings(value: unknown): PersistedModelSettings {
  return z.object({
    llm: z.object({
      model: z.unknown().optional(),
      summarizerModel: z.unknown().optional(),
      apiKey: z.unknown().optional(),
      baseUrl: z.unknown().optional(),
      api: z.unknown().optional(),
      provider: z.unknown().optional(),
    }).optional(),
  }).catch({}).parse(value);
}

function normalizeRequiredString(value: unknown): string | undefined {
  const normalized = normalizeOptionalString(value);
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return OptionalTrimmedStringSchema.safeParse(value).data;
}

function normalizeApiType(value: unknown): OpenAIApiType {
  return OpenAIApiTypeSchema.safeParse(value).data ?? defaultModelSettings.api;
}

function normalizeProvider(value: unknown): LLMProvider {
  return LLMProviderSchema.safeParse(value).data ?? defaultModelSettings.provider;
}
