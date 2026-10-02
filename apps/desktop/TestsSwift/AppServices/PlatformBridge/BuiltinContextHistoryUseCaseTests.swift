import CoreGraphics
import Darwin
import Foundation
import HandAgentHostAutomation
import ImageIO
import UniformTypeIdentifiers
import XCTest
@testable import HandAgentDesktop

@MainActor
final class BuiltinContextHistoryUseCaseTests: XCTestCase {
    func testHostStartsCollectionAndSavedEvidenceSurvivesRebuild() async throws {
        let fixture = try HistoryUseCaseFixture()
        defer { fixture.cleanUp() }
        fixture.features.start()
        XCTAssertTrue(fixture.module.isRunning)
        XCTAssertFalse(fixture.settings.settings.automationEnabled)
        fixture.module.start()
        let start = fixture.start
        await fixture.module.sample(now: start)
        await fixture.module.sample(now: start.addingTimeInterval(5))
        XCTAssertEqual(try fixture.store.loadActivities().count, 1)
        fixture.host.windowID = 2
        fixture.host.windowTitle = "Second window"
        await fixture.module.sample(now: start.addingTimeInterval(10))
        await fixture.module.sample(now: start.addingTimeInterval(35))
        XCTAssertEqual(try fixture.store.loadActivities().count, 2)
        await fixture.module.sample(now: start.addingTimeInterval(61))

        let persistedSamples = try fixture.store.loadActivities()
        let screenshots = try fixture.store.loadScreenshots()
        XCTAssertEqual(persistedSamples.map(\.timestamp), [start, start.addingTimeInterval(10), start.addingTimeInterval(61)])
        XCTAssertEqual(screenshots.count, 1)
        let screenshot = try XCTUnwrap(screenshots.first)
        let currentSample = try XCTUnwrap(persistedSamples.last)
        XCTAssertEqual(screenshot.sampleId, currentSample.id)
        XCTAssertEqual(screenshot.timestamp, currentSample.timestamp)
        XCTAssertEqual(currentSample.thumbnailId, screenshot.id)
        XCTAssertEqual(fixture.host.screenshotReads, 1)
        XCTAssertEqual(try Data(base64Encoded: String(contentsOfFile: screenshot.originalPath, encoding: .utf8)), fixture.host.original)
        XCTAssertEqual(try Data(base64Encoded: String(contentsOfFile: screenshot.thumbnailPath, encoding: .utf8)), fixture.host.thumbnail)

        let indexReply = try await fixture.request("activity_index", ["limit": 10])
        XCTAssertTrue(indexReply.success)
        let index = try indexReply.json()
        let indexSamples = try XCTUnwrap(index["samples"] as? [[String: Any]])
        XCTAssertEqual(indexSamples.compactMap { $0["id"] as? String }, persistedSamples.reversed().map(\.id))
        XCTAssertEqual(indexSamples[0]["thumbnailId"] as? String, screenshot.id)
        XCTAssertNil(indexSamples[0]["axSummary"])
        XCTAssertNil(indexSamples[0]["imageBase64"])
        XCTAssertNil(indexSamples[0]["thumbnailBase64"])
        let firstSample = try XCTUnwrap(persistedSamples.first)
        let detailsReply = try await fixture.request("sample_details", ["ids": [currentSample.id, firstSample.id]])
        XCTAssertTrue(detailsReply.success)
        let details = try XCTUnwrap(detailsReply.json()["samples"] as? [[String: Any]])
        XCTAssertEqual(details.compactMap { $0["id"] as? String }, [currentSample.id, firstSample.id])
        let ax = try XCTUnwrap(details[0]["axSummary"] as? [String: Any])
        let root = try XCTUnwrap(ax["root"] as? [String: Any])
        XCTAssertEqual(root["title"] as? String, "Second window")
        XCTAssertEqual((root["children"] as? [[String: Any]])?.first?["title"] as? String, "Save evidence")

        let thumbnailsReply = try await fixture.request("thumbnails", [
            "limit": 10, "start": start.addingTimeInterval(60).timeIntervalSince1970,
            "end": ISO8601DateFormatter().string(from: start.addingTimeInterval(70)),
        ])
        XCTAssertTrue(thumbnailsReply.success)
        let thumbnails = try XCTUnwrap(thumbnailsReply.json()["thumbnails"] as? [[String: Any]])
        XCTAssertEqual(thumbnails.count, 1)
        XCTAssertEqual(thumbnails[0]["id"] as? String, screenshot.id)
        XCTAssertEqual(thumbnails[0]["sampleId"] as? String, currentSample.id)
        XCTAssertEqual(thumbnails[0]["timestamp"] as? String, indexSamples[0]["timestamp"] as? String)
        try assertImage(thumbnailsReply, metadata: thumbnails[0], expected: fixture.host.thumbnail, width: 2, height: 1)
        let excluded = try await fixture.request("thumbnails", ["start": start.addingTimeInterval(62).timeIntervalSince1970])
        XCTAssertTrue(excluded.success)
        XCTAssertEqual((try excluded.json()["thumbnails"] as? [[String: Any]])?.count, 0)

        let originalReply = try await fixture.request("screenshot_original", ["id": screenshot.id])
        XCTAssertTrue(originalReply.success)
        let originalMetadata = try XCTUnwrap(originalReply.json()["screenshot"] as? [String: Any])
        XCTAssertEqual(originalMetadata["id"] as? String, screenshot.id)
        XCTAssertEqual(originalMetadata["sampleId"] as? String, currentSample.id)
        try assertImage(originalReply, metadata: originalMetadata, expected: fixture.host.original, width: 4, height: 2)

        fixture.features.stop()
        let reopened = try HistoryUseCaseFixture(home: fixture.home)
        defer { reopened.features.stop() }
        reopened.features.start()
        XCTAssertTrue(reopened.module.isRunning)
        let reopenedOriginal = try await reopened.request("screenshot_original", ["id": screenshot.id])
        let reopenedMetadata = try XCTUnwrap(reopenedOriginal.json()["screenshot"] as? [String: Any])
        XCTAssertEqual(reopenedMetadata["timestamp"] as? String, originalMetadata["timestamp"] as? String)
        try assertImage(reopenedOriginal, metadata: reopenedMetadata, expected: fixture.host.original, width: 4, height: 2)
        let reopenedDetails = try await reopened.request("sample_details", ["ids": [currentSample.id, firstSample.id]])
        XCTAssertEqual((try reopenedDetails.json()["samples"] as? [[String: Any]])?.count, 2)
        XCTAssertEqual(try reopened.store.loadActivities(), persistedSamples)
    }

