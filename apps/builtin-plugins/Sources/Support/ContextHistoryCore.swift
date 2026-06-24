import Foundation

public struct ContextHistoryActivitySample: Codable, Equatable {
    public var id: String
    public var timestamp: Date
    public var app: [String: String]
    public var window: [String: String]
    public var axSummaryId: String?
    public var thumbnailId: String?
}

public struct ContextHistoryScreenshotRecord: Codable, Equatable {
    public var id: String
    public var timestamp: Date
    public var originalBase64: String
    public var thumbnailBase64: String
    public var width: Int
    public var height: Int
    public var sampleId: String?
}

public protocol ContextHistoryCapabilityCalling {
    func call(namespace: String, tool: String, arguments: [String: Any]) async throws -> [String: Any]
}

public final class ContextHistoryStore: @unchecked Sendable {
    private let directoryURL: URL
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let fileManager: FileManager

    public init(directoryURL: URL, fileManager: FileManager = .default) {
        self.directoryURL = directoryURL
        self.fileManager = fileManager
        self.encoder = JSONEncoder()
        self.encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        self.encoder.dateEncodingStrategy = .iso8601
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
    }

    public func recordActivity(
        id: String = UUID().uuidString,
        timestamp: Date = Date(),
        app: [String: String],
        window: [String: String],
        axSummary: [String: Any]?
    ) throws -> ContextHistoryActivitySample {
        try ensureDirectories()
        let axSummaryId = try axSummary.map { summary in
            let id = UUID().uuidString
            try writeJSONObject(summary, to: axDirectoryURL.appendingPathComponent("\(id).json"))
            return id
        }
        let sample = ContextHistoryActivitySample(
            id: id,
            timestamp: timestamp,
            app: app,
            window: window,
            axSummaryId: axSummaryId,
            thumbnailId: nil
        )
        var samples = try loadActivities()
        samples.append(sample)
        samples = Array(samples.suffix(10_000))
        try saveActivities(samples)
        return sample
    }

    public func recordScreenshot(
        id: String = UUID().uuidString,
        timestamp: Date = Date(),
        originalBase64: String,
        thumbnailBase64: String,
        width: Int,
        height: Int,
        sampleId: String?
    ) throws -> ContextHistoryScreenshotRecord {
        try ensureDirectories()
        let screenshot = ContextHistoryScreenshotRecord(
            id: id,
            timestamp: timestamp,
            originalBase64: originalBase64,
            thumbnailBase64: thumbnailBase64,
            width: width,
            height: height,
            sampleId: sampleId
        )
        var screenshots = try loadScreenshots()
        screenshots.append(screenshot)
        screenshots = Array(screenshots.suffix(1_440))
        try saveScreenshots(screenshots)
        if let sampleId {
            var samples = try loadActivities()
            if let index = samples.firstIndex(where: { $0.id == sampleId }) {
                samples[index].thumbnailId = id
                try saveActivities(samples)
            }
        }
        return screenshot
    }

    public func activityIndex(limit: Int) throws -> [[String: Any]] {
        try loadActivities()
            .sorted { $0.timestamp > $1.timestamp }
            .prefix(max(0, limit))
            .map { sample in
                [
                    "id": sample.id,
                    "timestamp": iso8601(sample.timestamp),
                    "app": sample.app,
                    "window": sample.window,
                    "thumbnailId": sample.thumbnailId as Any,
                ]
            }
    }

    public func sampleDetails(ids: [String]) throws -> [[String: Any]] {
        let wanted = Set(ids)
        return try loadActivities()
            .filter { wanted.contains($0.id) }
            .map { sample in
                [
                    "id": sample.id,
                    "timestamp": iso8601(sample.timestamp),
                    "app": sample.app,
                    "window": sample.window,
                    "axSummary": loadAXSummary(id: sample.axSummaryId) as Any,
                    "thumbnailId": sample.thumbnailId as Any,
                ]
            }
    }

    public func thumbnails(limit: Int) throws -> [[String: Any]] {
        try loadScreenshots()
            .sorted { $0.timestamp > $1.timestamp }
            .prefix(max(0, limit))
            .map { screenshot in
                [
                    "id": screenshot.id,
                    "timestamp": iso8601(screenshot.timestamp),
                    "thumbnailBase64": screenshot.thumbnailBase64,
                    "width": screenshot.width,
                    "height": screenshot.height,
                    "sampleId": screenshot.sampleId as Any,
                ]
            }
    }

