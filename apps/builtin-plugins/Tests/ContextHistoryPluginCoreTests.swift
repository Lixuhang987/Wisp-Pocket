import XCTest
@testable import HandAgentPluginSupport

final class ContextHistoryPluginCoreTests: XCTestCase {
    func testCollectorWritesActivityAndScreenshotThenToolsReturnLayeredResults() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("context-history-tests-\(UUID().uuidString)", isDirectory: true)
        let store = ContextHistoryStore(directoryURL: directory)
        let collector = ContextHistoryCollector(
            store: store,
            capabilityClient: FakeContextHistoryCapabilityClient()
        )
        let router = ContextHistoryToolRouter(store: store)

        let sample = try await collector.collectActivitySample(now: Date(timeIntervalSince1970: 100))
        let screenshot = try await collector.collectScreenshot(
            now: Date(timeIntervalSince1970: 120),
            sampleId: sample.id
        )

        let index = decodeToolJSON(router.handle(
            namespace: "context_history",
            tool: "activity_index",
            arguments: ["limit": 10]
        ))
        let samples = try XCTUnwrap(index["samples"] as? [[String: Any]])
        XCTAssertEqual(samples.count, 1)
        XCTAssertEqual(samples[0]["id"] as? String, sample.id)
        XCTAssertNil(samples[0]["axSummary"])
        XCTAssertNil(samples[0]["imageBase64"])

        let details = decodeToolJSON(router.handle(
            namespace: "context_history",
            tool: "sample_details",
            arguments: ["ids": [sample.id]]
        ))
        let detailedSamples = try XCTUnwrap(details["samples"] as? [[String: Any]])
        let axSummary = try XCTUnwrap(detailedSamples[0]["axSummary"] as? [String: Any])
        XCTAssertEqual(axSummary["role"] as? String, "AXWindow")

        let thumbnails = decodeToolJSON(router.handle(
            namespace: "context_history",
            tool: "thumbnails",
            arguments: ["limit": 10]
        ))
        let thumbnailItems = try XCTUnwrap(thumbnails["thumbnails"] as? [[String: Any]])
        XCTAssertEqual(thumbnailItems[0]["id"] as? String, screenshot.id)
        XCTAssertEqual(thumbnailItems[0]["thumbnailBase64"] as? String, "thumbnail")
        XCTAssertNil(thumbnailItems[0]["imageBase64"])

        let original = decodeToolJSON(router.handle(
            namespace: "context_history",
            tool: "screenshot_original",
            arguments: ["id": screenshot.id]
        ))
        let originalScreenshot = try XCTUnwrap(original["screenshot"] as? [String: Any])
        XCTAssertEqual(originalScreenshot["imageBase64"] as? String, "original")
        XCTAssertEqual(originalScreenshot["mimeType"] as? String, "image/png")

        XCTAssertEqual(try store.loadActivities().count, 1)
        XCTAssertEqual(try store.loadScreenshots().count, 1)
    }

    private func decodeToolJSON(_ result: PluginToolResult) -> [String: Any] {
        guard let text = result.contentItems.first?["text"] as? String,
              let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            XCTFail("Expected JSON tool result")
            return [:]
        }
        return object
    }
}
private final class FakeContextHistoryCapabilityClient: ContextHistoryCapabilityCalling {
    func call(namespace: String, tool: String, arguments: [String: Any]) async throws -> [String: Any] {
        switch (namespace, tool) {
        case ("app_window", "frontmost"):
            return [
                "app": [
                    "name": "Safari",
                    "bundleId": "com.apple.Safari",
                    "pid": 123,
                ],
                "window": [
                    "id": 456,
                    "title": "Example",
                    "appName": "Safari",
                ],
            ]
        case ("ax", "snapshot"):
            return [
                "role": "AXWindow",
                "title": "Example",
                "children": [
                    ["role": "AXButton", "title": "Save"],
                ],
            ]
        case ("screenshot", "capture"):
            return [
                "imageBase64": "original",
                "thumbnailBase64": "thumbnail",
                "width": 1440,
                "height": 900,
            ]
        default:
            throw NSError(domain: "FakeContextHistoryCapabilityClient", code: 1)
        }
    }
}
