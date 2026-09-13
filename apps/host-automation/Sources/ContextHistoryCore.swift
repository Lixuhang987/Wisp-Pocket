import CoreGraphics
import Darwin
import Foundation
import ImageIO
import UniformTypeIdentifiers

public struct ContextHistoryActivitySample: Codable, Equatable, Sendable {
    public var id: String
    public var timestamp: Date
    public var app: [String: String]
    public var window: [String: String]
    public var axSummaryId: String?
    public var thumbnailId: String?
}

public struct ContextHistoryScreenshotRecord: Codable, Equatable, Sendable {
    public var id: String
    public var timestamp: Date
    public var originalPath: String
    public var thumbnailPath: String
    public var width: Int
    public var height: Int
    public var sampleId: String?
}

public struct ContextHistoryImageEvidence: Sendable {
    public let record: ContextHistoryScreenshotRecord
    public let data: Data
    public let width: Int
    public let height: Int

    fileprivate func metadata(contentIndex: Int) -> [String: Any] {
        [
            "id": record.id,
            "timestamp": contextHistoryTimestamp(record.timestamp),
            "sampleId": record.sampleId.map { $0 as Any } ?? NSNull(),
            "mimeType": "image/png",
            "dimensions": ["width": width, "height": height],
            "imageContentIndex": contentIndex,
        ]
    }
}

@MainActor
public final class ContextHistoryStore {
    private let directoryURL: URL
    private let fileManager: FileManager
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init(directoryURL: URL, fileManager: FileManager = .default) {
        self.directoryURL = directoryURL
        self.fileManager = fileManager
        encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
    }

    public func recordActivity(
        id: String = UUID().uuidString,
        timestamp: Date = Date(),
        app: [String: String],
        window: [String: String],
        axSummary: [String: Any]?
    ) throws -> ContextHistoryActivitySample {
        try validateRecordID(id)
        guard let axSummary else {
            throw ContextHistoryFailure("missing_evidence", "Activity Sample \(id) requires an AX summary")
        }
        try validateContextHistoryAXRoot(axSummary, label: "Activity Sample \(id) AX summary")
        if axSummary["app"] != nil || axSummary["window"] != nil {
            let expected = try ContextHistoryTarget(app: app, window: window, label: "Activity Sample \(id)")
            try expected.requireMatch(ContextHistoryTarget(axSummary, label: "AX summary"), stage: "Activity Sample \(id) AX summary")
        }
        var samples = try loadActivities()
        guard !samples.contains(where: { $0.id == id }) else {
            throw ContextHistoryFailure("duplicate_id", "Activity Sample \(id) already exists")
        }
        try ensureDirectories()
        let axSummaryID = UUID().uuidString
        let axURL = axDirectoryURL.appendingPathComponent("\(axSummaryID).json")
        do {
            try JSONSerialization.data(withJSONObject: axSummary, options: [.prettyPrinted, .sortedKeys])
                .write(to: axURL, options: .atomic)
        } catch {
            throw ContextHistoryFailure("write_failed", "\(axURL.path): \(error.localizedDescription)")
        }
        let sample = ContextHistoryActivitySample(
            id: id, timestamp: timestamp, app: app, window: window, axSummaryId: axSummaryID, thumbnailId: nil
        )
        samples.append(sample)
        try save(Array(samples.suffix(10_000)), to: activitiesURL)
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
        try validateRecordID(id)
        let original = try ContextHistoryPNG(base64: originalBase64, label: "screenshot \(id) original")
        guard original.width == width, original.height == height else {
            throw ContextHistoryFailure("invalid_image", "screenshot \(id) dimensions \(width)x\(height) do not match PNG \(original.width)x\(original.height)")
        }
        let thumbnail = try ContextHistoryPNG(base64: thumbnailBase64, label: "screenshot \(id) thumbnail")
        guard thumbnail.width <= width, thumbnail.height <= height else {
            throw ContextHistoryFailure("invalid_image", "screenshot \(id) thumbnail dimensions exceed its original")
        }
        var screenshots = try loadScreenshots()
        guard !screenshots.contains(where: { $0.id == id }) else {
            throw ContextHistoryFailure("duplicate_id", "screenshot \(id) already exists")
        }
        var samples = try loadActivities()
        if let sampleId, !samples.contains(where: { $0.id == sampleId }) {
            throw ContextHistoryFailure("not_found", "Activity Sample \(sampleId) for screenshot \(id) does not exist")
        }
        try ensureDirectories()
        let originalURL = originalScreenshotsDirectoryURL.appendingPathComponent("\(id).b64")
        let thumbnailURL = thumbnailScreenshotsDirectoryURL.appendingPathComponent("\(id).b64")
        try writeBase64(originalBase64, to: originalURL)
        try writeBase64(thumbnailBase64, to: thumbnailURL)
        let screenshot = ContextHistoryScreenshotRecord(
            id: id, timestamp: timestamp, originalPath: originalURL.path, thumbnailPath: thumbnailURL.path,
            width: width, height: height, sampleId: sampleId
        )
        screenshots.append(screenshot)
        try save(Array(screenshots.suffix(1_440)), to: screenshotsURL)
        if let sampleId, let index = samples.firstIndex(where: { $0.id == sampleId }) {
            samples[index].thumbnailId = id
            try save(samples, to: activitiesURL)
        }
        return screenshot
    }