    public func screenshotOriginal(id: String) throws -> [String: Any]? {
        try loadScreenshots()
            .first { $0.id == id }
            .map { screenshot in
                [
                    "id": screenshot.id,
                    "timestamp": iso8601(screenshot.timestamp),
                    "imageBase64": screenshot.originalBase64,
                    "mimeType": "image/png",
                    "width": screenshot.width,
                    "height": screenshot.height,
                    "sampleId": screenshot.sampleId as Any,
                ]
            }
    }

    public func loadActivities() throws -> [ContextHistoryActivitySample] {
        try load([ContextHistoryActivitySample].self, from: activitiesURL, defaultValue: [])
    }

    public func loadScreenshots() throws -> [ContextHistoryScreenshotRecord] {
        try load([ContextHistoryScreenshotRecord].self, from: screenshotsURL, defaultValue: [])
    }

    private func ensureDirectories() throws {
        try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: axDirectoryURL, withIntermediateDirectories: true)
    }

    private func saveActivities(_ samples: [ContextHistoryActivitySample]) throws {
        try ensureDirectories()
        try encoder.encode(samples).write(to: activitiesURL, options: .atomic)
    }

    private func saveScreenshots(_ screenshots: [ContextHistoryScreenshotRecord]) throws {
        try ensureDirectories()
        try encoder.encode(screenshots).write(to: screenshotsURL, options: .atomic)
    }

    private func load<T: Decodable>(_ type: T.Type, from url: URL, defaultValue: T) throws -> T {
        guard fileManager.fileExists(atPath: url.path) else { return defaultValue }
        return try decoder.decode(type, from: Data(contentsOf: url))
    }

    private func writeJSONObject(_ object: [String: Any], to url: URL) throws {
        let data = try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: url, options: .atomic)
    }

    private func loadAXSummary(id: String?) -> [String: Any]? {
        guard let id,
              let data = try? Data(contentsOf: axDirectoryURL.appendingPathComponent("\(id).json")),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return object
    }

    private var activitiesURL: URL {
        directoryURL.appendingPathComponent("activities.json")
    }

    private var screenshotsURL: URL {
        directoryURL.appendingPathComponent("screenshots.json")
    }

    private var axDirectoryURL: URL {
        directoryURL.appendingPathComponent("ax", isDirectory: true)
    }
}

public final class ContextHistoryCollector: @unchecked Sendable {
    private let store: ContextHistoryStore
    private let capabilityClient: ContextHistoryCapabilityCalling

    public init(store: ContextHistoryStore, capabilityClient: ContextHistoryCapabilityCalling) {
        self.store = store
        self.capabilityClient = capabilityClient
    }

    public func collectActivitySample(now: Date = Date()) async throws -> ContextHistoryActivitySample {
        let frontmost = try await capabilityClient.call(
            namespace: "app_window",
            tool: "frontmost",
            arguments: [:]
        )
        return try await collectActivitySample(frontmost: frontmost, now: now)
    }

    func readFrontmost() async throws -> [String: Any] {
        try await capabilityClient.call(
            namespace: "app_window",
            tool: "frontmost",
            arguments: [:]
        )
    }

    func collectActivitySample(
        frontmost: [String: Any],
        now: Date = Date()
    ) async throws -> ContextHistoryActivitySample {
        let ax = try await capabilityClient.call(
            namespace: "ax",
            tool: "snapshot",
            arguments: ["target": "frontmost"]
        )
        return try store.recordActivity(
            timestamp: now,
            app: stringDictionary(frontmost["app"]),
            window: stringDictionary(frontmost["window"]),
            axSummary: ax
        )
    }

    public func collectScreenshot(now: Date = Date(), sampleId: String?) async throws -> ContextHistoryScreenshotRecord {
        let screenshot = try await capabilityClient.call(
            namespace: "screenshot",
            tool: "capture",
            arguments: ["target": ["kind": "display"]]
        )
        return try store.recordScreenshot(
            timestamp: now,
            originalBase64: screenshot["imageBase64"] as? String ?? "",
            thumbnailBase64: screenshot["thumbnailBase64"] as? String ?? screenshot["imageBase64"] as? String ?? "",
            width: screenshot["width"] as? Int ?? 0,
            height: screenshot["height"] as? Int ?? 0,
            sampleId: sampleId
        )
    }
}

public struct ContextHistorySamplingTickResult: Equatable {
    public var activitySampleId: String?
    public var screenshotId: String?

    public init(activitySampleId: String?, screenshotId: String?) {
        self.activitySampleId = activitySampleId
        self.screenshotId = screenshotId
    }
}

