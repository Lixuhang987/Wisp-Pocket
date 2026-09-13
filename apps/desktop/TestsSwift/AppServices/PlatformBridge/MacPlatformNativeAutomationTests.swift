import AppKit
import Carbon.HIToolbox
import ImageIO
import XCTest
@testable import HandAgentDesktop

final class MacPlatformNativeAutomationTests: XCTestCase {
    @MainActor
    func testProviderRejectsMalformedNativeTargetsBeforeAnySystemOperation() async throws {
        let service = DynamicToolProviderService(provider: MacPlatformProvider())
        let invalidCalls: [(String, [String: Any])] = [
            ("accessibility_action", ["target": ["kind": "element", "elementId": "pid:123;pid:456;path:0"], "action": ["kind": "press"]]),
            ("accessibility_action", ["target": ["kind": "element", "elementId": "pid:9999999999999;path:0"], "action": ["kind": "press"]]),
            ("accessibility_action", ["target": ["kind": "element", "elementId": "pid:123;path:0..1"], "action": ["kind": "press"]]),
            ("accessibility_snapshot", ["kind": "app", "pid": 9_999_999_999_999]),
            ("accessibility_action", ["target": ["kind": "window", "windowId": -1], "action": ["kind": "press"]]),
            ("screen_capture", ["target": ["kind": "unknown"]]),
            ("screen_capture", ["target": ["kind": "display", "displayId": "missing"]]),
            ("screen_capture", ["target": ["kind": "display", "displayId": 123]]),
            ("screen_capture", ["target": ["kind": "window", "windowId": 1e100]]),
            ("screen_capture", ["target": ["kind": "region", "x": 0, "y": 0, "width": 1.5, "height": 20]]),
        ]
        for (index, call) in invalidCalls.enumerated() {
            let request = try JSONSerialization.data(withJSONObject: [
                "channel": "dynamic_tools", "type": "tool_call_request",
                "payload": ["clientId": "swift-host", "callId": "invalid-\(index)", "namespace": "host_macos", "tool": call.0, "arguments": call.1],
            ])
            var responses: [String] = []
            await service.handleIncoming(raw: String(decoding: request, as: UTF8.self)) { responses.append($0) }
            let raw = try XCTUnwrap(responses.first)
            let message = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any])
            let payload = try XCTUnwrap(message["payload"] as? [String: Any])
            XCTAssertEqual(payload["callId"] as? String, "invalid-\(index)")
            XCTAssertEqual(payload["success"] as? Bool, false)
            let items = try XCTUnwrap(payload["contentItems"] as? [[String: Any]])
            XCTAssertTrue((items.first?["text"] as? String)?.hasPrefix("invalid_argument:") == true, raw)
        }
    }

    func testAutomationActionsUseTheHostActionContract() throws {
        let requests: [([String: Any], [String: Any])] = [
            (
                ["action": "set_value", "selector": ["role": "AXTextField", "title": "Name"], "value": "保存"],
                ["target": ["kind": "selector", "role": "AXTextField", "title": "Name"],
                 "action": ["kind": "set_value", "value": "保存"]]
            ),
            (
                ["action": "type_text", "selector": [:] as [String: String], "text": "输入🙂"],
                ["action": ["kind": "type_text", "text": "输入🙂"]]
            ),
            (
                ["action": "click", "selector": [:] as [String: String],
                 "position": ["x": 31.5, "y": 82.25], "button": "right"],
                ["target": ["kind": "position", "x": 31.5, "y": 82.25, "button": "right"],
                 "action": ["kind": "click"]]
            ),
            (
                ["action": "hotkey", "keys": "command+shift+a"],
                ["action": ["kind": "hotkey", "keys": ["command", "shift", "a"]]]
            ),
        ]

        for (automation, host) in requests {
            XCTAssertEqual(
                try MacPlatformAccessibilityActionRequest.parseAutomation(arguments: automation),
                try MacPlatformAccessibilityActionRequest.parse(args: host)
            )
        }
    }

    func testFrontmostWindowBelongsToTheFrontmostApp() throws {
        let windows: [[String: Any?]] = [
            ["id": 1, "ownerPid": 900, "title": "Floating utility"],
            ["id": 2, "ownerPid": 101, "title": "Editing"],
            ["id": 3, "ownerPid": 101, "title": "Other document"],
        ]

        let window = try XCTUnwrap(selectFrontmostWindow(appProcessIdentifier: 101, windows: windows))
        XCTAssertEqual(window["id"] as? Int, 2)
        XCTAssertNil(selectFrontmostWindow(appProcessIdentifier: 102, windows: windows))
    }

    func testScreenshotResponseContainsDecodableOriginalAndResizedThumbnail() throws {
        let image = try makeImage(width: 1440, height: 900)
        let response = try MacPlatformScreenshotResponse.make(image: image, target: nil)
        let original = try decodeImage(response["imageBase64"])
        let thumbnail = try decodeImage(response["thumbnailBase64"])

        XCTAssertEqual(original.width, 1440)
        XCTAssertEqual(original.height, 900)
        XCTAssertEqual(response["width"] as? Int, original.width)
        XCTAssertEqual(response["height"] as? Int, original.height)
        XCTAssertEqual(thumbnail.width, 480)
        XCTAssertEqual(thumbnail.height, 300)
        XCTAssertEqual(response["thumbnailWidth"] as? Int, thumbnail.width)
        XCTAssertEqual(response["thumbnailHeight"] as? Int, thumbnail.height)
        XCTAssertNotEqual(response["imageBase64"] as? String, response["thumbnailBase64"] as? String)

        let smallResponse = try MacPlatformScreenshotResponse.make(image: makeImage(width: 120, height: 80), target: nil)
        let smallThumbnail = try decodeImage(smallResponse["thumbnailBase64"])
        XCTAssertEqual(smallThumbnail.width, 120)
        XCTAssertEqual(smallThumbnail.height, 80)
    }

    func testTextInputProducesCompleteUnicodeKeyboardEvents() throws {
        let text = "已有内容之后输入：012345678🙂新的内容🙂需要分段发送"
        let events = try MacPlatformKeyboard.textEvents(text)
        XCTAssertGreaterThan(events.count, 2)
        XCTAssertEqual(events.count % 2, 0)
        var inserted = ""

        for index in stride(from: 0, to: events.count, by: 2) {
            let down = events[index]
            let up = events[index + 1]
            XCTAssertEqual(down.type, .keyDown)
            XCTAssertEqual(up.type, .keyUp)
            XCTAssertTrue(down.flags.isEmpty)
            let downText = MacPlatformKeyboard.text(from: down)
            XCTAssertEqual(downText, MacPlatformKeyboard.text(from: up))
            inserted += try XCTUnwrap(downText)
        }

        XCTAssertEqual(inserted, text)
    }

    func testHotkeyPreservesTheKeyAndModifiers() throws {
        let hotkey = try MacPlatformHotkey.parse("command+shift+a")
        let arrayHotkey = try MacPlatformHotkey.parse(["command", "shift", "a"])
        XCTAssertEqual(hotkey, arrayHotkey)
        XCTAssertEqual(hotkey.keyCode, CGKeyCode(kVK_ANSI_A))
        XCTAssertEqual(hotkey.modifiers, [.maskCommand, .maskShift])
    }

    func testNativeErrorsPreserveReadableMessagesAcrossTheModuleBoundary() {
        let error = PlatformBridgeError(code: "action_failed", message: "Target app did not become active")
        XCTAssertEqual(error.localizedDescription, "action_failed: Target app did not become active")
        XCTAssertEqual(error.code, "action_failed")
    }

    private func makeImage(width: Int, height: Int) throws -> CGImage {
        let context = try XCTUnwrap(CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ))
        context.setFillColor(CGColor(red: 0.1, green: 0.6, blue: 0.2, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width / 2, height: height))
        context.setFillColor(CGColor(red: 0.8, green: 0.2, blue: 0.5, alpha: 1))
        context.fill(CGRect(x: width / 2, y: 0, width: width / 2, height: height))
        return try XCTUnwrap(context.makeImage())
    }

    private func decodeImage(_ value: Any?) throws -> CGImage {
        let base64 = try XCTUnwrap(value as? String)
        let data = try XCTUnwrap(Data(base64Encoded: base64))
        let source = try XCTUnwrap(CGImageSourceCreateWithData(data as CFData, nil))
        return try XCTUnwrap(CGImageSourceCreateImageAtIndex(source, 0, nil))
    }
}