    public func activityIndex(limit: Int) throws -> [[String: Any]] {
        try validateLimit(limit)
        return try loadActivities().sorted { $0.timestamp > $1.timestamp }.prefix(limit).map { sample in
            [
                "id": sample.id, "timestamp": contextHistoryTimestamp(sample.timestamp),
                "app": sample.app, "window": sample.window,
                "thumbnailId": sample.thumbnailId.map { $0 as Any } ?? NSNull(),
            ]
        }
    }

    public func sampleDetails(ids: [String]) throws -> [[String: Any]] {
        try validateIDs(ids)
        let samples = try loadActivities()
        return try ids.map { id in
            guard let sample = samples.first(where: { $0.id == id }) else {
                throw ContextHistoryFailure("not_found", "Activity Sample \(id) does not exist")
            }
            let axSummary = try loadAXSummary(for: sample)
            return [
                "id": sample.id, "timestamp": contextHistoryTimestamp(sample.timestamp),
                "app": sample.app, "window": sample.window, "axSummary": axSummary,
                "thumbnailId": sample.thumbnailId.map { $0 as Any } ?? NSNull(),
            ]
        }
    }

    public func thumbnails(limit: Int, start: Date? = nil, end: Date? = nil) throws -> [ContextHistoryImageEvidence] {
        try validateLimit(limit)
        if let start, let end, start > end {
            throw ContextHistoryFailure("invalid_arguments", "start must be earlier than or equal to end")
        }
        return try loadScreenshots()
            .filter { screenshot in
                if let start, screenshot.timestamp < start { return false }
                if let end, screenshot.timestamp > end { return false }
                return true
            }
            .sorted { $0.timestamp > $1.timestamp }
            .prefix(limit)
            .map { screenshot in
                let image = try readImage(path: screenshot.thumbnailPath)
                guard image.width <= screenshot.width, image.height <= screenshot.height else {
                    throw ContextHistoryFailure("invalid_image", "screenshot \(screenshot.id) thumbnail dimensions exceed its original")
                }
                return ContextHistoryImageEvidence(record: screenshot, data: image.data, width: image.width, height: image.height)
            }
    }

