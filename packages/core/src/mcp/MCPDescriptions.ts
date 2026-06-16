import type {
  MCPPromptDescription,
  MCPResourceDescription,
  MCPToolDescription,
} from "./MCPClient.ts";

export function parseToolDescription(value: unknown): MCPToolDescription {
  if (!isRecord(value) || typeof value.name !== "string") {
    throw new Error("Invalid MCP tool description");
  }
  return {
    name: value.name,
    description: typeof value.description === "string" ? value.description : undefined,
    inputSchema: isRecord(value.inputSchema) ? value.inputSchema : undefined,
  };
}

export function parsePromptDescription(value: unknown): MCPPromptDescription {
  if (!isRecord(value) || typeof value.name !== "string") {
    throw new Error("Invalid MCP prompt description");
  }
  return {
    name: value.name,
    title: typeof value.title === "string" ? value.title : undefined,
    description: typeof value.description === "string" ? value.description : undefined,
    arguments: Array.isArray(value.arguments) ? value.arguments : undefined,
  };
}

export function parseResourceDescription(value: unknown): MCPResourceDescription {
  if (!isRecord(value) || typeof value.uri !== "string" || typeof value.name !== "string") {
    throw new Error("Invalid MCP resource description");
  }
  return {
    uri: value.uri,
    name: value.name,
    title: typeof value.title === "string" ? value.title : undefined,
    description: typeof value.description === "string" ? value.description : undefined,
    mimeType: typeof value.mimeType === "string" ? value.mimeType : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
