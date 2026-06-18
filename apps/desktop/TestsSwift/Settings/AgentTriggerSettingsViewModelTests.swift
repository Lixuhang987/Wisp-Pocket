import XCTest
@testable import HandAgentDesktop

final class AgentTriggerSettingsViewModelTests: XCTestCase {
    @MainActor
    func testInitListsBuiltinPackagesWhenStorePreInstalled() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()

        let viewModel = AgentTriggerSettingsViewModel(store: store)

        XCTAssertEqual(viewModel.installedPackages.map(\.id), ["chrome-bookmarks", "system-clock"])
        XCTAssertNil(viewModel.selectedPackageId)
        XCTAssertTrue(viewModel.instances.isEmpty)
    }

    @MainActor
    func testSelectingPackageEntersDetail() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let viewModel = AgentTriggerSettingsViewModel(store: store)

        viewModel.selectPackage(id: "chrome-bookmarks")

        XCTAssertEqual(viewModel.selectedPackageId, "chrome-bookmarks")
        XCTAssertTrue(viewModel.instances(forPackageId: "chrome-bookmarks").isEmpty)
    }

    @MainActor
    func testCreateInstanceForCurrentPackagePersistsAndReloads() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let runtime = RecordingAgentTriggerRuntime()
        let viewModel = AgentTriggerSettingsViewModel(store: store, runtime: runtime)
        viewModel.selectPackage(id: "chrome-bookmarks")

        let didCreate = viewModel.createInstanceForCurrentPackage(
            title: "English Reading",
            config: ["folderIds": .stringList(["english"])]
        )

        XCTAssertTrue(didCreate)
        XCTAssertEqual(viewModel.instances.count, 1)
        XCTAssertEqual(viewModel.instances.first?.packageId, "chrome-bookmarks")
        XCTAssertEqual(viewModel.instances.first?.title, "English Reading")
        XCTAssertEqual(runtime.reloadCount, 1)
        XCTAssertEqual(store.loadInstances().count, 1)
    }

    @MainActor
    func testCreateMultipleInstancesUnderSamePackage() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let runtime = RecordingAgentTriggerRuntime()
        let viewModel = AgentTriggerSettingsViewModel(store: store, runtime: runtime)
        viewModel.selectPackage(id: "system-clock")

        XCTAssertTrue(viewModel.createInstanceForCurrentPackage(
            title: "工作日 09:00 总结",
            config: [
                "scheduleAt": .stringList(["09:00"]),
                "timezone": .string("Asia/Shanghai")
            ]
        ))
        XCTAssertTrue(viewModel.createInstanceForCurrentPackage(
            title: "周一 10:00 拉一遍 PR",
            config: [
                "scheduleAt": .stringList(["10:00"]),
                "timezone": .string("Asia/Shanghai")
            ]
        ))

        XCTAssertEqual(viewModel.instances(forPackageId: "system-clock").count, 2)
        XCTAssertEqual(runtime.reloadCount, 2)
    }

    @MainActor
    func testDeleteInstanceRemovesFromStoreAndReloads() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let runtime = RecordingAgentTriggerRuntime()
        let viewModel = AgentTriggerSettingsViewModel(store: store, runtime: runtime)
        viewModel.selectPackage(id: "system-clock")
        XCTAssertTrue(viewModel.createInstanceForCurrentPackage(
            title: "Daily",
            config: ["scheduleAt": .stringList(["09:00"]), "timezone": .string("UTC")]
        ))
        let createdId = viewModel.instances(forPackageId: "system-clock").first?.id ?? ""

        let didDelete = viewModel.deleteInstance(id: createdId)

        XCTAssertTrue(didDelete)
        XCTAssertTrue(viewModel.instances(forPackageId: "system-clock").isEmpty)
        XCTAssertEqual(runtime.reloadCount, 2)
    }

    @MainActor
    func testCreateInstanceFailsOnEmptyTitleWithoutTouchingStore() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let runtime = RecordingAgentTriggerRuntime()
        let viewModel = AgentTriggerSettingsViewModel(store: store, runtime: runtime)
        viewModel.selectPackage(id: "chrome-bookmarks")

        let didCreate = viewModel.createInstanceForCurrentPackage(
            title: "  ",
            config: ["folderIds": .stringList(["x"])]
        )

        XCTAssertFalse(didCreate)
        XCTAssertEqual(viewModel.saveErrorMessage, "标题不能为空")
        XCTAssertTrue(store.loadInstances().isEmpty)
        XCTAssertEqual(runtime.reloadCount, 0)
    }

    @MainActor
    func testCreateInstanceWithoutSelectedPackageFailsSafely() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let runtime = RecordingAgentTriggerRuntime()
        let viewModel = AgentTriggerSettingsViewModel(store: store, runtime: runtime)

        let didCreate = viewModel.createInstanceForCurrentPackage(
            title: "anything",
            config: [:]
        )

        XCTAssertFalse(didCreate)
        XCTAssertEqual(viewModel.saveErrorMessage, "未选中触发器")
        XCTAssertTrue(store.loadInstances().isEmpty)
        XCTAssertEqual(runtime.reloadCount, 0)
    }

    @MainActor
    func testRestoreBuiltinPackagesRewritesMissingManifests() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let chromeDir = AgentTriggerStore.packagesDirectoryURL(homeDirectoryURL: homeURL)
            .appendingPathComponent("chrome-bookmarks", isDirectory: true)
        try FileManager.default.removeItem(at: chromeDir)
        let runtime = RecordingAgentTriggerRuntime()
        let viewModel = AgentTriggerSettingsViewModel(store: store, runtime: runtime)
        XCTAssertEqual(viewModel.installedPackages.count, 1)

        viewModel.restoreBuiltinPackages()

        XCTAssertEqual(viewModel.installedPackages.count, 2)
        XCTAssertEqual(runtime.reloadCount, 1)
    }

    @MainActor
    func testClearSelectionReturnsToList() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let viewModel = AgentTriggerSettingsViewModel(store: store)
        viewModel.selectPackage(id: "chrome-bookmarks")
        XCTAssertEqual(viewModel.selectedPackageId, "chrome-bookmarks")

        viewModel.clearSelection()

        XCTAssertNil(viewModel.selectedPackageId)
    }
}

@MainActor
private final class RecordingAgentTriggerRuntime: AgentTriggerRuntimeReloading {
    private(set) var reloadCount = 0

    func reload() throws {
        reloadCount += 1
    }
}
