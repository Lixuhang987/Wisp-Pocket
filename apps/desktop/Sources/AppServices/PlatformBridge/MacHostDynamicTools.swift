import Foundation

@MainActor
enum MacHostDynamicTools {
    static let clientId = "swift-host"
    static let namespace = "host_macos"

    static let toolSpecs: [[String: Any]] = [
        spec("clipboard_read", "Read text from the macOS clipboard."),
        spec("app_list", "List running macOS applications."),
        spec("app_frontmost", "Get the frontmost macOS application."),
        spec("window_list", "List visible macOS windows."),
        spec("screen_capture", "Capture a screenshot from an available macOS display."),
        spec("ocr_read", "Read text from an image using macOS OCR."),
        spec("accessibility_snapshot", "Read a macOS accessibility tree snapshot."),
        spec("accessibility_action", "Perform an accessibility action on a macOS UI element."),
    ]

    static func platformMethod(for tool: String) -> String? {
        [
            "clipboard_read": "clipboard.read",
            "app_list": "app.list",
            "app_frontmost": "app.frontmost",
            "window_list": "window.list",
            "screen_capture": "screen.capture",
            "ocr_read": "ocr.read",
            "accessibility_snapshot": "accessibility.snapshot",
            "accessibility_action": "accessibility.action",
        ][tool]
    }

    private static func spec(_ name: String, _ description: String) -> [String: Any] {
        [
            "clientId": clientId,
            "namespace": namespace,
            "name": name,
            "description": description,
            "inputSchema": [
                "type": "object",
                "additionalProperties": true,
            ],
        ]
    }
}

@MainActor
final class DynamicToolProviderService {
    typealias Send = (String) -> Void

    private let provider: PlatformProvider

    init(provider: PlatformProvider = MacPlatformProvider()) {
        self.provider = provider
    }

    func makeHelloMessage() -> String {
        encodeJSON([
            "channel": "dynamic_tools",
            "type": "provider_hello",
            "clientId": MacHostDynamicTools.clientId,
            "tools": MacHostDynamicTools.toolSpecs,
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
            let tool = payload["tool"] as? String,
            let method = MacHostDynamicTools.platformMethod(for: tool)
        else {
            return
        }

        let namespace = payload["namespace"] as? String
        guard namespace == nil || namespace == MacHostDynamicTools.namespace else {
            sendResponse(
                callId: callId,
                success: false,
                text: "Unsupported dynamic tool namespace: \(namespace ?? "")",
                send: send
            )
            return
        }

        do {
            let result = try await provider.handle(method: method, args: payload["arguments"])
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
                text: bridgeError.message,
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
                "contentItems": [
                    [
                        "type": "inputText",
                        "text": text,
                    ],
                ],
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
