import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers
import XCTest
@testable import HandAgentHostAutomation

@MainActor
final class ContextHistoryTests: XCTestCase {
    func testExistingHistoryFormatRetainsIdentifiersTimesAndEvidence() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let originalDirectory = directory.appendingPathComponent("screenshots/original")
        let thumbnailDirectory = directory.appendingPathComponent("screenshots/thumbnails")
        let axDirectory = directory.appendingPathComponent("ax")
        for folder in [originalDirectory, thumbnailDirectory, axDirectory] {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        }
        let original = try makeHistoryPNG(width: 4, height: 2)
        let thumbnail = try makeHistoryPNG(width: 2, height: 1)
        let originalPath = originalDirectory.appendingPathComponent("legacy-screenshot.b64")
        let thumbnailPath = thumbnailDirectory.appendingPathComponent("legacy-screenshot.b64")
        try original.base64EncodedString().write(to: originalPath, atomically: true, encoding: .utf8)
        try thumbnail.base64EncodedString().write(to: thumbnailPath, atomically: true, encoding: .utf8)
        let activities: [[String: Any]] = [[
            "id": "legacy-sample", "timestamp": "2023-11-14T22:13:20Z",
            "app": ["bundleId": "test.legacy"], "window": ["title": "Existing activity"],
            "axSummaryId": "legacy-ax", "thumbnailId": "legacy-screenshot",
        ]]
        let screenshots: [[String: Any]] = [[
            "id": "legacy-screenshot", "timestamp": "2023-11-14T22:13:20Z",
            "originalPath": originalPath.path, "thumbnailPath": thumbnailPath.path,
            "width": 4, "height": 2, "sampleId": "legacy-sample",
        ]]
        try JSONSerialization.data(withJSONObject: activities).write(to: directory.appendingPathComponent("activities.json"))
        try JSONSerialization.data(withJSONObject: screenshots).write(to: directory.appendingPathComponent("screenshots.json"))
        try JSONSerialization.data(withJSONObject: ["role": "AXWindow", "title": "Existing evidence"])
            .write(to: axDirectory.appendingPathComponent("legacy-ax.json"))

        let store = ContextHistoryStore(directoryURL: directory)
        let router = ContextHistoryToolRouter(store: store)
        let index = try toolJSON(router.handle(tool: "activity_index", arguments: ["limit": 1]))
        let sample = try XCTUnwrap((index["samples"] as? [[String: Any]])?.first)
        XCTAssertEqual(sample["id"] as? String, "legacy-sample")
        XCTAssertEqual(sample["timestamp"] as? String, "2023-11-14T22:13:20Z")
        let details = try toolJSON(router.handle(tool: "sample_details", arguments: ["ids": ["legacy-sample"]]))
        let detail = try XCTUnwrap((details["samples"] as? [[String: Any]])?.first)
        XCTAssertEqual((detail["axSummary"] as? [String: Any])?["title"] as? String, "Existing evidence")
        try JSONSerialization.data(withJSONObject: ["root": ["role": "AXApplication", "title": "Existing wrapped evidence"]])
            .write(to: axDirectory.appendingPathComponent("legacy-ax.json"))
        let wrappedDetails = try toolJSON(router.handle(tool: "sample_details", arguments: ["ids": ["legacy-sample"]]))
        let wrappedSummary = try XCTUnwrap((wrappedDetails["samples"] as? [[String: Any]])?.first?["axSummary"] as? [String: Any])
        XCTAssertEqual((wrappedSummary["root"] as? [String: Any])?["title"] as? String, "Existing wrapped evidence")
        let image = router.handle(tool: "screenshot_original", arguments: ["id": "legacy-screenshot"])
        XCTAssertTrue(image.success)
        XCTAssertEqual(image.contentItems[1]["imageUrl"] as? String, "data:image/png;base64,\(original.base64EncodedString())")
        let thumbs = router.handle(tool: "thumbnails", arguments: ["limit": 1])
        XCTAssertTrue(thumbs.success)
        XCTAssertEqual(thumbs.contentItems[1]["imageUrl"] as? String, "data:image/png;base64,\(thumbnail.base64EncodedString())")
        XCTAssertEqual(try store.loadActivities().first?.timestamp, Date(timeIntervalSince1970: 1_700_000_000))
    }

    func testMalformedCaptureIsReportedWithoutPersistingFalseImageEvidenceAndRetryRecovers() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let host = try HistoryBoundary()
        let store = ContextHistoryStore(directoryURL: directory)
        let module = ContextHistoryModule(store: store, host: host, pollingInterval: .seconds(3_600))
        module.start()
        defer { module.stop() }
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        await module.sample(now: start)
        let validCapture = host.capture
        let brokenCaptures: [[String: Any]] = [
            validCapture.merging(["imageBase64": ""]) { _, new in new },
            validCapture.merging(["imageBase64": "not-base64"]) { _, new in new },
            validCapture.merging(["imageBase64": Data("not a PNG".utf8).base64EncodedString()]) { _, new in new },
            validCapture.merging(["imageBase64": host.original.prefix(30).base64EncodedString()]) { _, new in new },
            validCapture.merging(["width": 0]) { _, new in new },
            validCapture.merging(["width": 8]) { _, new in new },
            validCapture.merging(["thumbnailBase64": ""]) { _, new in new },
            validCapture.merging(["thumbnailBase64": try makeHistoryPNG(width: 8, height: 4).base64EncodedString()]) { _, new in new },
        ]
        for (index, capture) in brokenCaptures.enumerated() {
            host.capture = capture
            await module.sample(now: start.addingTimeInterval(Double(61 + index)))
            XCTAssertTrue(try store.loadScreenshots().isEmpty)
            let error = try XCTUnwrap(module.lastErrorMessage)
            XCTAssertTrue(error.contains("screenshot"), error)
        }
        host.capture = validCapture
        await module.sample(now: start.addingTimeInterval(75))
        XCTAssertNil(module.lastErrorMessage)
        let screenshot = try XCTUnwrap(store.loadScreenshots().first)
        let response = module.handle(tool: "screenshot_original", arguments: ["id": screenshot.id])
        XCTAssertTrue(response.success)
        XCTAssertEqual(response.contentItems[1]["imageUrl"] as? String, "data:image/png;base64,\(host.original.base64EncodedString())")
    }

    func testRepeatedStartAndOverlappingTicksShareOneSamplingSession() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let host = try HistoryBoundary()
        let store = ContextHistoryStore(directoryURL: directory)
        let module = ContextHistoryModule(store: store, host: host, pollingInterval: .seconds(3_600))
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        host.holdFrontmost = true
        module.start()
        let first = Task { await module.sample(now: start) }
        await host.waitForFrontmost()
        module.start()
        await module.sample(now: start.addingTimeInterval(1))
        XCTAssertEqual(host.frontmostReads, 1)
        host.holdFrontmost = false
        host.resumeFrontmost()
        await first.value
        module.start()
        await module.sample(now: start.addingTimeInterval(5))
        XCTAssertEqual(try store.loadActivities().count, 1)
        await module.sample(now: start.addingTimeInterval(31))
        XCTAssertEqual(try store.loadActivities().count, 2)
        module.stop()
        await module.sample(now: start.addingTimeInterval(90))
        XCTAssertEqual(try store.loadActivities().count, 2)
        XCTAssertTrue(try store.loadScreenshots().isEmpty)
    }

    func testDiskFailureIsVisibleToCollectorAndQueries() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let blockedDirectory = directory.appendingPathComponent("blocked-history")
        try Data("a file cannot be a history directory".utf8).write(to: blockedDirectory)
        let module = ContextHistoryModule(
            store: ContextHistoryStore(directoryURL: blockedDirectory), host: try HistoryBoundary(), pollingInterval: .seconds(3_600)
        )
        module.start()
        defer { module.stop() }
        await module.sample(now: Date(timeIntervalSince1970: 100))
        let message = try XCTUnwrap(module.lastErrorMessage)
        XCTAssertTrue(message.contains("blocked-history"), message)
        let index = module.handle(tool: "activity_index", arguments: [:])
        XCTAssertFalse(index.success)
        XCTAssertTrue(try XCTUnwrap(index.contentItems.first?["text"] as? String).contains("blocked-history"))
        XCTAssertNil(module.lastSampleAt)
    }

    private func temporaryDirectory() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("context-history-core-\(UUID().uuidString)", isDirectory: true)
    }

    private func toolJSON(_ result: DynamicToolResult) throws -> [String: Any] {
        XCTAssertTrue(result.success, "\(result.contentItems)")
        let text = try XCTUnwrap(result.contentItems.first?["text"] as? String)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
    }
}