    func testShutdownCancelsPendingSamplingBeforeAnyLateWrite() async throws {
        let fixture = try HistoryUseCaseFixture()
        defer { fixture.cleanUp() }
        fixture.enable()
        fixture.host.holdAX = true
        let pending = Task { await fixture.module.sample(now: fixture.start) }
        await fixture.host.waitForAX()
        fixture.features.stop()
        XCTAssertFalse(fixture.module.isRunning)
        XCTAssertTrue(try fixture.registeredHistoryTools().isEmpty)

        fixture.host.holdAX = false
        fixture.features.start()
        await fixture.module.sample(now: fixture.start.addingTimeInterval(20))
        fixture.host.resumeAX()
        await pending.value
        XCTAssertEqual(try fixture.store.loadActivities().map(\.timestamp), [fixture.start.addingTimeInterval(20)])
        XCTAssertNil(fixture.module.lastErrorMessage)

        fixture.host.holdScreenshot = true
        let pendingScreenshot = Task { await fixture.module.sample(now: fixture.start.addingTimeInterval(81)) }
        await fixture.host.waitForScreenshot()
        fixture.features.stop()
        let countAtShutdown = try fixture.store.loadActivities().count
        fixture.host.resumeScreenshot()
        await pendingScreenshot.value
        await fixture.module.sample(now: fixture.start.addingTimeInterval(200))
        XCTAssertFalse(fixture.module.isRunning)
        XCTAssertEqual(try fixture.store.loadActivities().count, countAtShutdown)
        XCTAssertTrue(try fixture.store.loadScreenshots().isEmpty)
    }