    public func screenshotOriginal(id: String) throws -> ContextHistoryImageEvidence {
        guard !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ContextHistoryFailure("invalid_arguments", "id must be a non-empty screenshot identifier")
        }
        guard let screenshot = try loadScreenshots().first(where: { $0.id == id }) else {
            throw ContextHistoryFailure("not_found", "screenshot \(id) does not exist")
        }
        let image = try readImage(path: screenshot.originalPath)
        guard image.width == screenshot.width, image.height == screenshot.height else {
            throw ContextHistoryFailure("invalid_image", "screenshot \(id) stored dimensions do not match its PNG")
        }
        return ContextHistoryImageEvidence(record: screenshot, data: image.data, width: image.width, height: image.height)
    }

    public func loadActivities() throws -> [ContextHistoryActivitySample] {
        try load([ContextHistoryActivitySample].self, from: activitiesURL)
    }

    public func loadScreenshots() throws -> [ContextHistoryScreenshotRecord] {
        try load([ContextHistoryScreenshotRecord].self, from: screenshotsURL)
    }

    private func ensureDirectories() throws {
        for url in [directoryURL, axDirectoryURL, originalScreenshotsDirectoryURL, thumbnailScreenshotsDirectoryURL] {
            do {
                try fileManager.createDirectory(at: url, withIntermediateDirectories: true)
            } catch {
                throw ContextHistoryFailure("write_failed", "\(url.path): \(error.localizedDescription)")
            }
        }
    }

    private func save<T: Encodable>(_ value: T, to url: URL) throws {
        do {
            try encoder.encode(value).write(to: url, options: .atomic)
        } catch {
            throw ContextHistoryFailure("write_failed", "\(url.path): \(error.localizedDescription)")
        }
    }

    private func load<T: Decodable>(_ type: [T].Type, from url: URL) throws -> [T] {
        do {
            return try decoder.decode(type, from: Data(contentsOf: url))
        } catch where contextHistoryFileIsMissing(error) {
            return []
        } catch {
            throw ContextHistoryFailure("read_failed", "\(url.path): \(error.localizedDescription)")
        }
    }

    private func loadAXSummary(for sample: ContextHistoryActivitySample) throws -> [String: Any] {
        guard let id = sample.axSummaryId, !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ContextHistoryFailure("missing_evidence", "Activity Sample \(sample.id) has no axSummaryId")
        }
        let url = axDirectoryURL.appendingPathComponent("\(id).json")
        do {
            try validateRecordID(id)
            let object = try JSONSerialization.jsonObject(with: Data(contentsOf: url))
            guard let summary = object as? [String: Any] else {
                throw ContextHistoryFailure("invalid_data", "AX summary must be a JSON object")
            }
            try validateContextHistoryAXRoot(summary, label: "AX summary \(id)")
            // Existing archives contain AX trees without app/window metadata. When identity is
            // present, it must agree with the Activity Sample that references this evidence.
            if summary["app"] != nil || summary["window"] != nil {
                let expected = try ContextHistoryTarget(app: sample.app, window: sample.window, label: "Activity Sample \(sample.id)")
                let actual = try ContextHistoryTarget(summary, label: "AX summary \(id)")
                try expected.requireMatch(actual, stage: "AX summary \(id)")
            }
            return summary
        } catch {
            throw ContextHistoryFailure("read_failed", "AX summary \(id) at \(url.path): \(error.localizedDescription)")
        }
    }

    private func writeBase64(_ value: String, to url: URL) throws {
        do {
            try value.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            throw ContextHistoryFailure("write_failed", "\(url.path): \(error.localizedDescription)")
        }
    }

    private func readImage(path: String) throws -> ContextHistoryPNG {
        let text: String
        do {
            text = try String(contentsOf: URL(fileURLWithPath: path), encoding: .utf8)
        } catch {
            throw ContextHistoryFailure("read_failed", "\(path): \(error.localizedDescription)")
        }
        return try ContextHistoryPNG(base64: text, label: path)
    }

    private var activitiesURL: URL { directoryURL.appendingPathComponent("activities.json") }
    private var screenshotsURL: URL { directoryURL.appendingPathComponent("screenshots.json") }
    private var axDirectoryURL: URL { directoryURL.appendingPathComponent("ax", isDirectory: true) }
    private var originalScreenshotsDirectoryURL: URL { directoryURL.appendingPathComponent("screenshots/original", isDirectory: true) }
    private var thumbnailScreenshotsDirectoryURL: URL { directoryURL.appendingPathComponent("screenshots/thumbnails", isDirectory: true) }
}

