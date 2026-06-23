import XCTest
@testable import HandAgentDesktop

final class ChromeBookmarksAgentTriggerProviderTests: XCTestCase {
    func testEmitsEventWhenExtensionCreatesBookmarkInConfiguredFolder() throws {
        let source = FakeChromeBookmarksExtensionEventSource()
        let provider = ChromeBookmarksAgentTriggerProvider(eventSource: source)
        let instance = makeInstance(folderIds: ["folder-a"])
        let emission = expectation(description: "bookmark created event emitted")
        var events: [AgentTriggerEvent] = []

        try provider.start(instances: [instance]) {
            events.append($0)
            emission.fulfill()
        }
        source.send(.created(parentId: "folder-a", title: "OpenAI", url: "https://openai.com"))

        wait(for: [emission], timeout: 1.0)
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.providerKind, "chrome.bookmarks")
        XCTAssertEqual(events.first?.triggerInstanceId, "bookmark-review")
        XCTAssertEqual(events.first?.payload["url"], .string("https://openai.com"))
        XCTAssertEqual(events.first?.payload["title"], .string("OpenAI"))
        XCTAssertEqual(events.first?.payload["folderId"], .string("folder-a"))
        XCTAssertEqual(events.first?.payload["profileId"], .string("Default"))
    }

    func testIgnoresCreatedBookmarkOutsideConfiguredFolder() throws {
        let source = FakeChromeBookmarksExtensionEventSource()
        let provider = ChromeBookmarksAgentTriggerProvider(eventSource: source)
        var events: [AgentTriggerEvent] = []

        try provider.start(instances: [makeInstance(folderIds: ["folder-a"])]) {
            events.append($0)
        }
        source.send(.created(parentId: "folder-b", title: "OpenAI", url: "https://openai.com"))
        waitForQueue()

        XCTAssertTrue(events.isEmpty)
    }

    func testIgnoresCreatedFolderWithoutURL() throws {
        let source = FakeChromeBookmarksExtensionEventSource()
        let provider = ChromeBookmarksAgentTriggerProvider(eventSource: source)
        var events: [AgentTriggerEvent] = []

        try provider.start(instances: [makeInstance(folderIds: ["folder-a"])]) {
            events.append($0)
        }
        source.send(ChromeBookmarksExtensionEvent(
            type: "handagent.bookmarks.created",
            protocolVersion: 1,
            eventId: "event-1",
            bookmarkId: "folder-1",
            parentId: "folder-a",
            title: "Reading",
            url: nil,
            profileId: "Default",
            occurredAt: "2026-06-23T00:00:00.000Z",
            extensionVersion: nil,
            extensionInstanceId: nil,
            sentAt: nil
        ))
        waitForQueue()

        XCTAssertTrue(events.isEmpty)
    }

    func testStopDetachesFromEventSource() throws {
        let source = FakeChromeBookmarksExtensionEventSource()
        let provider = ChromeBookmarksAgentTriggerProvider(eventSource: source)
        var events: [AgentTriggerEvent] = []

        try provider.start(instances: [makeInstance(folderIds: ["folder-a"])]) {
            events.append($0)
        }
        try provider.stop()
        source.send(.created(parentId: "folder-a", title: "OpenAI", url: "https://openai.com"))
        waitForQueue()

        XCTAssertEqual(source.stopCount, 1)
        XCTAssertTrue(events.isEmpty)
    }

    private func makeInstance(folderIds: [String]) -> AgentTriggerInstance {
        AgentTriggerInstance(
            id: "bookmark-review",
            packageId: "chrome-bookmarks",
            title: "Bookmark Review",
            enabled: true,
            config: ["folderIds": .stringList(folderIds)],
            promptTemplate: "Summarize {{url}}",
            deliveryPolicy: .default,
            notificationPolicy: .default
        )
    }

    private func waitForQueue() {
        let settled = expectation(description: "queue settled")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            settled.fulfill()
        }
        wait(for: [settled], timeout: 1.0)
    }
}

private final class FakeChromeBookmarksExtensionEventSource: ChromeBookmarksExtensionEventSource {
    private var handler: ((ChromeBookmarksExtensionEvent) -> Void)?
    private(set) var stopCount = 0

    func start(_ handler: @escaping (ChromeBookmarksExtensionEvent) -> Void) throws {
        self.handler = handler
    }

    func stop() throws {
        stopCount += 1
        handler = nil
    }

    func send(_ event: ChromeBookmarksExtensionEvent) {
        handler?(event)
    }
}

private extension ChromeBookmarksExtensionEvent {
    static func created(parentId: String, title: String, url: String) -> ChromeBookmarksExtensionEvent {
        ChromeBookmarksExtensionEvent(
            type: "handagent.bookmarks.created",
            protocolVersion: 1,
            eventId: "event-1",
            bookmarkId: "bookmark-1",
            parentId: parentId,
            title: title,
            url: url,
            profileId: "Default",
            occurredAt: "2026-06-23T00:00:00.000Z",
            extensionVersion: nil,
            extensionInstanceId: nil,
            sentAt: nil
        )
    }
}