    func testPermissionFailureIsVisibleAndNextSamplingCanRecover() async throws {
        let fixture = try HistoryUseCaseFixture()
        defer { fixture.cleanUp() }
        fixture.enable()
        fixture.host.axFailure = NSError(domain: "HistoryTest", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "permission_denied: Accessibility disabled",
        ])
        await fixture.module.sample(now: fixture.start)
        XCTAssertTrue(try fixture.store.loadActivities().isEmpty)
        let message = try XCTUnwrap(fixture.module.lastErrorMessage)
        let settingsViewModel = ToolSettingsViewModel(store: AgentSettingsStore(homeDirectoryURL: fixture.home), builtinFeatures: fixture.features)
        XCTAssertTrue(settingsViewModel.contextHistoryStatus.contains("采集失败"))
        XCTAssertTrue(message.contains("accessibility"), message)
        XCTAssertTrue(message.contains("permission_denied"), message)

        fixture.host.axFailure = nil
        await fixture.module.sample(now: fixture.start.addingTimeInterval(5))
        XCTAssertEqual(try fixture.store.loadActivities().count, 1)
        XCTAssertNil(fixture.module.lastErrorMessage)
        fixture.host.screenshotFailure = NSError(domain: "HistoryTest", code: 2, userInfo: [
            NSLocalizedDescriptionKey: "permission_denied: Screen Recording disabled",
        ])
        await fixture.module.sample(now: fixture.start.addingTimeInterval(66))
        XCTAssertTrue(try fixture.store.loadScreenshots().isEmpty)
        XCTAssertTrue(try XCTUnwrap(fixture.module.lastErrorMessage).contains("screenshot"))
        fixture.host.screenshotFailure = nil
        await fixture.module.sample(now: fixture.start.addingTimeInterval(71))
        XCTAssertEqual(try fixture.store.loadScreenshots().count, 1)
        XCTAssertNil(fixture.module.lastErrorMessage)
    }

    func testPersistedEvidenceFailuresAreVisibleToToolCaller() async throws {
        let fixture = try HistoryUseCaseFixture()
        defer { fixture.cleanUp() }
        fixture.enable()
        await fixture.module.sample(now: fixture.start)
        await fixture.module.sample(now: fixture.start.addingTimeInterval(61))
        let screenshot = try XCTUnwrap(fixture.store.loadScreenshots().first)
        let sample = try XCTUnwrap(fixture.store.loadActivities().last)
        let valid = try await fixture.request("screenshot_original", ["id": screenshot.id])
        XCTAssertTrue(valid.success)

        try FileManager.default.removeItem(atPath: screenshot.originalPath)
        try await assertFailure(fixture, "screenshot_original", ["id": screenshot.id], containing: screenshot.id)
        try await assertFailure(fixture, "screenshot_original", ["id": "missing-image"], containing: "missing-image")
        try await assertFailure(fixture, "sample_details", ["ids": [sample.id, "missing-sample"]], containing: "missing-sample")
        let axID = try XCTUnwrap(sample.axSummaryId)
        let axURL = fixture.historyDirectory.appendingPathComponent("ax/\(axID).json")
        try Data("damaged".utf8).write(to: axURL)
        try await assertFailure(fixture, "sample_details", ["ids": [sample.id]], containing: axID)
        try FileManager.default.removeItem(at: axURL)
        try await assertFailure(fixture, "sample_details", ["ids": [sample.id]], containing: axID)
        try Data("bad png".utf8).base64EncodedString().write(toFile: screenshot.thumbnailPath, atomically: true, encoding: .utf8)
        try await assertFailure(fixture, "thumbnails", [:], containing: screenshot.id)
        try FileManager.default.removeItem(atPath: screenshot.thumbnailPath)
        try await assertFailure(fixture, "thumbnails", [:], containing: screenshot.id)
        try Data("broken index".utf8).write(to: fixture.historyDirectory.appendingPathComponent("activities.json"))
        try await assertFailure(fixture, "activity_index", [:], containing: "activities.json")
    }

    func testToolArgumentsRejectMalformedAndOutOfRangeValues() async throws {
        let fixture = try HistoryUseCaseFixture()
        defer { fixture.cleanUp() }
        fixture.enable()
        for limit: Any in [0, -1, 201, 2.5, true, "10"] {
            try await assertFailure(fixture, "activity_index", ["limit": limit], containing: "limit")
            try await assertFailure(fixture, "thumbnails", ["limit": limit], containing: "limit")
        }
        for ids: Any in [[], [""], [" "], "sample", ["sample", 1]] {
            try await assertFailure(fixture, "sample_details", ["ids": ids], containing: "ids")
        }
        try await assertFailure(fixture, "sample_details", [:], containing: "ids")
        try await assertFailure(fixture, "screenshot_original", ["id": " "], containing: "id")
        try await assertFailure(fixture, "thumbnails", ["start": "not a date"], containing: "start")
        try await assertFailure(fixture, "thumbnails", ["end": true], containing: "end")
        try await assertFailure(fixture, "thumbnails", ["start": 100, "end": 99], containing: "start")
        try await assertFailure(fixture, "activity_index", [], containing: "arguments")
    }

    func testUnreadableHistoryIsAQueryFailureAndReadableEmptyHistoryRemainsValid() async throws {
        try XCTSkipIf(geteuid() == 0, "POSIX permission denial requires a non-root test process")
        let fixture = try HistoryUseCaseFixture()
        defer { fixture.cleanUp() }
        fixture.enable()
        await fixture.module.sample(now: fixture.start)
        try FileManager.default.setAttributes([.posixPermissions: 0], ofItemAtPath: fixture.historyDirectory.path)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: fixture.historyDirectory.path) }
        XCTAssertFalse(FileManager.default.fileExists(atPath: fixture.historyDirectory.appendingPathComponent("activities.json").path))
        try await assertFailure(fixture, "activity_index", [:], containing: "activities.json")
        try await assertFailure(fixture, "thumbnails", [:], containing: "screenshots.json")

        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: fixture.historyDirectory.path)
        let index = try await fixture.request("activity_index")
        XCTAssertTrue(index.success)
        XCTAssertEqual((try index.json()["samples"] as? [[String: Any]])?.count, 1)
        let thumbnails = try await fixture.request("thumbnails")
        XCTAssertTrue(thumbnails.success)
        XCTAssertEqual((try thumbnails.json()["thumbnails"] as? [[String: Any]])?.count, 0)
    }

    func testSemanticAXDamageAndMissingAssociationsAreFailedDetailQueries() async throws {
        let fixture = try HistoryUseCaseFixture()
        defer { fixture.cleanUp() }
        fixture.enable()
        await fixture.module.sample(now: fixture.start)
        let sample = try XCTUnwrap(fixture.store.loadActivities().first)
        let axID = try XCTUnwrap(sample.axSummaryId)
        let axURL = fixture.historyDirectory.appendingPathComponent("ax/\(axID).json")
        let originalAX = try Data(contentsOf: axURL)
        let invalidAX: [[String: Any]] = [
            [:], ["root": [:]], ["root": NSNull()], ["root": ["title": "No AX role"]],
            ["root": ["role": ""]], ["root": ["role": "unknown"]],
        ]
        for value in invalidAX {
            try JSONSerialization.data(withJSONObject: value).write(to: axURL)
            try await assertFailure(fixture, "sample_details", ["ids": [sample.id]], containing: axID)
        }
        var wrongAssociation = try XCTUnwrap(JSONSerialization.jsonObject(with: originalAX) as? [String: Any])
        wrongAssociation["app"] = ["pid": 999, "bundleId": "wrong.app"]
        try JSONSerialization.data(withJSONObject: wrongAssociation).write(to: axURL)
        try await assertFailure(fixture, "sample_details", ["ids": [sample.id]], containing: axID)
        try originalAX.write(to: axURL)

        let activitiesURL = fixture.historyDirectory.appendingPathComponent("activities.json")
        let originalActivities = try Data(contentsOf: activitiesURL)
        var activities = try XCTUnwrap(JSONSerialization.jsonObject(with: originalActivities) as? [[String: Any]])
        for missingAssociation: Any in [NSNull(), ""] {
            activities[0]["axSummaryId"] = missingAssociation
            try JSONSerialization.data(withJSONObject: activities).write(to: activitiesURL)
            try await assertFailure(fixture, "sample_details", ["ids": [sample.id]], containing: "axSummaryId")
        }
        activities[0].removeValue(forKey: "axSummaryId")
        try JSONSerialization.data(withJSONObject: activities).write(to: activitiesURL)
        try await assertFailure(fixture, "sample_details", ["ids": [sample.id]], containing: "axSummaryId")
        try originalActivities.write(to: activitiesURL)
        let restored = try await fixture.request("sample_details", ["ids": [sample.id]])
        XCTAssertTrue(restored.success)
    }

    func testAXTargetMismatchAndFrontmostChangesFailBeforePersistenceThenRecover() async throws {
        let fixture = try HistoryUseCaseFixture()
        defer { fixture.cleanUp() }
        fixture.enable()
        fixture.host.axResponseOverride = [
            "app": ["pid": 999, "bundleId": "wrong.app"], "window": ["id": 1, "title": "First window"],
            "root": ["role": "AXWindow", "title": "Unrelated evidence"],
        ]
        await fixture.module.sample(now: fixture.start)
        XCTAssertTrue(try fixture.store.loadActivities().isEmpty)
        XCTAssertTrue(try XCTUnwrap(fixture.module.lastErrorMessage).contains("context_changed"))

        fixture.host.axResponseOverride = [
            "app": ["pid": 123, "bundleId": "test.evidence"], "window": ["id": 99, "title": "Other window"],
            "root": ["role": "AXWindow", "title": "Unrelated window evidence"],
        ]
        await fixture.module.sample(now: fixture.start.addingTimeInterval(1))
        XCTAssertTrue(try fixture.store.loadActivities().isEmpty)
        XCTAssertTrue(try XCTUnwrap(fixture.module.lastErrorMessage).contains("context_changed"))

        fixture.host.axResponseOverride = nil
        fixture.host.afterAX = {
            fixture.host.windowID = 2
            fixture.host.windowTitle = "Second window"
        }
        await fixture.module.sample(now: fixture.start.addingTimeInterval(2))
        XCTAssertTrue(try fixture.store.loadActivities().isEmpty)
        XCTAssertTrue(try XCTUnwrap(fixture.module.lastErrorMessage).contains("context_changed"))
        fixture.host.afterAX = nil
        await fixture.module.sample(now: fixture.start.addingTimeInterval(5))
        let sample = try XCTUnwrap(fixture.store.loadActivities().first)
        XCTAssertEqual(sample.window["id"], "2")
        XCTAssertNil(fixture.module.lastErrorMessage)
        let details = try await fixture.request("sample_details", ["ids": [sample.id]])
        XCTAssertTrue(details.success)
        let ax = try XCTUnwrap((details.json()["samples"] as? [[String: Any]])?.first?["axSummary"] as? [String: Any])
        XCTAssertEqual((ax["window"] as? [String: Any])?["id"] as? Int, 2)
        XCTAssertEqual((ax["root"] as? [String: Any])?["title"] as? String, "Second window")
    }

    func testScreenshotTargetChangeDoesNotAttachImageToAnUnrelatedActivity() async throws {
        let fixture = try HistoryUseCaseFixture()
        defer { fixture.cleanUp() }
        fixture.enable()
        await fixture.module.sample(now: fixture.start)
        fixture.host.afterScreenshot = {
            fixture.host.windowID = 2
            fixture.host.windowTitle = "Second window"
        }
        await fixture.module.sample(now: fixture.start.addingTimeInterval(61))
        XCTAssertTrue(try fixture.store.loadScreenshots().isEmpty)
        XCTAssertTrue(try XCTUnwrap(fixture.module.lastErrorMessage).contains("context_changed"))
        fixture.host.afterScreenshot = nil
        await fixture.module.sample(now: fixture.start.addingTimeInterval(66))
        let sample = try XCTUnwrap(fixture.store.loadActivities().last)
        XCTAssertEqual(sample.window["id"], "2")
        let screenshot = try XCTUnwrap(fixture.store.loadScreenshots().first)
        XCTAssertEqual(screenshot.sampleId, sample.id)
        XCTAssertNil(fixture.module.lastErrorMessage)
    }

    private func assertFailure(
        _ fixture: HistoryUseCaseFixture, _ tool: String, _ arguments: Any, containing expected: String,
        file: StaticString = #filePath, line: UInt = #line
    ) async throws {
        let reply = try await fixture.request(tool, arguments)
        XCTAssertFalse(reply.success, "\(tool): \(reply.items)", file: file, line: line)
        let text = reply.items.compactMap { $0["text"] as? String }.joined(separator: " ")
        XCTAssertTrue(text.contains(expected), text, file: file, line: line)
    }

    private func assertImage(
        _ reply: HistoryUseCaseReply, metadata: [String: Any], expected: Data, width: Int, height: Int,
        file: StaticString = #filePath, line: UInt = #line
    ) throws {
        let dimensions = try XCTUnwrap(metadata["dimensions"] as? [String: Int], file: file, line: line)
        XCTAssertEqual(dimensions, ["width": width, "height": height], file: file, line: line)
        let index = try XCTUnwrap(metadata["imageContentIndex"] as? Int, file: file, line: line)
        XCTAssertTrue(reply.items.indices.contains(index), file: file, line: line)
        guard reply.items.indices.contains(index) else { return }
        XCTAssertEqual(reply.items[index]["type"] as? String, "inputImage", file: file, line: line)
        let imageURL = try XCTUnwrap(reply.items[index]["imageUrl"] as? String, file: file, line: line)
        XCTAssertTrue(imageURL.hasPrefix("data:image/png;base64,"), file: file, line: line)
        let data = try XCTUnwrap(Data(base64Encoded: String(imageURL.dropFirst("data:image/png;base64,".count))), file: file, line: line)
        XCTAssertEqual(data, expected, file: file, line: line)
        let source = try XCTUnwrap(CGImageSourceCreateWithData(data as CFData, nil), file: file, line: line)
        let image = try XCTUnwrap(CGImageSourceCreateImageAtIndex(source, 0, nil), file: file, line: line)
        XCTAssertEqual(image.width, width, file: file, line: line)
        XCTAssertEqual(image.height, height, file: file, line: line)
        XCTAssertNil(metadata["imageBase64"], file: file, line: line)
        XCTAssertNil(metadata["thumbnailBase64"], file: file, line: line)
    }
}

