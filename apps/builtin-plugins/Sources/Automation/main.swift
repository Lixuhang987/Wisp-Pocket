import Foundation
import ApplicationServices
import HandAgentPluginSupport

let directory = ProcessInfo.processInfo.environment["HANDAGENT_AUTOMATION_DIR"]
    .map { URL(fileURLWithPath: $0, isDirectory: true) }
    ?? FileManager.default
    .homeDirectoryForCurrentUser
    .appendingPathComponent(".spotAgent/automation", isDirectory: true)

final class PolicyPatchAutomationRepairer: AutomationRepairing {
    private let requestStore: AutomationRepairRequestStore

    init(requestStore: AutomationRepairRequestStore) {
        self.requestStore = requestStore
    }

    func repair(request: AutomationRepairRequest) async throws -> AutomationRepairResult {
        var evidence = try requestStore.saveRepairRequest(request)
        evidence["fallback"] = "policy-branch"
        return AutomationRepairResult(
            branch: AutomationBranch(
                id: "\(request.policy.id):repair:\(UUID().uuidString)",
                steps: [request.failedStep],
                assertions: []
            ),
            evidence: evidence
        )
    }
}

final class MacAutomationLiveEventRecorder: AutomationLiveEventRecording, @unchecked Sendable {
    private let lock = NSLock()
    private var eventsByRecordingId: [String: [[String: Any]]] = [:]
    private var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private var runLoop: CFRunLoop?
    private var eventThread: Thread?

    func start(recordingId: String) throws {
        lock.lock()
        eventsByRecordingId[recordingId] = []
        let needsTap = eventTap == nil
        lock.unlock()

        if needsTap {
            do {
                try startEventTap()
            } catch {
                lock.lock()
                eventsByRecordingId.removeValue(forKey: recordingId)
                lock.unlock()
                throw error
            }
        }
    }

    func stop(recordingId: String) throws -> [[String: Any]] {
        lock.lock()
        let events = eventsByRecordingId.removeValue(forKey: recordingId) ?? []
        lock.unlock()
        return events
    }

    fileprivate func record(type: CGEventType, event: CGEvent) {
        guard let recorded = recordedEvent(type: type, event: event) else { return }
        lock.lock()
        guard !eventsByRecordingId.isEmpty else {
            lock.unlock()
            return
        }
        for recordingId in Array(eventsByRecordingId.keys) {
            eventsByRecordingId[recordingId, default: []].append(recorded)
        }
        lock.unlock()
    }