@MainActor
public final class ContextHistoryCollector {
    private let store: ContextHistoryStore
    private let host: any HostAutomationCapabilities

    public init(store: ContextHistoryStore, host: any HostAutomationCapabilities) {
        self.store = store
        self.host = host
    }

    public func collectActivitySample(now: Date = Date()) async throws -> ContextHistoryActivitySample {
        let frontmost = try await readFrontmost()
        return try await collectActivitySample(frontmost: frontmost, now: now)
    }

    func readFrontmost() async throws -> [String: Any] {
        do {
            try Task.checkCancellation()
            let frontmost = try await host.frontmostAppWindow()
            try Task.checkCancellation()
            guard let app = frontmost["app"] as? [String: Any], !app.isEmpty else {
                throw ContextHistoryFailure("invalid_data", "frontmost app is missing")
            }
            return frontmost
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw ContextHistoryFailure("frontmost", error.localizedDescription)
        }
    }

    func collectActivitySample(frontmost: [String: Any], now: Date) async throws -> ContextHistoryActivitySample {
        do {
            try Task.checkCancellation()
            let expected = try ContextHistoryTarget(frontmost, label: "frontmost")
            let ax = try await host.accessibilitySnapshot()
            try Task.checkCancellation()
            try validateContextHistoryAXRoot(ax, label: "accessibility_snapshot")
            let axTarget = try ContextHistoryTarget(ax, label: "accessibility_snapshot")
            try expected.requireMatch(axTarget, stage: "accessibility_snapshot")
            let confirmed = try await readFrontmost()
            try Task.checkCancellation()
            try expected.requireMatch(ContextHistoryTarget(confirmed, label: "frontmost after AX"), stage: "frontmost after AX")
            return try store.recordActivity(
                timestamp: now, app: contextHistoryStrings(frontmost["app"]), window: contextHistoryStrings(frontmost["window"]), axSummary: ax
            )
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw ContextHistoryFailure("accessibility_snapshot / activity_sample", error.localizedDescription)
        }
    }

    public func collectScreenshot(now: Date = Date(), sampleId: String?) async throws -> ContextHistoryScreenshotRecord {
        do {
            try Task.checkCancellation()
            guard let sampleId, let sample = try store.loadActivities().first(where: { $0.id == sampleId }) else {
                throw ContextHistoryFailure("missing_evidence", "screenshot requires an existing Activity Sample sampleId")
            }
            let expected = try ContextHistoryTarget(app: sample.app, window: sample.window, label: "Activity Sample \(sampleId)")
            let before = try await readFrontmost()
            try Task.checkCancellation()
            try expected.requireMatch(ContextHistoryTarget(before, label: "frontmost before screenshot"), stage: "frontmost before screenshot")
            let screenshot = try await host.captureScreenshot()
            try Task.checkCancellation()
            let after = try await readFrontmost()
            try Task.checkCancellation()
            try expected.requireMatch(ContextHistoryTarget(after, label: "frontmost after screenshot"), stage: "frontmost after screenshot")
            guard let original = screenshot["imageBase64"] as? String,
                  let thumbnail = screenshot["thumbnailBase64"] as? String else {
                throw ContextHistoryFailure("invalid_image", "screenshot imageBase64 and thumbnailBase64 are required")
            }
            let width = try contextHistoryInteger(screenshot["width"], label: "screenshot width", maximum: 32_768)
            let height = try contextHistoryInteger(screenshot["height"], label: "screenshot height", maximum: 32_768)
            return try store.recordScreenshot(
                timestamp: now, originalBase64: original, thumbnailBase64: thumbnail, width: width, height: height, sampleId: sampleId
            )
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw ContextHistoryFailure("screenshot", error.localizedDescription)
        }
    }
}

