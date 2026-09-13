import XCTest
@testable import HandAgentDesktop

@MainActor
final class MacHostDynamicToolsTests: XCTestCase {
    func testDefaultToolSpecsUseHostNamespaceAndClientId() {
        let tools = MacHostDynamicTools.toolSpecs

        XCTAssertEqual(tools.count, 9)
        XCTAssertEqual(Set(tools.compactMap { $0["namespace"] as? String }), ["host_macos"])
        XCTAssertEqual(Set(tools.compactMap { $0["clientId"] as? String }), ["swift-host"])
        XCTAssertTrue(tools.contains { $0["name"] as? String == "screen_capture" })
        XCTAssertTrue(tools.contains { $0["name"] as? String == "accessibility_action" })
    }

    func testHelloRegistersDynamicToolsProvider() {
        let service = DynamicToolProviderService(provider: RecordingDynamicToolPlatformProvider())

        let object = decodeObject(service.makeHelloMessage())

        XCTAssertEqual(object["channel"] as? String, "dynamic_tools")
        XCTAssertEqual(object["type"] as? String, "provider_hello")
        XCTAssertEqual(object["clientId"] as? String, "swift-host")
        let tools = object["tools"] as? [[String: Any]]
        XCTAssertEqual(tools?.count, 9)
    }

    func testToolCallRequestDispatchesToMatchingPlatformMethod() async {
        let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="
        let provider = RecordingDynamicToolPlatformProvider(result: ["imageBase64": png, "mimeType": "image/png", "width": 1, "height": 1])
        let service = DynamicToolProviderService(provider: provider)
        var sentObjects: [[String: Any]] = []

        await service.handleIncoming(
            raw:
            """
            {
              "channel": "dynamic_tools",
              "type": "tool_call_request",
              "payload": {
                "clientId": "swift-host",
                "threadId": "thread-1",
                "turnId": "turn-1",
                "callId": "call-1",
                "namespace": "host_macos",
                "tool": "screen_capture",
                "arguments": {
                  "target": { "kind": "display", "displayId": "1" }
                }
              }
            }
            """,
            send: { sentObjects.append(Self.decodeObject($0)) }
        )

        XCTAssertEqual(provider.calls.count, 1)
        XCTAssertEqual(provider.calls[0].method, "screen.capture")
        let args = provider.calls[0].args as? [String: Any]
        let target = args?["target"] as? [String: Any]
        XCTAssertEqual(target?["displayId"] as? String, "1")

        let response = sentObjects[0]
        XCTAssertEqual(response["channel"] as? String, "dynamic_tools")
        XCTAssertEqual(response["type"] as? String, "tool_call_response")
        let payload = response["payload"] as? [String: Any]
        XCTAssertEqual(payload?["callId"] as? String, "call-1")
        XCTAssertEqual(payload?["success"] as? Bool, true)
        let items = payload?["contentItems"] as? [[String: Any]]
        XCTAssertEqual(items?.last?["type"] as? String, "inputImage")
        XCTAssertEqual(items?.last?["imageUrl"] as? String, "data:image/png;base64,\(png)")
        let metadata = decodeObject(items?.first?["text"] as? String ?? "")
        XCTAssertEqual(metadata["width"] as? Int, 1)
        XCTAssertNil(metadata["imageBase64"])
    }

    func testPlatformErrorBecomesFailedDynamicToolResponse() async {
        let service = DynamicToolProviderService(
            provider: RecordingDynamicToolPlatformProvider(error: PlatformBridgeError(
                code: "capture_failed",
                message: "ScreenCaptureKit failed"
            ))
        )
        var sentObjects: [[String: Any]] = []

        await service.handleIncoming(
            raw:
            """
            {
              "channel": "dynamic_tools",
              "type": "tool_call_request",
              "payload": {
                "clientId": "swift-host",
                "threadId": "thread-1",
                "turnId": "turn-1",
                "callId": "call-1",
                "namespace": "host_macos",
                "tool": "screen_capture",
                "arguments": {}
              }
            }
            """,
            send: { sentObjects.append(Self.decodeObject($0)) }
        )

        let payload = sentObjects[0]["payload"] as? [String: Any]
        XCTAssertEqual(payload?["success"] as? Bool, false)
        let contentItems = payload?["contentItems"] as? [[String: Any]]
        XCTAssertEqual(contentItems?.first?["text"] as? String, "capture_failed: ScreenCaptureKit failed")
    }

    private func decodeObject(_ text: String) -> [String: Any] {
        Self.decodeObject(text)
    }

    private static func decodeObject(_ text: String) -> [String: Any] {
        guard let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            XCTFail("Expected JSON object")
            return [:]
        }
        return object
    }
}

private final class RecordingDynamicToolPlatformProvider: PlatformProvider {
    private(set) var calls: [(method: String, args: Any?)] = []
    let result: Any
    let error: Error?

    init(result: Any = [:] as [String: Any], error: Error? = nil) {
        self.result = result
        self.error = error
    }

    func handle(method: String, args: Any?) async throws -> Any? {
        calls.append((method: method, args: args))
        if let error {
            throw error
        }
        return result
    }
}