    private func startEventTap() throws {
        let startup = StartupResult()
        let thread = Thread { [weak self] in
            guard let self else {
                startup.finish(.failure(Self.error("live recorder was released")))
                return
            }
            let mask = Self.eventMask([
                .leftMouseDown,
                .rightMouseDown,
                .otherMouseDown,
                .keyDown,
            ])
            guard let tap = CGEvent.tapCreate(
                tap: .cgSessionEventTap,
                place: .headInsertEventTap,
                options: .listenOnly,
                eventsOfInterest: mask,
                callback: automationEventTapCallback,
                userInfo: Unmanaged.passUnretained(self).toOpaque()
            ) else {
                startup.finish(.failure(Self.error("macOS event tap could not be created")))
                return
            }
            guard let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0) else {
                startup.finish(.failure(Self.error("macOS event tap run loop source could not be created")))
                return
            }
            let currentRunLoop = CFRunLoopGetCurrent()
            self.lock.lock()
            self.eventTap = tap
            self.runLoopSource = source
            self.runLoop = currentRunLoop
            self.lock.unlock()

            CFRunLoopAddSource(currentRunLoop, source, .commonModes)
            CGEvent.tapEnable(tap: tap, enable: true)
            startup.finish(.success(()))
            CFRunLoopRun()
        }
        eventThread = thread
        thread.start()
        try startup.wait().get()
    }

    private func recordedEvent(type: CGEventType, event: CGEvent) -> [String: Any]? {
        switch type {
        case .leftMouseDown, .rightMouseDown, .otherMouseDown:
            let location = event.location
            return [
                "kind": "click",
                "source": "macos_event_tap",
                "button": mouseButtonName(type),
                "position": [
                    "x": location.x,
                    "y": location.y,
                ],
            ]
        case .keyDown:
            let flags = event.flags
            let modifiers = modifierNames(flags)
            let key = keyText(from: event)
            if !modifiers.isEmpty {
                return [
                    "kind": "hotkey",
                    "source": "macos_event_tap",
                    "keys": modifiers + [key ?? "keyCode:\(event.getIntegerValueField(.keyboardEventKeycode))"],
                ]
            }
            guard let key, !key.isEmpty else { return nil }
            return [
                "kind": "typeText",
                "source": "macos_event_tap",
                "text": key,
            ]
        default:
            return nil
        }
    }

    private func keyText(from event: CGEvent) -> String? {
        var length = 0
        var chars = [UniChar](repeating: 0, count: 8)
        chars.withUnsafeMutableBufferPointer { buffer in
            event.keyboardGetUnicodeString(
                maxStringLength: buffer.count,
                actualStringLength: &length,
                unicodeString: buffer.baseAddress
            )
        }
        guard length > 0 else { return nil }
        return String(utf16CodeUnits: chars, count: length)
    }

    private func modifierNames(_ flags: CGEventFlags) -> [String] {
        var names: [String] = []
        if flags.contains(.maskCommand) { names.append("command") }
        if flags.contains(.maskControl) { names.append("control") }
        if flags.contains(.maskAlternate) { names.append("option") }
        if flags.contains(.maskShift) { names.append("shift") }
        return names
    }

    private func mouseButtonName(_ type: CGEventType) -> String {
        switch type {
        case .rightMouseDown:
            return "right"
        case .otherMouseDown:
            return "other"
        default:
            return "left"
        }
    }

    private static func eventMask(_ types: [CGEventType]) -> CGEventMask {
        types.reduce(CGEventMask(0)) { mask, type in
            mask | (CGEventMask(1) << CGEventMask(type.rawValue))
        }
    }

    private static func error(_ message: String) -> NSError {
        NSError(
            domain: "HandAgentAutomationLiveEventRecorder",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: message]
        )
    }
}

private final class StartupResult: @unchecked Sendable {
    private let semaphore = DispatchSemaphore(value: 0)
    private let lock = NSLock()
    private var result: Result<Void, Error>?

    func finish(_ result: Result<Void, Error>) {
        lock.lock()
        self.result = result
        lock.unlock()
        semaphore.signal()
    }

    func wait() -> Result<Void, Error> {
        semaphore.wait()
        lock.lock()
        defer { lock.unlock() }
        return result ?? .failure(NSError(
            domain: "HandAgentAutomationLiveEventRecorder",
            code: 2,
            userInfo: [NSLocalizedDescriptionKey: "macOS event tap startup did not report a result"]
        ))
    }
}

nonisolated(unsafe) private let automationEventTapCallback: CGEventTapCallBack = { _, type, event, userInfo in
    guard let userInfo else {
        return Unmanaged.passUnretained(event)
    }
    let recorder = Unmanaged<MacAutomationLiveEventRecorder>
        .fromOpaque(userInfo)
        .takeUnretainedValue()
    recorder.record(type: type, event: event)
    return Unmanaged.passUnretained(event)
}

let store = AutomationStore(directoryURL: directory)
let capabilityClient = LocalManifestPluginPeerClient()
let liveRecorder = MacAutomationLiveEventRecorder()
let runtime = AutomationRuntime(
    store: store,
    capabilityClient: capabilityClient,
    repairer: PolicyPatchAutomationRepairer(requestStore: AutomationRepairRequestStore(store: store))
)
let router = AutomationToolRouter(
    store: store,
    runtime: runtime,
    recorder: AutomationRecordingService(
        capabilityClient: capabilityClient,
        liveRecorder: liveRecorder
    )
)

runLineDelimitedPluginServer { namespace, tool, arguments in
    await router.handle(namespace: namespace, tool: tool, arguments: arguments)
}