public struct ContextHistorySamplingTickResult: Equatable, Sendable {
    public var activitySampleId: String?
    public var screenshotId: String?
}

@MainActor
public final class ContextHistorySamplingScheduler {
    private let collector: ContextHistoryCollector
    private let periodicActivityInterval: TimeInterval
    private let screenshotInterval: TimeInterval
    private var lastActivitySignature: String?
    private var lastActivityDate: Date?
    private var lastActivitySampleId: String?
    private var lastScreenshotDate: Date?

    public init(collector: ContextHistoryCollector, periodicActivityInterval: TimeInterval = 30, screenshotInterval: TimeInterval = 60) {
        self.collector = collector
        self.periodicActivityInterval = periodicActivityInterval
        self.screenshotInterval = screenshotInterval
    }

    public func tick(now: Date = Date()) async throws -> ContextHistorySamplingTickResult {
        let frontmost = try await collector.readFrontmost()
        try Task.checkCancellation()
        let signature = activitySignature(frontmost)
        var activitySampleId: String?
        var screenshotId: String?
        if lastActivitySignature != signature || lastActivityDate.map({ now.timeIntervalSince($0) >= periodicActivityInterval }) != false {
            let sample = try await collector.collectActivitySample(frontmost: frontmost, now: now)
            try Task.checkCancellation()
            lastActivitySignature = signature
            lastActivityDate = now
            lastActivitySampleId = sample.id
            activitySampleId = sample.id
        }
        if let lastScreenshotDate, now.timeIntervalSince(lastScreenshotDate) >= screenshotInterval {
            let screenshot = try await collector.collectScreenshot(now: now, sampleId: lastActivitySampleId)
            try Task.checkCancellation()
            self.lastScreenshotDate = now
            screenshotId = screenshot.id
        } else if lastScreenshotDate == nil {
            lastScreenshotDate = now
        }
        return ContextHistorySamplingTickResult(activitySampleId: activitySampleId, screenshotId: screenshotId)
    }

    func reset() {
        lastActivitySignature = nil
        lastActivityDate = nil
        lastActivitySampleId = nil
        lastScreenshotDate = nil
    }

    private func activitySignature(_ frontmost: [String: Any]) -> String {
        let app = contextHistoryStrings(frontmost["app"])
        let window = contextHistoryStrings(frontmost["window"])
        return [app["bundleId"] ?? "", app["pid"] ?? "", window["id"] ?? "", window["title"] ?? ""].joined(separator: "|")
    }
}

@MainActor
public final class ContextHistoryToolRouter {
    private let store: ContextHistoryStore

    public init(store: ContextHistoryStore) { self.store = store }

    public func handle(tool: String, arguments: Any?, collectionStatus: [String: Any]? = nil) -> DynamicToolResult {
        do {
            let object: [String: Any]
            if let arguments {
                guard let dictionary = arguments as? [String: Any] else {
                    throw ContextHistoryFailure("invalid_arguments", "arguments must be an object")
                }
                object = dictionary
            } else {
                object = [:]
            }
            switch tool {
            case "activity_index":
                try validateKeys(object, allowed: ["limit"])
                var result: [String: Any] = ["samples": try store.activityIndex(limit: limit(object))]
                if let collectionStatus { result["collection"] = collectionStatus }
                return .json(result)
            case "sample_details":
                try validateKeys(object, allowed: ["ids"])
                guard let ids = object["ids"] as? [String] else {
                    throw ContextHistoryFailure("invalid_arguments", "ids must be a non-empty array of sample identifiers")
                }
                return .json(["samples": try store.sampleDetails(ids: ids)])
            case "thumbnails":
                try validateKeys(object, allowed: ["limit", "start", "end"])
                let images = try store.thumbnails(limit: limit(object), start: date(object, "start"), end: date(object, "end"))
                return imageResult(images, key: "thumbnails", single: false)
            case "screenshot_original":
                try validateKeys(object, allowed: ["id"])
                guard let id = object["id"] as? String else {
                    throw ContextHistoryFailure("invalid_arguments", "id must be a non-empty screenshot identifier")
                }
                return imageResult([try store.screenshotOriginal(id: id)], key: "screenshot", single: true)
            default:
                return .text("unsupported_tool: context_history.\(tool)", success: false)
            }
        } catch {
            return .text(error.localizedDescription, success: false)
        }
    }