@MainActor
private final class HistoryUseCaseFixture {
    let home: URL
    let historyDirectory: URL
    let start = Date(timeIntervalSince1970: 1_700_000_000)
    let host: HistoryUseCaseHost
    let store: ContextHistoryStore
    let module: ContextHistoryModule
    let settings: BuiltinFeatureSettingsStore
    let features: BuiltinFeatures
    let provider: DynamicToolProviderService
    private var callNumber = 0

    init(home: URL? = nil) throws {
        self.home = home ?? FileManager.default.temporaryDirectory.appendingPathComponent("history-provider-\(UUID().uuidString)", isDirectory: true)
        historyDirectory = self.home.appendingPathComponent(".spotAgent/context-history", isDirectory: true)
        host = try HistoryUseCaseHost()
        store = ContextHistoryStore(directoryURL: historyDirectory)
        module = ContextHistoryModule(store: store, host: host, pollingInterval: .seconds(3_600))
        settings = BuiltinFeatureSettingsStore(homeDirectoryURL: self.home)
        features = BuiltinFeatures(
            settingsStore: settings, contextHistory: module,
            automation: AutomationModule(store: AutomationStore(directoryURL: self.home.appendingPathComponent(".spotAgent/automation")), host: host)
        )
        provider = DynamicToolProviderService(provider: host, builtinFeatures: features)
    }

