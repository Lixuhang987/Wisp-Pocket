import { z } from "zod";

export type StdioMCPServerConfig = {
  id: string;
  title: string;
  transport: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  requestTimeoutMs?: number;
  elicitation?: MCPElicitationConfig;
};

export type StreamableHttpMCPServerConfig = {
  id: string;
  title: string;
  transport: "streamableHttp";
  url: string;
  headers?: Record<string, string>;
};

export type MCPServerConfig =
  | StdioMCPServerConfig
  | StreamableHttpMCPServerConfig;

export type MCPConfig = {
  version: 1;
  servers: MCPServerConfig[];
};

export type MCPElicitationConfig = {
  autoAcceptEmptyForm?: boolean;
};

const nonEmptyString = (message: string) =>
  z.string(message).refine((value) => value.trim() !== "", { message });

const optionalNonEmptyString = (message: string) => nonEmptyString(message).optional();

const stringRecord = (message: string) =>
  z.record(z.string(), z.string(message), { error: message });

const ElicitationSchema = z.object({
  autoAcceptEmptyForm: z.boolean("mcp elicitation autoAcceptEmptyForm must be a boolean").optional(),
}, { error: "mcp elicitation must be an object" });

const StdioServerSchema = z.object({
  id: nonEmptyString("mcp id must be a non-empty string"),
  title: nonEmptyString("mcp title must be a non-empty string"),
  transport: z.literal("stdio"),
  command: nonEmptyString("mcp command must be a non-empty string"),
  args: z.array(z.string({ error: "mcp args must be a string array" }), { error: "mcp args must be a string array" }).optional(),
  env: z.preprocess(
    (value) => isPlainRecord(value) ? value : undefined,
    stringRecord("mcp env must be a string record").optional(),
  ),
  cwd: optionalNonEmptyString("mcp cwd must be a non-empty string"),
  requestTimeoutMs: z.number("mcp requestTimeoutMs must be a positive integer")
    .int("mcp requestTimeoutMs must be a positive integer")
    .positive("mcp requestTimeoutMs must be a positive integer")
    .optional(),
  elicitation: ElicitationSchema.optional(),
});

const StreamableHttpServerSchema = z.object({
  id: nonEmptyString("mcp id must be a non-empty string"),
  title: nonEmptyString("mcp title must be a non-empty string"),
  transport: z.literal("streamableHttp"),
  url: nonEmptyString("mcp url must be a non-empty string"),
  headers: z.preprocess(
    (value) => isPlainRecord(value) ? value : undefined,
    stringRecord("mcp headers must be a string record").optional(),
  ),
});

const MCPConfigSchema = z.object({
  version: z.literal(1, { error: "mcp config version must be 1" }),
  servers: z.array(
    z.discriminatedUnion("transport", [StdioServerSchema, StreamableHttpServerSchema], {
      error: "mcp server transport must be stdio or streamableHttp",
    }),
    { error: "mcp config servers must be an array" },
  ),
}, { error: "mcp config must be an object" });

export function parseMCPConfig(value: unknown, options: { interpolateEnvironment?: boolean } = {}): MCPConfig {
  const result = MCPConfigSchema.safeParse(value);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "invalid mcp config");
  }
  return {
    version: 1,
    servers: result.data.servers.map((server) =>
      options.interpolateEnvironment !== false && server.transport === "streamableHttp" && server.headers
        ? { ...server, headers: interpolateHeaders(server.headers) }
        : server,
    ),
  };
}

function interpolateHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = value.replace(
      /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
      (_, name: string) => process.env[name] ?? "",
    );
  }
  return result;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