public final class ContextHistorySamplingScheduler: @unchecked Sendable {
    private let collector: ContextHistoryCollector
    private let periodicActivityInterval: TimeInterval
    private let screenshotInterval: TimeInterval
    private var lastActivitySignature: String?
    private var lastActivityDate: Date?
    private var lastActivitySampleId: String?
    private var lastScreenshotDate: Date?

    public init(
        collector: ContextHistoryCollector,
        periodicActivityInterval: TimeInterval = 30,
        screenshotInterval: TimeInterval = 60
    ) {
        self.collector = collector
        self.periodicActivityInterval = periodicActivityInterval
        self.screenshotInterval = screenshotInterval
    }

    public func tick(now: Date = Date()) async throws -> ContextHistorySamplingTickResult {
        let frontmost = try await collector.readFrontmost()
        let signature = activitySignature(frontmost)
        var activitySampleId: String?
        var screenshotId: String?
        if shouldCollectActivity(signature: signature, now: now) {
            let sample = try await collector.collectActivitySample(frontmost: frontmost, now: now)
            lastActivitySignature = signature
            lastActivityDate = now
            lastActivitySampleId = sample.id
            activitySampleId = sample.id
        }

        if shouldCollectScreenshot(now: now) {
            let screenshot = try await collector.collectScreenshot(now: now, sampleId: lastActivitySampleId)
            lastScreenshotDate = now
            screenshotId = screenshot.id
        } else if lastScreenshotDate == nil {
            lastScreenshotDate = now
        }

        return ContextHistorySamplingTickResult(
            activitySampleId: activitySampleId,
            screenshotId: screenshotId
        )
    }

    private func shouldCollectActivity(signature: String, now: Date) -> Bool {
        guard let lastActivitySignature, let lastActivityDate else { return true }
        if signature != lastActivitySignature { return true }
        return now.timeIntervalSince(lastActivityDate) >= periodicActivityInterval
    }

    private func shouldCollectScreenshot(now: Date) -> Bool {
        guard let lastScreenshotDate else { return false }
        return now.timeIntervalSince(lastScreenshotDate) >= screenshotInterval
    }

    private func activitySignature(_ frontmost: [String: Any]) -> String {
        let app = stringDictionary(frontmost["app"])
        let window = stringDictionary(frontmost["window"])
        return [
            app["bundleId"] ?? "",
            app["pid"] ?? "",
            window["id"] ?? "",
            window["title"] ?? "",
        ].joined(separator: "|")
    }
}

public final class ContextHistoryToolRouter: @unchecked Sendable {
    private let store: ContextHistoryStore

    public init(store: ContextHistoryStore) {
        self.store = store
    }

    public func handle(namespace: String, tool: String, arguments: Any?) -> PluginToolResult {
        guard namespace == "context_history" else {
            return .text("unsupported namespace: \(namespace)", success: false)
        }
        do {
            switch tool {
            case "activity_index":
                return .json(["samples": try store.activityIndex(limit: intArgument(arguments, "limit", defaultValue: 20))])
            case "sample_details":
                return .json(["samples": try store.sampleDetails(ids: stringArrayArgument(arguments, "ids"))])
            case "thumbnails":
                return .json(["thumbnails": try store.thumbnails(limit: intArgument(arguments, "limit", defaultValue: 20))])
            case "screenshot_original":
                let id = stringArgument(arguments, "id")
                return .json(["screenshot": try store.screenshotOriginal(id: id) as Any])
            default:
                return .text("unsupported context_history tool: \(tool)", success: false)
            }
        } catch {
            return .text(error.localizedDescription, success: false)
        }
    }
}

private func stringDictionary(_ value: Any?) -> [String: String] {
    guard let object = value as? [String: Any] else { return [:] }
    return object.reduce(into: [:]) { result, pair in
        result[pair.key] = String(describing: pair.value)
    }
}

private func intArgument(_ arguments: Any?, _ key: String, defaultValue: Int) -> Int {
    let object = arguments as? [String: Any]
    return object?[key] as? Int ?? defaultValue
}

private func stringArgument(_ arguments: Any?, _ key: String) -> String {
    let object = arguments as? [String: Any]
    return object?[key] as? String ?? ""
}

private func stringArrayArgument(_ arguments: Any?, _ key: String) -> [String] {
    let object = arguments as? [String: Any]
    return object?[key] as? [String] ?? []
}

private func iso8601(_ date: Date) -> String {
    ISO8601DateFormatter().string(from: date)
}
