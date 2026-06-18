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
                notificationPolicy: .default
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
                notificationPolicy: .default
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
                notificationPolicy: .default
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

    init(kind: String) {
        self.kind = kind
    }

    func start(
        instances: [AgentTriggerInstance],
        emit: @escaping (AgentTriggerEvent) -> Void
    ) throws {
        _ = emit
        startCallCount += 1
        startedInstances = instances
    }

    func stop() throws {
        stopCallCount += 1
    }
}