    private func imageResult(_ images: [ContextHistoryImageEvidence], key: String, single: Bool) -> DynamicToolResult {
        let metadata = images.enumerated().map { index, image in image.metadata(contentIndex: index + 1) }
        let json = DynamicToolResult.json([key: single ? metadata[0] as Any : metadata as Any])
        guard json.success else { return json }
        return DynamicToolResult(contentItems: json.contentItems + images.map { image in
            ["type": "inputImage", "imageUrl": "data:image/png;base64,\(image.data.base64EncodedString())"]
        })
    }

    private func limit(_ object: [String: Any]) throws -> Int {
        guard let value = object["limit"] else { return 20 }
        return try contextHistoryInteger(value, label: "limit", maximum: 200)
    }

    private func date(_ object: [String: Any], _ key: String) throws -> Date? {
        guard let value = object[key] else { return nil }
        if let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(), number.doubleValue.isFinite {
            return Date(timeIntervalSince1970: number.doubleValue)
        }
        if let string = value as? String {
            let formatter = ISO8601DateFormatter()
            if let date = formatter.date(from: string) { return date }
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: string) { return date }
        }
        throw ContextHistoryFailure("invalid_arguments", "\(key) must be an ISO8601 timestamp or epoch seconds")
    }

    private func validateKeys(_ object: [String: Any], allowed: Set<String>) throws {
        if let unexpected = object.keys.sorted().first(where: { !allowed.contains($0) }) {
            throw ContextHistoryFailure("invalid_arguments", "Unsupported argument: \(unexpected)")
        }
    }
}

private struct ContextHistoryPNG {
    let data: Data
    let width: Int
    let height: Int

    init(base64: String, label: String) throws {
        guard !base64.isEmpty, let data = Data(base64Encoded: base64), !data.isEmpty,
              let source = CGImageSourceCreateWithData(data as CFData, nil),
              CGImageSourceGetType(source) as String? == UTType.png.identifier,
              CGImageSourceGetStatus(source) == .statusComplete,
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any],
              let width = properties[kCGImagePropertyPixelWidth as String] as? Int,
              let height = properties[kCGImagePropertyPixelHeight as String] as? Int,
              width > 0, height > 0, width <= 32_768, height <= 32_768, width * height <= 100_000_000,
              let image = CGImageSourceCreateImageAtIndex(source, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary),
              image.width == width, image.height == height else {
            throw ContextHistoryFailure("invalid_image", "\(label) must contain a complete PNG with valid dimensions")
        }
        self.data = data
        self.width = width
        self.height = height
    }
}

private struct ContextHistoryFailure: LocalizedError {
    let code: String
    let message: String
    init(_ code: String, _ message: String) { self.code = code; self.message = message }
    var errorDescription: String? { "\(code): \(message)" }
}

private struct ContextHistoryTarget: Equatable {
    let pid: Int
    let windowID: Int?
    let windowTitle: String

    init(_ value: [String: Any], label: String) throws {
        try self.init(app: contextHistoryStrings(value["app"]), window: contextHistoryStrings(value["window"]), label: label)
    }

