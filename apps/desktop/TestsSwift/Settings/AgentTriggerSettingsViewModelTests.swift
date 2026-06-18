import XCTest
@testable import HandAgentDesktop

final class AgentTriggerSettingsViewModelTests: XCTestCase {
    @MainActor
    func testInstallBuiltinsAddsChromeAndSystemClockPackages() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        let viewModel = AgentTriggerSettingsViewModel(store: store)

        viewModel.installBuiltins()

        XCTAssertEqual(viewModel.installedPackages.map(\.id), ["chrome-bookmarks", "system-clock"])
    }

    @MainActor
    func testCreateInstancePersistsAndReloadsRuntime() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        _ = store.installPackage(
            AgentTriggerPackageManifest(
                version: 1,
                id: "system-clock",
                title: "System Clock",
                description: nil,
                providerKind: "system.clock",
                configSchema: AgentTriggerConfigSchema(fields: []),
                defaultPromptTemplate: "Run the scheduled task.",
                defaultDeliveryPolicy: .default,
                defaultNotificationPolicy: .default
            )
        )
        let runtime = RecordingAgentTriggerRuntime()
        let viewModel = AgentTriggerSettingsViewModel(store: store, runtime: runtime)

        let didCreate = viewModel.createInstance(
            packageId: "system-clock",
            title: "Daily Study",
            config: [
                "scheduleAt": .stringList(["09:00"]),
                "timezone": .string("Asia/Shanghai")
            ]
        )

        XCTAssertTrue(didCreate)
        XCTAssertEqual(viewModel.instances.map(\.title), ["Daily Study"])
        XCTAssertEqual(runtime.reloadCount, 1)
    }
}

@MainActor
private final class RecordingAgentTriggerRuntime: AgentTriggerRuntimeReloading {
    private(set) var reloadCount = 0

    func reload() throws {
        reloadCount += 1
    }
}
