import XCTest
@testable import HandAgentDesktop

final class AgentTriggerRuntimeTests: XCTestCase {
    @MainActor
    func testReloadStartsProvidersForInstalledKindsWithEnabledInstances() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        XCTAssertTrue(store.installPackage(makeManifest(id: "chrome-bookmarks", kind: "chrome.bookmarks")))
        XCTAssertTrue(store.installPackage(makeManifest(id: "system-clock", kind: "system.clock")))
        XCTAssertTrue(store.saveInstances([
            AgentTriggerInstance(
                id: "bookmark-review",
                packageId: "chrome-bookmarks",
                title: "Bookmark Review",
                enabled: true,
                config: ["folderIds": .stringList(["folder-a"])],
                promptTemplate: "Summarize bookmark",
                deliveryPolicy: .default,
                notificationPolicy: .default,
                targetPetId: "pet-test"
            ),
            AgentTriggerInstance(
                id: "daily-study",
                packageId: "system-clock",
                title: "Daily Study",
                enabled: true,
                config: [
                    "scheduleAt": .stringList(["09:00"]),
                    "timezone": .string("Asia/Shanghai")
                ],
                promptTemplate: "Run scheduled task",
                deliveryPolicy: .default,
                notificationPolicy: .default,
                targetPetId: "pet-test"
            ),
        ]))

        let chromeProvider = RecordingAgentTriggerProvider(kind: "chrome.bookmarks")
        let systemProvider = RecordingAgentTriggerProvider(kind: "system.clock")
        let runtime = AgentTriggerRuntime(
            registry: AgentTriggerRegistry(factories: [
                RecordingAgentTriggerProviderFactory(provider: chromeProvider),
                RecordingAgentTriggerProviderFactory(provider: systemProvider),
            ]),
            store: store
        )

        try runtime.reload()

