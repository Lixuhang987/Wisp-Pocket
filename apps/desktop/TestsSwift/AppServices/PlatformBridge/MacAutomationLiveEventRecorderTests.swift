import CoreGraphics
import XCTest
@testable import HandAgentDesktop

final class MacAutomationLiveEventRecorderTests: XCTestCase {
    @MainActor
    func testRecordingSessionsShareSourceAndLastStopReleasesIt() throws {
        let source = TestMacAutomationEventSource()
        let recorder = MacAutomationLiveEventRecorder(makeEventSource: { source })
        try recorder.start(recordingId: "first")
        try recorder.start(recordingId: "second")
        XCTAssertEqual(source.startCount, 1)

        let click = try XCTUnwrap(CGEvent(
            mouseEventSource: nil, mouseType: .rightMouseDown,
            mouseCursorPosition: CGPoint(x: 71.5, y: 113), mouseButton: .right
        ))
        click.timestamp = UInt64((ProcessInfo.processInfo.systemUptime - 2) * 1_000_000_000)
        let expectedTime = Date().addingTimeInterval(-2)
        source.emit(type: .rightMouseDown, event: click)

        let first = try recorder.stop(recordingId: "first")
        XCTAssertEqual(source.stopCount, 0)
        XCTAssertEqual(first.count, 1)
        XCTAssertEqual(first.first?["kind"] as? String, "click")
        XCTAssertEqual(first.first?["button"] as? String, "right")
        XCTAssertEqual((first.first?["position"] as? [String: Double])?["x"], 71.5)
        let timestamp = try XCTUnwrap(first.first?["timestamp"] as? String)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let recordedTime = try XCTUnwrap(formatter.date(from: timestamp))
        XCTAssertEqual(recordedTime.timeIntervalSince1970, expectedTime.timeIntervalSince1970, accuracy: 0.1)

        source.emit(type: .rightMouseDown, event: click)
        let second = try recorder.stop(recordingId: "second")
        XCTAssertEqual(second.count, 2)
        XCTAssertEqual(source.stopCount, 1)
        XCTAssertNil(source.receive)

        try recorder.start(recordingId: "third")
        XCTAssertEqual(source.startCount, 2)
        XCTAssertTrue(try recorder.stop(recordingId: "third").isEmpty)
        XCTAssertEqual(source.stopCount, 2)
    }

    @MainActor
    func testFailedStartupRollsBackAndCanBeRetried() throws {
        let source = TestMacAutomationEventSource()
        source.startError = PlatformBridgeError(code: "permission_denied", message: "Event tap denied")
        let recorder = MacAutomationLiveEventRecorder(makeEventSource: { source })

        XCTAssertThrowsError(try recorder.start(recordingId: "retry")) { error in
            XCTAssertEqual(error.localizedDescription, "permission_denied: Event tap denied")
        }
        XCTAssertEqual(source.stopCount, 1)
        source.startError = nil
        try recorder.start(recordingId: "retry")
        XCTAssertTrue(try recorder.stop(recordingId: "retry").isEmpty)
        XCTAssertEqual(source.stopCount, 2)
    }

    @MainActor
    func testRecordedKeyboardEventsPreserveTextAndReplayableHotkeys() throws {
        let source = TestMacAutomationEventSource()
        let recorder = MacAutomationLiveEventRecorder(makeEventSource: { source })
        try recorder.start(recordingId: "keyboard")
        let textEvent = try XCTUnwrap(MacPlatformKeyboard.textEvents("输入🙂").first)
        source.emit(type: .keyDown, event: textEvent)
        let hotkey = try MacPlatformHotkey.parse("command+shift+a")
        let hotkeyEvent = try XCTUnwrap(MacPlatformKeyboard.hotkeyEvents(hotkey).first)
        source.emit(type: .keyDown, event: hotkeyEvent)

        let events = try recorder.stop(recordingId: "keyboard")
        XCTAssertEqual(events.count, 2)
        XCTAssertEqual(events[0]["kind"] as? String, "typeText")
        XCTAssertEqual(events[0]["text"] as? String, "输入🙂")
        XCTAssertEqual(events[1]["kind"] as? String, "hotkey")
        XCTAssertEqual(try MacPlatformHotkey.parse(events[1]["keys"]), hotkey)
    }

    @MainActor
    func testStopAllAndReleaseCloseTheEventSource() throws {
        let source = TestMacAutomationEventSource()
        var recorder: MacAutomationLiveEventRecorder? = MacAutomationLiveEventRecorder(makeEventSource: { source })
        try recorder?.start(recordingId: "first")
        try recorder?.start(recordingId: "second")
        recorder?.stopAll()
        XCTAssertEqual(source.stopCount, 1)

        try recorder?.start(recordingId: "after-stop-all")
        recorder = nil
        XCTAssertEqual(source.stopCount, 2)
    }
}

private final class TestMacAutomationEventSource: MacAutomationEventSource, @unchecked Sendable {
    var startCount = 0
    var stopCount = 0
    var startError: Error?
    var receive: (@Sendable (CGEventType, CGEvent) -> Void)?

    func start(receive: @escaping @Sendable (CGEventType, CGEvent) -> Void) throws {
        startCount += 1
        if let startError { throw startError }
        self.receive = receive
    }

    func stop() {
        stopCount += 1
        receive = nil
    }

    func emit(type: CGEventType, event: CGEvent) {
        receive?(type, event)
    }
}
