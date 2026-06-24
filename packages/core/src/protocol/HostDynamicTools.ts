import type { DynamicToolSpec } from "./DynamicTool.ts";

export const HOST_MACOS_CLIENT_ID = "swift-host";
export const HOST_MACOS_NAMESPACE = "host_macos";

export const DEFAULT_HOST_MACOS_DYNAMIC_TOOLS: DynamicToolSpec[] = [
  tool("clipboard_read", "Read text from the macOS clipboard."),
  tool("app_list", "List running macOS applications."),
  tool("app_frontmost", "Get the frontmost macOS application."),
  tool("window_list", "List visible macOS windows."),
  tool("screen_capture", "Capture a screenshot from an available macOS display."),
  tool("ocr_read", "Read text from an image using macOS OCR."),
  tool("accessibility_snapshot", "Read a macOS accessibility tree snapshot."),
  tool("accessibility_action", "Perform an accessibility action on a macOS UI element."),
];

function tool(name: string, description: string): DynamicToolSpec {
  return {
    clientId: HOST_MACOS_CLIENT_ID,
    namespace: HOST_MACOS_NAMESPACE,
    name,
    description,
    inputSchema: { type: "object", additionalProperties: true },
  };
}
