import CoreGraphics
import Foundation
import HandAgentHostAutomation

@MainActor
final class MacAutomationLiveEventRecorder: AutomationLiveEventRecording {
    private let makeEventSource: () -> any MacAutomationEventSource
    private let recordings = MacAutomationRecordedEvents()
    private var eventSource: (any MacAutomationEventSource)?

    init(makeEventSource: @escaping () -> any MacAutomationEventSource = { MacAutomationEventTap() }) {
        self.makeEventSource = makeEventSource
    }

    deinit {
        eventSource?.stop()
    }

    func start(recordingId: String) throws {
        try recordings.begin(recordingId)
        guard eventSource == nil else { return }
        let source = makeEventSource()
        do {
            try source.start { [recordings] type, event in
                recordings.append(type: type, event: event)
            }
            eventSource = source
        } catch {
            source.stop()
            _ = try? recordings.finish(recordingId)
            throw error
        }
    }

    func stop(recordingId: String) throws -> [[String: Any]] {
        try recordings.requireRecording(recordingId)
        if recordings.count == 1 {
            // Drain the source before removing the last buffer, so its final
            // callback cannot outlive the recording or lose an in-flight event.
            eventSource?.stop()
            eventSource = nil
        }
        return try recordings.finish(recordingId)
    }

    func stopAll() {
        eventSource?.stop()
        eventSource = nil
        recordings.clear()
    }
}

protocol MacAutomationEventSource: AnyObject, Sendable {
    func start(receive: @escaping @Sendable (CGEventType, CGEvent) -> Void) throws
    func stop()
}

private final class MacAutomationRecordedEvents: @unchecked Sendable {
    private let lock = NSLock()
    private var eventsByRecordingId: [String: [[String: Any]]] = [:]

    var count: Int {
        lock.lock()
        defer { lock.unlock() }
        return eventsByRecordingId.count
    }

    func begin(_ recordingId: String) throws {
        lock.lock()
        defer { lock.unlock() }
        guard !recordingId.isEmpty, eventsByRecordingId[recordingId] == nil else {
            throw PlatformBridgeError(code: "invalid_argument", message: "Live recording id is empty or already active")
        }
        eventsByRecordingId[recordingId] = []
    }

    func requireRecording(_ recordingId: String) throws {
        lock.lock()
        defer { lock.unlock() }
        guard eventsByRecordingId[recordingId] != nil else {
            throw PlatformBridgeError(code: "not_found", message: "Live recording \(recordingId) is not active")
        }
    }

    func finish(_ recordingId: String) throws -> [[String: Any]] {
        lock.lock()
        defer { lock.unlock() }
        guard let events = eventsByRecordingId.removeValue(forKey: recordingId) else {
            throw PlatformBridgeError(code: "not_found", message: "Live recording \(recordingId) is not active")
        }
        return events
    }

    func clear() {
        lock.lock()
        eventsByRecordingId.removeAll()
        lock.unlock()
    }

    func append(type: CGEventType, event: CGEvent) {
        lock.lock()
        defer { lock.unlock() }
        guard !eventsByRecordingId.isEmpty, var recorded = recordedEvent(type: type, event: event) else { return }
        let eventTime = Date().addingTimeInterval(
            Double(event.timestamp) / 1_000_000_000 - ProcessInfo.processInfo.systemUptime
        )
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        recorded["timestamp"] = formatter.string(from: eventTime)
        recorded["source"] = "macos_event_tap"
        for recordingId in Array(eventsByRecordingId.keys) {
            eventsByRecordingId[recordingId, default: []].append(recorded)
        }
    }

    private func recordedEvent(type: CGEventType, event: CGEvent) -> [String: Any]? {
        switch type {
        case .leftMouseDown, .rightMouseDown, .otherMouseDown:
            let button = type == .rightMouseDown ? "right" : type == .otherMouseDown ? "other" : "left"
            return ["kind": "click", "button": button, "position": ["x": Double(event.location.x), "y": Double(event.location.y)]]
        case .keyDown:
            var modifiers: [String] = []
            if event.flags.contains(.maskCommand) { modifiers.append("command") }
            if event.flags.contains(.maskControl) { modifiers.append("control") }
            if event.flags.contains(.maskAlternate) { modifiers.append("option") }
            if event.flags.contains(.maskShift) { modifiers.append("shift") }
            let text = MacPlatformKeyboard.text(from: event)
            let containsControlKey = text?.unicodeScalars.contains {
                $0.value < 0x20 || $0.value == 0x7F || (0xF700...0xF8FF).contains($0.value)
            } ?? true
            if !modifiers.isEmpty || containsControlKey {
                let code = CGKeyCode(event.getIntegerValueField(.keyboardEventKeycode))
                return ["kind": "hotkey", "keys": modifiers + [MacPlatformKeyboard.keyName(for: code)]]
            }
            guard let text, !text.isEmpty else { return nil }
            return ["kind": "typeText", "text": text]
        default:
            return nil
        }
    }
}

