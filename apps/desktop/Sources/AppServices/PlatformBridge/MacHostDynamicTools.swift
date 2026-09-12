import Foundation
import HandAgentHostAutomation

enum MacHostDynamicTools {
    static let clientId = "swift-host"
    static let namespace = "host_macos"

    static var toolSpecs: [[String: Any]] {
        typealias S = DynamicToolSchema
        let screenTarget = S.object([
            "kind": ["type": "string", "enum": ["display", "window", "region"]],
            "displayId": ["type": "string", "pattern": "^[0-9]+$"], "screenId": ["type": "string", "pattern": "^[0-9]+$"],
            "windowId": ["type": "integer", "minimum": 1, "maximum": 4294967295],
            "x": ["type": "integer", "minimum": 0], "y": ["type": "integer", "minimum": 0],
            "width": ["type": "integer", "minimum": 1], "height": ["type": "integer", "minimum": 1],
        ])
        let actionTarget = S.object([
            "kind": ["type": "string", "enum": ["frontmost_app", "window", "element", "selector", "position"]],
            "windowId": ["type": "integer", "minimum": 1, "maximum": 4294967295], "elementId": S.string,
            "role": S.string, "title": S.string, "x": ["type": "number"], "y": ["type": "number"],
            "button": ["type": "string", "enum": ["left", "right", "other"]],
        ])
        return [
            S.spec(namespace, "clipboard_read", "Read clipboard text; no automatic context capture.", S.object()),
            S.spec(namespace, "app_list", "List running macOS applications with bundleId and pid.", S.object()),
            S.spec(namespace, "app_frontmost", "Read the frontmost app and its own visible window, including timestamp and identifiers.", S.object()),
            S.spec(namespace, "app_activate", "Activate an already running app by bundleId (default frontmost). Fails if absent or activation is refused.", S.object(["bundleId": S.string])),
            S.spec(namespace, "window_list", "List visible windows with id, title, appName and ownerPid.", S.object()),
            S.spec(namespace, "screen_capture", "Capture a display (default), window or region. Returns PNG inputImage plus dimensions/target metadata. displayId (alias screenId) is a positive display identifier string; unknown ids fail. Window needs windowId; region is in display pixels with x/y >= 0 and width/height > 0 and must fit within that display. Invalid targets, permission and capture failures are errors.", S.object(["target": screenTarget])),
            S.spec(namespace, "ocr_read", "Recognize text from supplied base64 image. Does not capture the screen. Invalid images fail.", S.object(["imageBase64": S.string, "language": S.string], required: ["imageBase64"])),
            S.spec(namespace, "accessibility_snapshot", "Read an AX tree including elementId, role/title/value and children. kind defaults to frontmost_app; element requires elementId. Requires Accessibility permission; depth 0...6, children 1...50.", S.object([
                "kind": ["type": "string", "enum": ["frontmost_app", "app", "window", "element"]],
                "pid": ["type": "integer", "minimum": 1, "maximum": 2147483647], "bundleId": S.string,
                "windowId": ["type": "integer", "minimum": 1, "maximum": 4294967295], "elementId": S.string,
                "maxDepth": ["type": "integer", "minimum": 0, "maximum": 6, "default": 4],
                "maxChildren": ["type": "integer", "minimum": 1, "maximum": 50, "default": 25],
            ])),
            S.spec(namespace, "accessibility_action", "Act on an AX element, role/title selector, focused element (default), or a click position. action.kind supports press/click/set_value(value)/type_text(text)/hotkey(keys string or array). Only click supports position; Accessibility and actual action errors fail.", S.object([
                "target": actionTarget,
                "action": S.object([
                    "kind": ["type": "string", "enum": ["press", "click", "set_value", "type_text", "hotkey"]],
                    "value": S.string, "text": S.string, "keys": ["oneOf": [S.string, S.array(S.string)]],
                ], required: ["kind"]),
            ], required: ["action"])),
        ]
    }

    static func platformMethod(for tool: String) -> String? {
        [
            "clipboard_read": "clipboard.read",
            "app_list": "app.list",
            "app_frontmost": "app.frontmost",
            "app_activate": "app.activate",
            "window_list": "window.list",
            "screen_capture": "screen.capture",
            "ocr_read": "ocr.read",
            "accessibility_snapshot": "accessibility.snapshot",
            "accessibility_action": "accessibility.action",
        ][tool]
    }


}

@MainActor
final class DynamicToolProviderService {
    typealias Send = (String) -> Void

    private let provider: PlatformProvider
    private let builtinFeatures: BuiltinFeatures?
    var onToolsChanged: (() -> Void)?

    init(
        provider: PlatformProvider = MacPlatformProvider(),
        builtinFeatures: BuiltinFeatures? = nil
    ) {
        self.provider = provider
        self.builtinFeatures = builtinFeatures
        builtinFeatures?.onToolsChanged = { [weak self] in self?.onToolsChanged?() }
    }

