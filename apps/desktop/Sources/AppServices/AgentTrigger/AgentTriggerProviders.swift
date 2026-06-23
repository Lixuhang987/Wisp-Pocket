import Foundation

final class ChromeBookmarksAgentTriggerProvider: AgentTriggerProvider {
    let kind = "chrome.bookmarks"

    private let eventSource: any ChromeBookmarksExtensionEventSource
    private let queue = DispatchQueue(label: "handagent.agent-trigger.chrome-bookmarks")
    private var emit: ((AgentTriggerEvent) -> Void)?
    private(set) var instances: [AgentTriggerInstance] = []

    init(
        eventSource: any ChromeBookmarksExtensionEventSource = ChromeBookmarksExtensionBridgeServer()
    ) {
        self.eventSource = eventSource
    }

    func start(
        instances: [AgentTriggerInstance],
        emit: @escaping (AgentTriggerEvent) -> Void
    ) throws {
        queue.sync {
            self.instances = instances
            self.emit = emit
        }
        try eventSource.start { [weak self] event in
            self?.handle(event)
        }
    }

    func stop() throws {
        try eventSource.stop()
        queue.sync {
            self.emit = nil
            self.instances = []
        }
    }

    private func handle(_ event: ChromeBookmarksExtensionEvent) {
        queue.async {
            guard event.type == "handagent.bookmarks.created",
                  event.protocolVersion == 1,
                  let parentId = event.parentId,
                  let title = event.title,
                  let url = event.url,
                  let profileId = event.profileId,
                  let occurredAt = event.occurredAt,
                  !url.isEmpty,
                  let emit = self.emit else {
                return
            }

            for instance in self.instances where instance.enabled && instance.folderIds.contains(parentId) {
                emit(
                    AgentTriggerEvent(
                        triggerInstanceId: instance.id,
                        providerKind: self.kind,
                        occurredAt: occurredAt,
                        summary: "Chrome bookmark created: \(title)",
                        payload: [
                            "url": .string(url),
                            "title": .string(title),
                            "folderId": .string(parentId),
                            "bookmarkId": .string(event.bookmarkId ?? ""),
                            "profileId": .string(profileId)
                        ]
                    )
                )
            }
        }
    }
}

struct ChromeBookmarksAgentTriggerProviderFactory: AgentTriggerProviderFactory {
    func descriptor() -> AgentTriggerProviderDescriptor {
        AgentTriggerProviderDescriptor(
            kind: "chrome.bookmarks",
            displayName: "Chrome Bookmarks"
        )
    }

    func createHostProvider() -> any AgentTriggerProvider {
        ChromeBookmarksAgentTriggerProvider()
    }
}

protocol AgentTriggerClock {
    var now: Date { get }
    @discardableResult
    func schedule(at date: Date, _ callback: @escaping () -> Void) -> any AgentTriggerScheduledTask
}

protocol AgentTriggerScheduledTask {
    func cancel()
}

final class SystemClockAgentTriggerProvider: AgentTriggerProvider {
    let kind = "system.clock"

    private let clock: any AgentTriggerClock
    private let calendar: Calendar
    private var scheduledTasks: [any AgentTriggerScheduledTask] = []
    private(set) var instances: [AgentTriggerInstance] = []

    init(
        clock: any AgentTriggerClock,
        calendar: Calendar = .current
    ) {
        self.clock = clock
        self.calendar = calendar
    }

    func start(
        instances: [AgentTriggerInstance],
        emit: @escaping (AgentTriggerEvent) -> Void
    ) throws {
        try stop()
        self.instances = instances

        for instance in instances where instance.enabled {
            for timePoint in instance.configSchedulePoints {
                let nextDate = try nextScheduledDate(for: timePoint, timezoneIdentifier: instance.configTimezoneIdentifier)
                let task = clock.schedule(at: nextDate) { [kind] in
                    emit(
                        AgentTriggerEvent(
                            triggerInstanceId: instance.id,
                            providerKind: kind,
                            occurredAt: ISO8601DateFormatter().string(from: nextDate),
                            summary: "\(instance.title) at \(timePoint)",
                            payload: instance.config
                        )
                    )
                }
                scheduledTasks.append(task)
            }
        }
    }

    func stop() throws {
        for task in scheduledTasks {
            task.cancel()
        }
        scheduledTasks.removeAll()
        instances = []
    }

    private func nextScheduledDate(for timePoint: String, timezoneIdentifier: String?) throws -> Date {
        let parts = timePoint.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]) else {
            throw AgentTriggerClockProviderError.invalidSchedulePoint(timePoint)
        }

        var calendar = calendar
        if let timezoneIdentifier,
           let timezone = TimeZone(identifier: timezoneIdentifier) {
            calendar.timeZone = timezone
        }
        var components = calendar.dateComponents([.year, .month, .day], from: clock.now)
        components.hour = hour
        components.minute = minute
        components.second = 0
        let sameDay = calendar.date(from: components)
        guard let candidate = sameDay else {
            throw AgentTriggerClockProviderError.invalidSchedulePoint(timePoint)
        }
        if candidate > clock.now {
            return candidate
        }
        guard let nextDay = calendar.date(byAdding: .day, value: 1, to: candidate) else {
            throw AgentTriggerClockProviderError.invalidSchedulePoint(timePoint)
        }
        return nextDay
    }
}

enum AgentTriggerClockProviderError: Error, Equatable {
    case invalidSchedulePoint(String)
}

struct SystemClockAgentTriggerProviderFactory: AgentTriggerProviderFactory {
    private let clock: any AgentTriggerClock
    private let calendar: Calendar

    init(
        clock: any AgentTriggerClock = DefaultAgentTriggerClock(),
        calendar: Calendar = .current
    ) {
        self.clock = clock
        self.calendar = calendar
    }

    func descriptor() -> AgentTriggerProviderDescriptor {
        AgentTriggerProviderDescriptor(
            kind: "system.clock",
            displayName: "System Clock"
        )
    }

    func createHostProvider() -> any AgentTriggerProvider {
        SystemClockAgentTriggerProvider(clock: clock, calendar: calendar)
    }
}

struct DefaultAgentTriggerClock: AgentTriggerClock {
    var now: Date { Date() }

    func schedule(at date: Date, _ callback: @escaping () -> Void) -> any AgentTriggerScheduledTask {
        let delay = max(0, date.timeIntervalSinceNow)
        let workItem = DispatchWorkItem {
            callback()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
        return DispatchWorkItemScheduledTask(workItem: workItem)
    }
}

struct DispatchWorkItemScheduledTask: AgentTriggerScheduledTask {
    let workItem: DispatchWorkItem

    func cancel() {
        workItem.cancel()
    }
}

private extension AgentTriggerInstance {
    var configSchedulePoints: [String] {
        switch config["scheduleAt"] {
        case .string(let value):
            return [value]
        case .stringList(let values):
            return values
        case nil:
            return []
        }
    }

    var configTimezoneIdentifier: String? {
        switch config["timezone"] {
        case .string(let value):
            return value
        default:
            return nil
        }
    }

    var folderIds: [String] {
        switch config["folderIds"] {
        case .stringList(let values):
            return values
        case .string(let value):
            return [value]
        default:
            return []
        }
    }
}
