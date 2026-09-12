import Foundation
import Observation

@Observable
@MainActor
public final class AutomationModule {
    public private(set) var isEnabled = false
    public private(set) var isBusy = false
    @ObservationIgnored private let recorder: AutomationRecordingService
    @ObservationIgnored private let router: AutomationToolRouter
    @ObservationIgnored private var operation: Task<DynamicToolResult, Never>?

    public init(store: AutomationStore, host: any HostAutomationCapabilities, liveRecorder: (any AutomationLiveEventRecording)? = nil) {
        recorder = AutomationRecordingService(host: host, liveRecorder: liveRecorder)
        router = AutomationToolRouter(store: store, runtime: AutomationRuntime(store: store, host: host), recorder: recorder)
    }

    public func start() {
        isEnabled = true
    }

    public func stop() {
        isEnabled = false
        operation?.cancel()
        recorder.stopAll()
    }

    public func handle(tool: String, arguments: Any?) async -> DynamicToolResult {
        guard isEnabled else { return .text("automation is disabled", success: false) }
        guard !isBusy else { return .text("automation is busy; wait for the current operation", success: false) }
        isBusy = true
        let task = Task { @MainActor [router] in
            await router.handle(namespace: "automation", tool: tool, arguments: arguments)
        }
        operation = task
        let result = await task.value
        operation = nil
        isBusy = false
        return result
    }
}