    func enable() {
        features.start()
    }

    func cleanUp() {
        features.stop()
        host.afterAX = nil
        host.afterScreenshot = nil
        host.resumeAX()
        host.resumeScreenshot()
        try? FileManager.default.removeItem(at: home)
    }

    func registeredHistoryTools() throws -> Set<String> {
        let data = try XCTUnwrap(provider.makeHelloMessage().data(using: .utf8))
        let hello = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(hello["type"] as? String, "provider_hello")
        let tools = try XCTUnwrap(hello["tools"] as? [[String: Any]])
        return Set(tools.filter { $0["namespace"] as? String == "context_history" }.compactMap { $0["name"] as? String })
    }

    func request(_ tool: String, _ arguments: Any = [:]) async throws -> HistoryUseCaseReply {
        let result = ContextHistoryToolRouter(store: store).handle(tool: tool, arguments: arguments)
        return HistoryUseCaseReply(success: result.success, items: result.contentItems)

    }
}

private struct HistoryUseCaseReply {
    let success: Bool
    let items: [[String: Any]]

    func json() throws -> [String: Any] {
        let text = try XCTUnwrap(items.first?["text"] as? String)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
    }
}

@MainActor
private final class HistoryUseCaseHost: HostAutomationCapabilities, PlatformProvider {
    let original: Data
    let thumbnail: Data
    var windowID = 1
    var windowTitle = "First window"
    var holdAX = false
    var holdScreenshot = false
    var axFailure: Error?
    var screenshotFailure: Error?
    var axResponseOverride: [String: Any]?
    var afterAX: (() -> Void)?
    var afterScreenshot: (() -> Void)?
    private(set) var frontmostReads = 0
    private(set) var screenshotReads = 0
    private var pendingAX: CheckedContinuation<Void, Never>?
    private var pendingScreenshot: CheckedContinuation<Void, Never>?
    private var awaitingAX: CheckedContinuation<Void, Never>?
    private var awaitingScreenshot: CheckedContinuation<Void, Never>?