    var dynamicToolSpecs: [[String: Any]] {
        MacHostDynamicTools.toolSpecs + (builtinFeatures?.dynamicToolSpecs ?? [])
    }

    func makeHelloMessage() -> String {
        encodeJSON([
            "channel": "dynamic_tools",
            "type": "provider_hello",
            "clientId": MacHostDynamicTools.clientId,
            "tools": dynamicToolSpecs,
        ])
    }

    func handleIncoming(raw: String, send: @escaping Send) async {
        guard let data = raw.data(using: .utf8) else { return }
        guard let envelope = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }
        guard
            let channel = envelope["channel"] as? String,
            channel == "dynamic_tools",
            let type = envelope["type"] as? String,
            type == "tool_call_request",
            let payload = envelope["payload"] as? [String: Any],
            let clientId = payload["clientId"] as? String,
            clientId == MacHostDynamicTools.clientId,
            let callId = payload["callId"] as? String,
            let tool = payload["tool"] as? String
        else {
            return
        }

        let namespace = payload["namespace"] as? String
        if let arguments = payload["arguments"], !(arguments is NSNull), !(arguments is [String: Any]) {
            sendResponse(callId: callId, success: false, text: "invalid_argument: arguments must be an object", send: send)
            return
        }
        if namespace == nil || namespace == MacHostDynamicTools.namespace {
            await handleHostTool(tool: tool, payload: payload, callId: callId, send: send)
            return
        }

        if let result = await builtinFeatures?.handle(
            namespace: namespace ?? "",
            tool: tool,
            arguments: payload["arguments"]
        ) {
            sendResponse(
                callId: callId,
                success: result.success,
                contentItems: result.contentItems,
                send: send
            )
            return
        }

        sendResponse(
            callId: callId,
            success: false,
            text: "Unsupported dynamic tool namespace: \(namespace ?? "")",
            send: send
        )
    }

    private func handleHostTool(
        tool: String,
        payload: [String: Any],
        callId: String,
        send: @escaping Send
    ) async {
        guard let method = MacHostDynamicTools.platformMethod(for: tool) else {
            sendResponse(
                callId: callId,
                success: false,
                text: "Unsupported host dynamic tool: \(tool)",
                send: send
            )
            return
        }
        do {
            let result = try await provider.handle(method: method, args: payload["arguments"])
            if tool == "screen_capture" {
                guard var object = result as? [String: Any],
                      let base64 = object.removeValue(forKey: "imageBase64") as? String,
                      !base64.isEmpty else {
                    throw PlatformBridgeError(code: "capture_failed", message: "Screen capture returned no image")
                }
                object.removeValue(forKey: "thumbnailBase64")
                let metadata = DynamicToolResult.json(object)
                sendResponse(callId: callId, success: metadata.success, contentItems: metadata.contentItems + [
                    ["type": "inputImage", "imageUrl": "data:image/png;base64,\(base64)"],
                ], send: send)
                return
            }
            sendResponse(
                callId: callId,
                success: true,
                text: encodeJSONValue(result),
                send: send
            )
        } catch let bridgeError as PlatformBridgeError {
            sendResponse(
                callId: callId,
                success: false,
                text: "\(bridgeError.code): \(bridgeError.message)",
                send: send
            )
        } catch {
            sendResponse(
                callId: callId,
                success: false,
                text: error.localizedDescription,
                send: send
            )
        }
    }

    private func sendResponse(
        callId: String,
        success: Bool,
        text: String,
        send: Send
    ) {
        send(encodeJSON([
            "channel": "dynamic_tools",
            "type": "tool_call_response",
            "payload": [
                "callId": callId,
                "success": success,
                "contentItems": [["type": "inputText", "text": text]],
            ],
        ]))
    }

    private func sendResponse(
        callId: String,
        success: Bool,
        contentItems: [[String: Any]],
        send: Send
    ) {
        send(encodeJSON([
            "channel": "dynamic_tools",
            "type": "tool_call_response",
            "payload": [
                "callId": callId,
                "success": success,
                "contentItems": contentItems,
            ],
        ]))
    }

    private func encodeJSON(_ object: [String: Any]) -> String {
        guard
            JSONSerialization.isValidJSONObject(object),
            let data = try? JSONSerialization.data(withJSONObject: object, options: []),
            let string = String(data: data, encoding: .utf8)
        else {
            return "{}"
        }
        return string
    }

    private func encodeJSONValue(_ value: Any?) -> String {
        let normalized = value ?? NSNull()
        if JSONSerialization.isValidJSONObject(normalized),
           let data = try? JSONSerialization.data(withJSONObject: normalized, options: []),
           let string = String(data: data, encoding: .utf8) {
            return string
        }
        if let string = value as? String {
            return string
        }
        return String(describing: normalized)
    }
}