    init(app: [String: String], window: [String: String], label: String) throws {
        guard let pidValue = app["pid"], let pid = Int(pidValue), pid > 0 else {
            throw ContextHistoryFailure("missing_evidence", "\(label) requires a valid app.pid")
        }
        let windowID: Int?
        if window.isEmpty {
            windowID = nil
        } else {
            guard let idValue = window["id"], let id = Int(idValue), id > 0 else {
                throw ContextHistoryFailure("missing_evidence", "\(label) requires a valid window.id when a window is present")
            }
            if let owner = window["ownerPid"], Int(owner) != pid {
                throw ContextHistoryFailure("context_changed", "\(label) window.ownerPid does not match app.pid \(pid)")
            }
            windowID = id
        }
        self.pid = pid
        self.windowID = windowID
        windowTitle = window["title"] ?? ""
    }

    func requireMatch(_ actual: ContextHistoryTarget, stage: String) throws {
        guard self == actual else {
            throw ContextHistoryFailure(
                "context_changed",
                "\(stage) target changed from pid=\(pid), window=\(windowID.map(String.init) ?? "none"), title=\(windowTitle) "
                    + "to pid=\(actual.pid), window=\(actual.windowID.map(String.init) ?? "none"), title=\(actual.windowTitle); retry sampling"
            )
        }
    }
}

private func validateContextHistoryAXRoot(_ summary: [String: Any], label: String) throws {
    let root: [String: Any]
    if let value = summary["root"] {
        guard let object = value as? [String: Any] else {
            throw ContextHistoryFailure("invalid_data", "\(label) root must be an AX object")
        }
        root = object
    } else {
        root = summary
    }
    guard let role = root["role"] as? String, role.hasPrefix("AX"), role.count > 2,
          role == role.trimmingCharacters(in: .whitespacesAndNewlines) else {
        throw ContextHistoryFailure("invalid_data", "\(label) root requires a valid AX role")
    }
    if let children = root["children"], !(children is [[String: Any]]) {
        throw ContextHistoryFailure("invalid_data", "\(label) root.children must be an array of AX objects")
    }
}

private func contextHistoryFileIsMissing(_ error: Error) -> Bool {
    let fileError = error as NSError
    if fileError.domain == NSPOSIXErrorDomain {
        return fileError.code == Int(ENOENT)
    }
    if let underlying = fileError.userInfo[NSUnderlyingErrorKey] as? Error {
        return contextHistoryFileIsMissing(underlying)
    }
    return fileError.domain == NSCocoaErrorDomain
        && (fileError.code == NSFileReadNoSuchFileError || fileError.code == NSFileNoSuchFileError)
}

private func validateRecordID(_ id: String) throws {
    guard !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
          id != ".", id != "..", !id.contains("/"), !id.contains("\\") else {
        throw ContextHistoryFailure("invalid_arguments", "id must be a non-empty file-safe identifier")
    }
}

private func validateLimit(_ limit: Int) throws {
    guard (1...200).contains(limit) else {
        throw ContextHistoryFailure("invalid_arguments", "limit must be an integer from 1 to 200")
    }
}

private func validateIDs(_ ids: [String]) throws {
    guard !ids.isEmpty, ids.count <= 200, ids.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else {
        throw ContextHistoryFailure("invalid_arguments", "ids must contain between 1 and 200 non-empty sample identifiers")
    }
}

private func contextHistoryInteger(_ value: Any?, label: String, maximum: Int) throws -> Int {
    guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else {
        throw ContextHistoryFailure("invalid_arguments", "\(label) must be an integer from 1 to \(maximum)")
    }
    let numberValue = number.doubleValue
    guard numberValue.isFinite, numberValue.rounded(.towardZero) == numberValue, numberValue >= 1, numberValue <= Double(maximum) else {
        throw ContextHistoryFailure("invalid_arguments", "\(label) must be an integer from 1 to \(maximum)")
    }
    return Int(numberValue)
}

private func contextHistoryStrings(_ value: Any?) -> [String: String] {
    guard let object = value as? [String: Any] else { return [:] }
    return object.reduce(into: [:]) { result, pair in
        if !(pair.value is NSNull) { result[pair.key] = String(describing: pair.value) }
    }
}

func contextHistoryTimestamp(_ date: Date) -> String {
    ISO8601DateFormatter().string(from: date)
}
