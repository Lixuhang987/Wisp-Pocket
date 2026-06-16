export function formatAgentServerOutput(
  streamName: "stdout" | "stderr",
  chunk: unknown,
): string {
  const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  return `[agent-server ${streamName}] ${text}`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