private final class MacAutomationEventTap: MacAutomationEventSource, @unchecked Sendable {
    private let condition = NSCondition()
    private var receive: (@Sendable (CGEventType, CGEvent) -> Void)?
    private var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private var runLoop: CFRunLoop?
    private var eventThread: Thread?
    private var startupResult: Result<Void, Error>?
    private var stopping = false
    private var finished = false

    func start(receive: @escaping @Sendable (CGEventType, CGEvent) -> Void) throws {
        condition.lock()
        self.receive = receive
        condition.unlock()
        let mask = [CGEventType.leftMouseDown, .rightMouseDown, .otherMouseDown, .keyDown].reduce(CGEventMask(0)) {
            $0 | (CGEventMask(1) << CGEventMask($1.rawValue))
        }
        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap, place: .headInsertEventTap, options: .listenOnly,
            eventsOfInterest: mask, callback: macAutomationEventTapCallback,
            userInfo: Unmanaged.passUnretained(self).toOpaque()
        ) else {
            throw PlatformBridgeError(
                code: "permission_denied",
                message: "无法创建 macOS 用户事件录制。请在「系统设置 → 隐私与安全性」检查 Wisp Pocket 的辅助功能与输入监控权限。"
            )
        }
        guard let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0) else {
            CFMachPortInvalidate(tap)
            throw PlatformBridgeError(code: "recording_failed", message: "Cannot create the macOS event tap run loop source")
        }
        let thread = Thread { [self] in runEventLoop() }
        thread.name = "WispPocket.AutomationEventTap"
        condition.lock()
        eventTap = tap
        runLoopSource = source
        eventThread = thread
        condition.unlock()
        thread.start()

        condition.lock()
        while startupResult == nil { condition.wait() }
        let result = startupResult!
        condition.unlock()
        try result.get()
    }

    func stop() {
        condition.lock()
        stopping = true
        let tap = eventTap
        let loop = runLoop
        let thread = eventThread
        condition.unlock()

        if let tap { CGEvent.tapEnable(tap: tap, enable: false) }
        if let loop {
            CFRunLoopStop(loop)
            CFRunLoopWakeUp(loop)
        }
        condition.lock()
        if let thread, thread !== Thread.current {
            while !finished { condition.wait() }
        }
        receive = nil
        condition.unlock()
    }

    fileprivate func process(type: CGEventType, event: CGEvent) {
        condition.lock()
        let receive = stopping ? nil : receive
        let tap = stopping ? nil : eventTap
        condition.unlock()
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            if let tap { CGEvent.tapEnable(tap: tap, enable: true) }
            return
        }
        receive?(type, event)
    }

    private func runEventLoop() {
        condition.lock()
        guard let tap = eventTap, let source = runLoopSource else {
            startupResult = .failure(PlatformBridgeError(code: "recording_failed", message: "Event tap resources are missing"))
            finished = true
            condition.broadcast()
            condition.unlock()
            return
        }
        let loop = CFRunLoopGetCurrent()!
        runLoop = loop
        condition.unlock()
        defer {
            CGEvent.tapEnable(tap: tap, enable: false)
            CFRunLoopRemoveSource(loop, source, .commonModes)
            CFRunLoopSourceInvalidate(source)
            CFMachPortInvalidate(tap)
            condition.lock()
            eventTap = nil
            runLoopSource = nil
            runLoop = nil
            eventThread = nil
            receive = nil
            finished = true
            condition.broadcast()
            condition.unlock()
        }

        CFRunLoopAddSource(loop, source, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
        condition.lock()
        let enabled = !stopping && CGEvent.tapIsEnabled(tap: tap)
        startupResult = enabled ? .success(()) : .failure(
            PlatformBridgeError(code: "recording_failed", message: "macOS did not enable the event tap")
        )
        condition.broadcast()
        condition.unlock()
        guard enabled else { return }

        while shouldRun(tap: tap) {
            // A bounded run also handles a stop that arrived just before the
            // run loop entered its wait, without leaving a sleeping thread.
            CFRunLoopRunInMode(.defaultMode, 0.25, true)
        }
    }

    private func shouldRun(tap: CFMachPort) -> Bool {
        condition.lock()
        defer { condition.unlock() }
        return !stopping && CFMachPortIsValid(tap)
    }
}

private let macAutomationEventTapCallback: CGEventTapCallBack = { _, type, event, userInfo in
    if let userInfo {
        Unmanaged<MacAutomationEventTap>.fromOpaque(userInfo).takeUnretainedValue().process(type: type, event: event)
    }
    return Unmanaged.passUnretained(event)
}
