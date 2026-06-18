import Foundation

private struct ChromeBookmarksSnapshot: Equatable {
    let fingerprintsByFolderId: [String: String]
}

final class ChromeBookmarksAgentTriggerProvider: AgentTriggerProvider {
    let kind = "chrome.bookmarks"

    private let fileManager: FileManager
    private let homeDirectoryURL: URL
    private let pollInterval: Duration
    private let queue = DispatchQueue(label: "handagent.agent-trigger.chrome-bookmarks")
    private var pollingTimer: DispatchSourceTimer?
    private var lastSnapshotsByInstanceId: [String: ChromeBookmarksSnapshot] = [:]
    private var emit: ((AgentTriggerEvent) -> Void)?
    private(set) var instances: [AgentTriggerInstance] = []

    init(
        homeDirectoryURL: URL = FileManager.default.homeDirectoryForCurrentUser,
        fileManager: FileManager = .default,
        pollInterval: Duration = .milliseconds(250)
    ) {
        self.homeDirectoryURL = homeDirectoryURL
        self.fileManager = fileManager
        self.pollInterval = pollInterval
    }

    func start(
        instances: [AgentTriggerInstance],
        emit: @escaping (AgentTriggerEvent) -> Void
    ) throws {
        queue.sync {
            self.instances = instances
            self.emit = emit
            self.lastSnapshotsByInstanceId = [:]
            self.pollingTimer?.cancel()
            self.refreshSnapshots(instances: instances, emitOnlyWhenChanged: false)
        }

        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now() + durationToDispatchInterval(pollInterval), repeating: durationToDispatchInterval(pollInterval))
        timer.setEventHandler { [weak self] in
            self?.refreshSnapshots(instances: instances, emitOnlyWhenChanged: true)
        }
        timer.resume()
        queue.sync {
            self.pollingTimer = timer
        }
    }

    func stop() throws {
        queue.sync {
            self.pollingTimer?.cancel()
            self.pollingTimer = nil
            self.emit = nil
            self.lastSnapshotsByInstanceId = [:]
            self.instances = []
        }
    }

    private func refreshSnapshots(
        instances: [AgentTriggerInstance],
        emitOnlyWhenChanged: Bool
    ) {
        let current = readCurrentSnapshots()
        guard let emit else { return }
        for instance in instances where instance.enabled {
            let selectedFolderIds = instance.folderIds
            guard !selectedFolderIds.isEmpty else { continue }
            let fingerprint = current.snapshot(for: selectedFolderIds)
            let previous = lastSnapshotsByInstanceId[instance.id]
            lastSnapshotsByInstanceId[instance.id] = fingerprint

            guard emitOnlyWhenChanged, previous != nil, previous != fingerprint else {
                continue
            }

            emit(
                AgentTriggerEvent(
                    triggerInstanceId: instance.id,
                    providerKind: kind,
                    occurredAt: ISO8601DateFormatter().string(from: Date()),
                    summary: "Chrome bookmarks changed for \(selectedFolderIds.joined(separator: ", "))",
                    payload: [
                        "folderIds": .stringList(selectedFolderIds),
                        "profileRoots": .stringList(current.profilePaths)
                    ]
                )
            )
        }
    }

    private func readCurrentSnapshots() -> ChromeBookmarksSnapshotReader {
        let roots = chromeBookmarkRoots()
        var fingerprintsByFolderId: [String: String] = [:]
        for root in roots {
            guard let data = try? Data(contentsOf: root),
                  let file = try? JSONDecoder().decode(ChromeBookmarksFile.self, from: data) else {
                continue
            }
            let folders = file.allFolders()
            for folder in folders {
                guard let folderId = folder.id else { continue }
                fingerprintsByFolderId[folderId] = folder.fingerprint()
            }
        }
        return ChromeBookmarksSnapshotReader(
            profilePaths: roots.map { $0.deletingLastPathComponent().path },
            fingerprintsByFolderId: fingerprintsByFolderId
        )
    }

    private func chromeBookmarkRoots() -> [URL] {
        let chromeRoot = homeDirectoryURL
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("Application Support", isDirectory: true)
            .appendingPathComponent("Google", isDirectory: true)
            .appendingPathComponent("Chrome", isDirectory: true)

        guard let enumerator = fileManager.enumerator(
            at: chromeRoot,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        var result: [URL] = []
        for case let url as URL in enumerator {
            if url.lastPathComponent == "Bookmarks" {
                result.append(url)
                enumerator.skipDescendants()
            }
        }
        return result
    }
}

private func durationToDispatchInterval(_ duration: Duration) -> DispatchTimeInterval {
    let components = duration.components
    let seconds = components.seconds
    let attoseconds = components.attoseconds
    let nanosecondsFromAttoseconds = Int(attoseconds / 1_000_000_000)
    let totalNanoseconds = seconds * 1_000_000_000 + Int64(nanosecondsFromAttoseconds)
    return .nanoseconds(max(1, Int(totalNanoseconds)))
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

private struct ChromeBookmarksSnapshotReader {
    let profilePaths: [String]
    let fingerprintsByFolderId: [String: String]

    func snapshot(for folderIds: [String]) -> ChromeBookmarksSnapshot {
        ChromeBookmarksSnapshot(
            fingerprintsByFolderId: Dictionary(
                uniqueKeysWithValues: folderIds.map { folderId in
                    (folderId, fingerprintsByFolderId[folderId] ?? "")
                }
            )
        )
    }
}

private struct ChromeBookmarksFile: Decodable {
    let roots: ChromeBookmarksRoots

    func allFolders() -> [ChromeBookmarksNode] {
        roots.allFolders()
    }
}

private struct ChromeBookmarksRoots: Decodable {
    let bookmark_bar: ChromeBookmarksNode?
    let other: ChromeBookmarksNode?
    let synced: ChromeBookmarksNode?

    func allFolders() -> [ChromeBookmarksNode] {
        [bookmark_bar, other, synced].compactMap { $0 }.flatMap { $0.allFolders() }
    }
}

private struct ChromeBookmarksNode: Decodable {
    let id: String?
    let type: String?
    let name: String?
    let url: String?
    let children: [ChromeBookmarksNode]?

    func allFolders() -> [ChromeBookmarksNode] {
        guard type == "folder" else { return [] }
        return [self] + (children ?? []).flatMap { $0.allFolders() }
    }

    func fingerprint() -> String {
        let childFingerprints = (children ?? []).flatMap { $0.allBookmarkFingerprints() }.sorted()
        return [
            id ?? "",
            name ?? "",
            url ?? "",
            childFingerprints.joined(separator: "|"),
        ].joined(separator: "::")
    }

    func allBookmarkFingerprints() -> [String] {
        if let url, type == "url" {
            return [url]
        }
        return (children ?? []).flatMap { $0.allBookmarkFingerprints() }
    }
}
