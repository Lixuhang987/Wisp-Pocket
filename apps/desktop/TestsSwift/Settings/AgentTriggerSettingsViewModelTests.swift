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

        viewModel.targetPetId = "pet-test"
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
        viewModel.targetPetId = "pet-test"
        viewModel.selectPackage(id: "chrome-bookmarks")

        let didCreate = viewModel.createInstanceForCurrentPackage(
            title: "English Reading",
            config: ["folderIds": .stringList(["english"])]
        )

        XCTAssertTrue(didCreate)
        XCTAssertEqual(viewModel.instances.count, 1)
        XCTAssertEqual(viewModel.instances.first?.packageId, "chrome-bookmarks")
        XCTAssertEqual(viewModel.instances.first?.title, "English Reading")
        XCTAssertEqual(viewModel.instances.first?.promptTemplate, "Summarize the bookmarked page: {{title}} {{url}}")
        XCTAssertEqual(runtime.reloadCount, 1)
        XCTAssertEqual(store.loadInstances().count, 1)
        XCTAssertEqual(store.loadInstances().first?.targetPetId, "pet-test")
    }

    @MainActor
    func testChromeBookmarkPackageConnectionStatusComesFromProvider() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let expectedStatus = AgentTriggerPackageConnectionStatus(
            isAvailable: false,
            message: "扩展连接不可用：Native Messaging Host manifest 未安装。"
        )
        let viewModel = AgentTriggerSettingsViewModel(store: store) { package in
            package.providerKind == "chrome.bookmarks" ? expectedStatus : nil
        }
        let chromePackage = try XCTUnwrap(viewModel.installedPackages.first { $0.providerKind == "chrome.bookmarks" })
        let clockPackage = try XCTUnwrap(viewModel.installedPackages.first { $0.providerKind == "system.clock" })

        XCTAssertEqual(viewModel.connectionStatus(for: chromePackage), expectedStatus)
        XCTAssertNil(viewModel.connectionStatus(for: clockPackage))
    }

    @MainActor
    func testCreateChromeBookmarkInstancePersistsCustomPromptTemplate() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let viewModel = AgentTriggerSettingsViewModel(store: store)
        viewModel.targetPetId = "pet-test"
        viewModel.selectPackage(id: "chrome-bookmarks")

        let didCreate = viewModel.createInstanceForCurrentPackage(
            title: "English Reading",
            config: ["folderIds": .stringList(["english"])],
            promptTemplate: "Summarize {{title}} at {{url}}"
        )

        XCTAssertTrue(didCreate)
        XCTAssertEqual(store.loadInstances().first?.promptTemplate, "Summarize {{title}} at {{url}}")
    }

    @MainActor
    func testLoadsChromeBookmarkFolderOptionsFromSnapshot() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        try writeFolderSnapshot(homeURL: homeURL)
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let viewModel = AgentTriggerSettingsViewModel(
            store: store,
            chromeBookmarksFolderTreeStore: ChromeBookmarksFolderTreeStore(homeDirectoryURL: homeURL)
        )

        XCTAssertEqual(viewModel.chromeBookmarkFolders.map(\.title), ["书签栏", "a", "其他书签"])
        XCTAssertEqual(viewModel.chromeBookmarkFolders.map(\.depth), [0, 1, 0])
        XCTAssertEqual(viewModel.chromeBookmarkFolders.first(where: { $0.title == "a" })?.childCount, 1)
    }

    @MainActor
    func testCreateChromeBookmarkInstanceUsesSelectedFolderIdsAndDisplaysNames() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        try writeFolderSnapshot(homeURL: homeURL)
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let viewModel = AgentTriggerSettingsViewModel(
            store: store,
            chromeBookmarksFolderTreeStore: ChromeBookmarksFolderTreeStore(homeDirectoryURL: homeURL)
        )
        viewModel.targetPetId = "pet-test"
        viewModel.selectPackage(id: "chrome-bookmarks")

        let didCreate = viewModel.createChromeBookmarkInstance(
            title: "Read later",
            folderIds: ["6"],
            promptTemplate: "Read {{title}}"
        )

        XCTAssertTrue(didCreate)
        let instance = try XCTUnwrap(store.loadInstances().first)
        XCTAssertEqual(instance.config["folderIds"], .stringList(["6"]))
        XCTAssertEqual(viewModel.configSummary(instance), "Folders: a (1)")
    }

    @MainActor
    func testCreateChromeBookmarkInstanceRequiresFolderSelection() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let viewModel = AgentTriggerSettingsViewModel(store: store)
        viewModel.targetPetId = "pet-test"
        viewModel.selectPackage(id: "chrome-bookmarks")

        let didCreate = viewModel.createChromeBookmarkInstance(
            title: "Read later",
            folderIds: [],
            promptTemplate: "Read {{title}}"
        )

        XCTAssertFalse(didCreate)
        XCTAssertEqual(viewModel.saveErrorMessage, "至少选择一个收藏夹文件夹")
        XCTAssertTrue(store.loadInstances().isEmpty)
    }

    @MainActor
    func testCreateInstanceFailsOnEmptyPromptTemplateWithoutTouchingStore() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let runtime = RecordingAgentTriggerRuntime()
        let viewModel = AgentTriggerSettingsViewModel(store: store, runtime: runtime)
        viewModel.targetPetId = "pet-test"
        viewModel.selectPackage(id: "chrome-bookmarks")

        let didCreate = viewModel.createInstanceForCurrentPackage(
            title: "English Reading",
            config: ["folderIds": .stringList(["english"])],
            promptTemplate: "  "
        )

        XCTAssertFalse(didCreate)
        XCTAssertEqual(viewModel.saveErrorMessage, "提示词不能为空")
        XCTAssertTrue(store.loadInstances().isEmpty)
        XCTAssertEqual(runtime.reloadCount, 0)
    }

    @MainActor
    func testCreateMultipleInstancesUnderSamePackage() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let runtime = RecordingAgentTriggerRuntime()
        let viewModel = AgentTriggerSettingsViewModel(store: store, runtime: runtime)
        viewModel.targetPetId = "pet-test"
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
        viewModel.targetPetId = "pet-test"
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
        viewModel.targetPetId = "pet-test"
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
    func testClearSelectionReturnsToList() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let viewModel = AgentTriggerSettingsViewModel(store: store)
        viewModel.targetPetId = "pet-test"
        viewModel.selectPackage(id: "chrome-bookmarks")
        XCTAssertEqual(viewModel.selectedPackageId, "chrome-bookmarks")

        viewModel.clearSelection()

        XCTAssertNil(viewModel.selectedPackageId)
    }
}

private func writeFolderSnapshot(homeURL: URL) throws {
    try ChromeBookmarksFolderTreeStore(homeDirectoryURL: homeURL).save(ChromeBookmarksFolderTreeSnapshot(
        protocolVersion: 1,
        profileId: "Default",
        folders: [
            ChromeBookmarksFolderTreeNode(
                id: "1",
                title: "书签栏",
                childCount: 2,
                children: [
                    ChromeBookmarksFolderTreeNode(
                        id: "6",
                        title: "a",
                        childCount: 1,
                        children: []
                    )
                ]
            ),
            ChromeBookmarksFolderTreeNode(
                id: "2",
                title: "其他书签",
                childCount: 0,
                children: []
            )
        ],
        updatedAt: "2026-06-23T00:00:00.000Z"
    ))
}

@MainActor
private final class RecordingAgentTriggerRuntime: AgentTriggerRuntimeReloading {
    private(set) var reloadCount = 0

    func reload() throws {
        reloadCount += 1
    }
}