@MainActor
private final class HistoryBoundary: HostAutomationCapabilities {
    let original: Data
    var capture: [String: Any]
    var holdFrontmost = false
    private(set) var frontmostReads = 0
    private var continuation: CheckedContinuation<Void, Never>?
    private var waiting: CheckedContinuation<Void, Never>?

    init() throws {
        original = try makeHistoryPNG(width: 4, height: 2)
        let thumbnail = try makeHistoryPNG(width: 2, height: 1)
        capture = ["imageBase64": original.base64EncodedString(), "thumbnailBase64": thumbnail.base64EncodedString(), "width": 4, "height": 2, "mimeType": "image/png"]
    }

    func frontmostAppWindow() async throws -> [String: Any] {
        frontmostReads += 1
        if holdFrontmost {
            await withCheckedContinuation { continuation in
                self.continuation = continuation
                waiting?.resume()
                waiting = nil
            }
        }
        return ["app": ["bundleId": "test.context", "pid": 123], "window": ["id": 1, "title": "Context"]]
    }

    func accessibilitySnapshot() async throws -> [String: Any] {
        [
            "app": ["bundleId": "test.context", "pid": 123], "window": ["id": 1, "ownerPid": 123, "title": "Context"],
            "root": ["role": "AXWindow", "title": "Context"],
        ]
    }

    func captureScreenshot() async throws -> [String: Any] { capture }
    func activateApp(bundleId: String?) async throws {}
    func performAction(_ arguments: [String: Any]) async throws {}

    func waitForFrontmost() async {
        if continuation == nil { await withCheckedContinuation { waiting = $0 } }
    }

    func resumeFrontmost() {
        continuation?.resume()
        continuation = nil
    }
}

private func makeHistoryPNG(width: Int, height: Int) throws -> Data {
    let context = try XCTUnwrap(CGContext(
        data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ))
    context.setFillColor(CGColor(red: 0.8, green: 0.3, blue: 0.2, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    let image = try XCTUnwrap(context.makeImage())
    let data = NSMutableData()
    let destination = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
    CGImageDestinationAddImage(destination, image, nil)
    XCTAssertTrue(CGImageDestinationFinalize(destination))
    return data as Data
}