    init() throws {
        original = try Self.png(width: 4, height: 2)
        thumbnail = try Self.png(width: 2, height: 1)
    }

    func frontmostAppWindow() async throws -> [String: Any] {
        frontmostReads += 1
        return ["app": ["bundleId": "test.evidence", "name": "Evidence", "pid": 123], "window": ["id": windowID, "title": windowTitle]]
    }

    func accessibilitySnapshot() async throws -> [String: Any] {
        if holdAX {
            await withCheckedContinuation { continuation in
                pendingAX = continuation
                awaitingAX?.resume()
                awaitingAX = nil
            }
        }
        if let axFailure { throw axFailure }
        let result: [String: Any] = axResponseOverride ?? [
            "app": ["bundleId": "test.evidence", "name": "Evidence", "pid": 123],
            "window": ["id": windowID, "ownerPid": 123, "title": windowTitle],
            "root": ["role": "AXWindow", "title": windowTitle, "children": [["role": "AXButton", "title": "Save evidence"]]],
        ]
        afterAX?()
        return result
    }

    func captureScreenshot() async throws -> [String: Any] {
        screenshotReads += 1
        if holdScreenshot {
            await withCheckedContinuation { continuation in
                pendingScreenshot = continuation
                awaitingScreenshot?.resume()
                awaitingScreenshot = nil
            }
        }
        if let screenshotFailure { throw screenshotFailure }
        afterScreenshot?()
        return ["imageBase64": original.base64EncodedString(), "thumbnailBase64": thumbnail.base64EncodedString(), "mimeType": "image/png", "width": 4, "height": 2]
    }

    func activateApp(bundleId: String?) async throws {}
    func performAction(_ arguments: [String: Any]) async throws {}
    func handle(method: String, args: Any?) async throws -> Any? { [:] }

    func waitForAX() async {
        if pendingAX == nil { await withCheckedContinuation { awaitingAX = $0 } }
    }

    func waitForScreenshot() async {
        if pendingScreenshot == nil { await withCheckedContinuation { awaitingScreenshot = $0 } }
    }

    func resumeAX() {
        pendingAX?.resume()
        pendingAX = nil
    }

    func resumeScreenshot() {
        pendingScreenshot?.resume()
        pendingScreenshot = nil
    }

    private static func png(width: Int, height: Int) throws -> Data {
        let context = try XCTUnwrap(CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ))
        context.setFillColor(CGColor(red: 0.3, green: 0.6, blue: 0.9, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        let image = try XCTUnwrap(context.makeImage())
        let data = NSMutableData()
        let destination = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, image, nil)
        XCTAssertTrue(CGImageDestinationFinalize(destination))
        return data as Data
    }
}
