import Foundation
import Observation

@MainActor
@Observable
public final class ContextHistoryModule {
    public private(set) var isRunning = false
    public private(set) var lastErrorMessage: String?
    public private(set) var lastSampleAt: Date?

    @ObservationIgnored private let scheduler: ContextHistorySamplingScheduler
    @ObservationIgnored private let router: ContextHistoryToolRouter
    @ObservationIgnored private let pollingInterval: Duration
    @ObservationIgnored private var pollingTask: Task<Void, Never>?
    @ObservationIgnored private var sampleTask: Task<ContextHistorySamplingTickResult, Error>?
    @ObservationIgnored private var samplingID: UUID?

    public init(store: ContextHistoryStore, host: any HostAutomationCapabilities, pollingInterval: Duration = .seconds(5)) {
        let collector = ContextHistoryCollector(store: store, host: host)
        scheduler = ContextHistorySamplingScheduler(collector: collector)
        router = ContextHistoryToolRouter(store: store)
        self.pollingInterval = pollingInterval
    }

    deinit {
        pollingTask?.cancel()
        sampleTask?.cancel()
    }

    public func start() {
        guard !isRunning else { return }
        isRunning = true
        scheduler.reset()
        let interval = pollingInterval
        pollingTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                do {
                    try await Task.sleep(for: interval)
                } catch {
                    return
                }
                guard let self, self.isRunning else { return }
                await self.sample(now: Date())
            }
        }
    }

    public func stop() {
        isRunning = false
        pollingTask?.cancel()
        pollingTask = nil
        sampleTask?.cancel()
        sampleTask = nil
        samplingID = nil
    }

    /// Uses the same scheduler as the production polling task; only the time boundary is supplied.
    public func sample(now: Date) async {
        guard isRunning, sampleTask == nil, !Task.isCancelled else { return }
        let id = UUID()
        let scheduler = scheduler
        let task = Task { @MainActor in try await scheduler.tick(now: now) }
        samplingID = id
        sampleTask = task
        defer {
            if samplingID == id {
                sampleTask = nil
                samplingID = nil
            }
        }
        do {
            _ = try await withTaskCancellationHandler {
                try await task.value
            } onCancel: {
                task.cancel()
            }
            guard isRunning, samplingID == id else { return }
            lastSampleAt = now
            lastErrorMessage = nil
        } catch is CancellationError {
            // A disabled or stopped module must not publish stale state from its previous session.
        } catch {
            guard isRunning, samplingID == id else { return }
            lastErrorMessage = error.localizedDescription
        }
    }

    public func handle(tool: String, arguments: Any?) -> DynamicToolResult {
        router.handle(tool: tool, arguments: arguments, collectionStatus: [
            "isRunning": isRunning,
            "lastSampleAt": lastSampleAt.map { contextHistoryTimestamp($0) as Any } ?? NSNull(),
            "lastErrorMessage": lastErrorMessage.map { $0 as Any } ?? NSNull(),
        ])
    }
}
