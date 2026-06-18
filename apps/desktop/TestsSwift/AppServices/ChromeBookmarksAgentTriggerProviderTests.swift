import XCTest
@testable import HandAgentDesktop

final class ChromeBookmarksAgentTriggerProviderTests: XCTestCase {
    @MainActor
    func testEmitsEventWhenObservedBookmarkFolderChanges() async throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let bookmarksURL = try makeChromeBookmarksFile(
            homeURL: homeURL,
            body: """
            {
              "roots": {
                "bookmark_bar": {
                  "id": "bar",
                  "type": "folder",
                  "name": "Bookmarks Bar",
                  "children": [
                    {
                      "id": "folder-a",
                      "type": "folder",
                      "name": "Study",
                      "children": [
                        { "id": "url-1", "type": "url", "name": "OpenAI", "url": "https://openai.com" }
                      ]
                    }
                  ]
                }
              }
            }
            """
        )
        let provider = ChromeBookmarksAgentTriggerProvider(
            homeDirectoryURL: homeURL,
            pollInterval: .milliseconds(50)
        )
        let instance = AgentTriggerInstance(
            id: "bookmark-review",
            packageId: "chrome-bookmarks",
            title: "Bookmark Review",
            enabled: true,
            config: ["folderIds": .stringList(["folder-a"])],
            promptTemplate: "Summarize bookmark",
            deliveryPolicy: .default,
            notificationPolicy: .default
        )
        let emission = expectation(description: "bookmark changed")
        var events: [AgentTriggerEvent] = []

        try provider.start(instances: [instance]) {
            events.append($0)
            emission.fulfill()
        }

        try await Task.sleep(for: .milliseconds(120))
        try """
        {
          "roots": {
            "bookmark_bar": {
              "id": "bar",
              "type": "folder",
              "name": "Bookmarks Bar",
              "children": [
                {
                  "id": "folder-a",
                  "type": "folder",
                  "name": "Study",
                  "children": [
                    { "id": "url-1", "type": "url", "name": "OpenAI", "url": "https://openai.com" },
                    { "id": "url-2", "type": "url", "name": "HandAgent", "url": "https://example.com/handagent" }
                  ]
                }
              ]
            }
          }
        }
        """.write(to: bookmarksURL, atomically: true, encoding: .utf8)

        await fulfillment(of: [emission], timeout: 2.0)

        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.providerKind, "chrome.bookmarks")
        XCTAssertEqual(events.first?.triggerInstanceId, "bookmark-review")
        XCTAssertEqual(events.first?.payload["folderIds"], .stringList(["folder-a"]))
        try provider.stop()
    }

    @MainActor
    func testDoesNotEmitOnInitialBaselineLoad() async throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        _ = try makeChromeBookmarksFile(
            homeURL: homeURL,
            body: """
            {
              "roots": {
                "bookmark_bar": {
                  "id": "bar",
                  "type": "folder",
                  "name": "Bookmarks Bar",
                  "children": [
                    {
                      "id": "folder-a",
                      "type": "folder",
                      "name": "Study",
                      "children": [
                        { "id": "url-1", "type": "url", "name": "OpenAI", "url": "https://openai.com" }
                      ]
                    }
                  ]
                }
              }
            }
            """
        )
        let provider = ChromeBookmarksAgentTriggerProvider(
            homeDirectoryURL: homeURL,
            pollInterval: .milliseconds(50)
        )
        let instance = AgentTriggerInstance(
            id: "bookmark-review",
            packageId: "chrome-bookmarks",
            title: "Bookmark Review",
            enabled: true,
            config: ["folderIds": .stringList(["folder-a"])],
            promptTemplate: "Summarize bookmark",
            deliveryPolicy: .default,
            notificationPolicy: .default
        )
        var events: [AgentTriggerEvent] = []

        try provider.start(instances: [instance]) {
            events.append($0)
        }
        try await Task.sleep(for: .milliseconds(180))

        XCTAssertTrue(events.isEmpty)
        try provider.stop()
    }

    private func makeChromeBookmarksFile(homeURL: URL, body: String) throws -> URL {
        let bookmarksURL = homeURL
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("Application Support", isDirectory: true)
            .appendingPathComponent("Google", isDirectory: true)
            .appendingPathComponent("Chrome", isDirectory: true)
            .appendingPathComponent("Default", isDirectory: true)
            .appendingPathComponent("Bookmarks")
        try FileManager.default.createDirectory(
            at: bookmarksURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try body.write(to: bookmarksURL, atomically: true, encoding: .utf8)
        return bookmarksURL
    }
}
