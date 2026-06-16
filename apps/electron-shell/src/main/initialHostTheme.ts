import { isHostTheme, type HostTheme } from "./protocol/electronShellProtocol.js";

const fallbackTheme: HostTheme = { preference: "system", resolved: "light" };

export function readInitialHostTheme(raw: string | undefined): HostTheme {
  if (!raw) {
    return fallbackTheme;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isHostTheme(parsed) ? parsed : fallbackTheme;
  } catch {
    return fallbackTheme;
  }
}