        XCTAssertEqual(chromeProvider.startedInstances.map(\.id), ["bookmark-review"])
        XCTAssertEqual(systemProvider.startedInstances.map(\.id), ["daily-study"])
    }

    @MainActor
    func testReloadStopsExistingProvidersBeforeRestart() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        XCTAssertTrue(store.installPackage(makeManifest(id: "chrome-bookmarks", kind: "chrome.bookmarks")))
        XCTAssertTrue(store.saveInstances([
            AgentTriggerInstance(
                id: "bookmark-review",
                packageId: "chrome-bookmarks",
                title: "Bookmark Review",
                enabled: true,
                config: ["folderIds": .stringList(["folder-a"])],
                promptTemplate: "Summarize bookmark",
                deliveryPolicy: .default,
                notificationPolicy: .default,
                targetPetId: "pet-test"
            )
        ]))

        let chromeProvider = RecordingAgentTriggerProvider(kind: "chrome.bookmarks")
        let runtime = AgentTriggerRuntime(
            registry: AgentTriggerRegistry(factories: [
                RecordingAgentTriggerProviderFactory(provider: chromeProvider),
            ]),
            store: store
        )

        try runtime.reload()
        try runtime.reload()

        XCTAssertEqual(chromeProvider.startCallCount, 2)
        XCTAssertEqual(chromeProvider.stopCallCount, 1)
    }

    @MainActor
    func testReloadStartsInstalledProviderWithoutInstances() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        XCTAssertTrue(store.installPackage(makeManifest(id: "chrome-bookmarks", kind: "chrome.bookmarks")))
        let chromeProvider = RecordingAgentTriggerProvider(kind: "chrome.bookmarks")
        let runtime = AgentTriggerRuntime(
            registry: AgentTriggerRegistry(factories: [
                RecordingAgentTriggerProviderFactory(provider: chromeProvider),
            ]),
            store: store
        )

        try runtime.reload()

        XCTAssertEqual(chromeProvider.startCallCount, 1)
        XCTAssertTrue(chromeProvider.startedInstances.isEmpty)
    }

    @MainActor
    func testRendersBookmarkPayloadFieldsIntoPromptTemplate() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        XCTAssertTrue(store.installPackage(makeManifest(id: "chrome-bookmarks", kind: "chrome.bookmarks")))
        XCTAssertTrue(store.saveInstances([
            AgentTriggerInstance(
                id: "bookmark-review",
                packageId: "chrome-bookmarks",
                title: "Bookmark Review",
                enabled: true,
                config: ["folderIds": .stringList(["folder-a"])],
                promptTemplate: "Read {{title}} at {{url}} from {{folderId}}",
                deliveryPolicy: .default,
                notificationPolicy: .default,
                targetPetId: "pet-test"
            )
        ]))

        let chromeProvider = RecordingAgentTriggerProvider(kind: "chrome.bookmarks")
        let submitted = expectation(description: "agent trigger prompt submitted")
        var prompts: [PromptSubmission] = []
        let runtime = AgentTriggerRuntime(
            registry: AgentTriggerRegistry(factories: [
                RecordingAgentTriggerProviderFactory(provider: chromeProvider),
            ]),
            store: store,
            submit: {
                prompts.append($0)
                submitted.fulfill()
            }
        )

        try runtime.reload()
        chromeProvider.emitEvent(AgentTriggerEvent(
            triggerInstanceId: "bookmark-review",
            providerKind: "chrome.bookmarks",
            occurredAt: "2026-06-23T00:00:00.000Z",
            summary: "Bookmarked OpenAI",
            payload: [
                "url": .string("https://openai.com"),
                "title": .string("OpenAI"),
                "folderId": .string("folder-a")
            ]
        ))

        wait(for: [submitted], timeout: 1.0)
        XCTAssertEqual(prompts.count, 1)
        XCTAssertEqual(prompts.first?.targetPetId, "pet-test")
        guard case .text(_, let text) = prompts.first?.userInput.items.first else {
            return XCTFail("Expected text input item")
        }
        XCTAssertEqual(text, "Read OpenAI at https://openai.com from folder-a")
        XCTAssertEqual(prompts.first?.summary, "Bookmark Review")
    }

    @MainActor
    func testProviderEventsEmittedOffMainQueueStillFirePayloadOnMainActor() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        XCTAssertTrue(store.installPackage(makeManifest(id: "chrome-bookmarks", kind: "chrome.bookmarks")))
        XCTAssertTrue(store.saveInstances([
            AgentTriggerInstance(
                id: "bookmark-review",
                packageId: "chrome-bookmarks",
                title: "Bookmark Review",
                enabled: true,
                config: ["folderIds": .stringList(["folder-a"])],
                promptTemplate: "Summarize {{url}}",
                deliveryPolicy: .default,
                notificationPolicy: .default,
                targetPetId: "pet-test"
            )
        ]))

        let chromeProvider = RecordingAgentTriggerProvider(kind: "chrome.bookmarks")
        let submitted = expectation(description: "agent trigger prompt submitted")
        var prompts: [PromptSubmission] = []
        let runtime = AgentTriggerRuntime(
            registry: AgentTriggerRegistry(factories: [
                RecordingAgentTriggerProviderFactory(provider: chromeProvider),
            ]),
            store: store,
            submit: { prompt in
                XCTAssertTrue(Thread.isMainThread)
                prompts.append(prompt)
                submitted.fulfill()
            }
        )

        try runtime.reload()
        let event = AgentTriggerEvent(
            triggerInstanceId: "bookmark-review",
            providerKind: "chrome.bookmarks",
            occurredAt: "2026-06-23T00:00:00.000Z",
            summary: "Bookmarked OpenAI",
            payload: [
                "url": .string("https://openai.com"),
                "title": .string("OpenAI"),
                "folderId": .string("folder-a")
            ]
        )
        let providerEmit = { chromeProvider.emitEvent(event) }
        DispatchQueue(label: "test.chrome-bookmarks.provider").async {
            providerEmit()
        }

        wait(for: [submitted], timeout: 1.0)
        XCTAssertEqual(prompts.count, 1)
        XCTAssertEqual(prompts.first?.targetPetId, "pet-test")
        guard case .text(_, let text) = prompts.first?.userInput.items.first else {
            return XCTFail("Expected text input item")
        }
        XCTAssertEqual(text, "Summarize https://openai.com")
    }

    private func makeManifest(id: String, kind: String) -> AgentTriggerPackageManifest {
        AgentTriggerPackageManifest(
            version: 1,
            id: id,
            title: id,
            description: nil,
            providerKind: kind,
            configSchema: AgentTriggerConfigSchema(fields: []),
            defaultPromptTemplate: "Prompt",
            defaultDeliveryPolicy: .default,
            defaultNotificationPolicy: .default
        )
    }
}

private final class RecordingAgentTriggerProviderFactory: AgentTriggerProviderFactory {
    private let provider: RecordingAgentTriggerProvider

    init(provider: RecordingAgentTriggerProvider) {
        self.provider = provider
    }

    func descriptor() -> AgentTriggerProviderDescriptor {
        AgentTriggerProviderDescriptor(kind: provider.kind, displayName: provider.kind)
    }

    func createHostProvider() -> any AgentTriggerProvider {
        provider
    }
}

private final class RecordingAgentTriggerProvider: AgentTriggerProvider {
    let kind: String
    private(set) var startCallCount = 0
    private(set) var stopCallCount = 0
    private(set) var startedInstances: [AgentTriggerInstance] = []
    private var emit: ((AgentTriggerEvent) -> Void)?

    init(kind: String) {
        self.kind = kind
    }

    func start(
        instances: [AgentTriggerInstance],
        emit: @escaping (AgentTriggerEvent) -> Void
    ) throws {
        self.emit = emit
        startCallCount += 1
        startedInstances = instances
    }

    func stop() throws {
        stopCallCount += 1
        emit = nil
    }

    func emitEvent(_ event: AgentTriggerEvent) {
        emit?(event)
    }
}
