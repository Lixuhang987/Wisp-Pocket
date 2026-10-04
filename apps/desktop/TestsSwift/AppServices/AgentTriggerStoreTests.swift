import XCTest
@testable import HandAgentDesktop

final class AgentTriggerStoreTests: XCTestCase {
    @MainActor
    func testInstallsAndListsTriggerPackages() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)

        XCTAssertTrue(store.installPackage(makeChromeBookmarksManifest()))
        XCTAssertTrue(store.installPackage(makeSystemClockManifest()))

        let packages = store.listInstalledPackages()
        XCTAssertEqual(packages.map(\.id), ["chrome-bookmarks", "system-clock"])
        XCTAssertEqual(packages.map(\.providerKind), ["chrome.bookmarks", "system.clock"])
    }

    @MainActor
    func testEnsureBuiltinPackagesWritesMissingManifests() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)

        let firstWrites = store.ensureBuiltinPackagesInstalled()
        XCTAssertEqual(firstWrites.sorted(), ["chrome-bookmarks", "system-clock"])
        XCTAssertEqual(
            store.listInstalledPackages().map(\.id),
            ["chrome-bookmarks", "system-clock"]
        )

        let chromeManifestURL = AgentTriggerStore.packagesDirectoryURL(homeDirectoryURL: homeURL)
            .appendingPathComponent("chrome-bookmarks", isDirectory: true)
            .appendingPathComponent("trigger.json")
        let originalChromeMTime = try FileManager.default
            .attributesOfItem(atPath: chromeManifestURL.path)[.modificationDate] as? Date

        let secondWrites = store.ensureBuiltinPackagesInstalled()
        XCTAssertEqual(secondWrites, [])
        let chromeMTimeAfter = try FileManager.default
            .attributesOfItem(atPath: chromeManifestURL.path)[.modificationDate] as? Date
        XCTAssertEqual(originalChromeMTime, chromeMTimeAfter)
    }

    @MainActor
    func testEnsureBuiltinPackagesDoesNotOverrideUserEditedManifest() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)

        let customClock = AgentTriggerPackageManifest(
            version: 1,
            id: "system-clock",
            title: "Custom Clock",
            description: "用户自定义副本",
            providerKind: "system.clock",
            configSchema: AgentTriggerConfigSchema(fields: []),
            defaultPromptTemplate: "Custom prompt.",
            defaultDeliveryPolicy: .default,
            defaultNotificationPolicy: .default
        )
        XCTAssertTrue(store.installPackage(customClock))

        let writes = store.ensureBuiltinPackagesInstalled()
        XCTAssertEqual(writes, ["chrome-bookmarks"])

        let installed = store.listInstalledPackages()
        XCTAssertEqual(installed.map(\.id), ["chrome-bookmarks", "system-clock"])
        let clock = installed.first(where: { $0.id == "system-clock" })
        XCTAssertEqual(clock?.title, "Custom Clock")
        XCTAssertEqual(clock?.defaultPromptTemplate, "Custom prompt.")
    }

    @MainActor
    func testDeleteInstanceRemovesMatchingId() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        let kept = AgentTriggerInstance(
            id: "kept",
            packageId: "system-clock",
            title: "Keep",
            enabled: true,
            config: ["scheduleAt": .stringList(["09:00"])],
            promptTemplate: "Keep me.",
            deliveryPolicy: .default,
            notificationPolicy: .default,
                targetWorkspaceId: "workspace-test"
        )
        let removed = AgentTriggerInstance(
            id: "to-remove",
            packageId: "system-clock",
            title: "Drop",
            enabled: true,
            config: ["scheduleAt": .stringList(["10:00"])],
            promptTemplate: "Drop me.",
            deliveryPolicy: .default,
            notificationPolicy: .default,
                targetWorkspaceId: "workspace-test"
        )
        XCTAssertTrue(store.saveInstances([kept, removed]))

        XCTAssertTrue(store.deleteInstance(id: "to-remove"))

        XCTAssertEqual(store.loadInstances().map(\.id), ["kept"])
    }

    @MainActor
    func testSavesAndLoadsInstances() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        let instances = [
            AgentTriggerInstance(
                id: "bookmark-review",
                packageId: "chrome-bookmarks",
                title: "Bookmark Review",
                enabled: true,
                config: [
                    "folderIds": .stringList(["folder-a", "folder-b"])
                ],
                promptTemplate: "Summarize this bookmark.",
                deliveryPolicy: .default,
                notificationPolicy: .default,
                targetWorkspaceId: "workspace-test"
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
                promptTemplate: "Start the daily study routine.",
                deliveryPolicy: .default,
                notificationPolicy: .default,
                targetWorkspaceId: "workspace-test"
            ),
        ]

        XCTAssertTrue(store.saveInstances(instances))
        XCTAssertEqual(store.loadInstances(), instances)
    }

    private func makeChromeBookmarksManifest() -> AgentTriggerPackageManifest {
        AgentTriggerPackageManifest(
            version: 1,
            id: "chrome-bookmarks",
            title: "Chrome Bookmarks",
            description: "Trigger when new bookmarks appear in selected folders.",
            providerKind: "chrome.bookmarks",
            configSchema: AgentTriggerConfigSchema(fields: [
                AgentTriggerConfigField(
                    id: "folderIds",
                    title: "Folders",
                    kind: .stringList,
                    required: true
                )
            ]),
            defaultPromptTemplate: "Summarize the bookmarked page: {{title}} {{url}}",
            defaultDeliveryPolicy: .default,
            defaultNotificationPolicy: .default
        )
    }

    private func makeSystemClockManifest() -> AgentTriggerPackageManifest {
        AgentTriggerPackageManifest(
            version: 1,
            id: "system-clock",
            title: "System Clock",
            description: "Trigger when the local clock reaches configured times.",
            providerKind: "system.clock",
            configSchema: AgentTriggerConfigSchema(fields: [
                AgentTriggerConfigField(
                    id: "scheduleAt",
                    title: "Schedule",
                    kind: .timeList,
                    required: true
                ),
                AgentTriggerConfigField(
                    id: "timezone",
                    title: "Timezone",
                    kind: .timezone,
                    required: true
                )
            ]),
            defaultPromptTemplate: "Run the scheduled task.",
            defaultDeliveryPolicy: .default,
            defaultNotificationPolicy: .default
        )
    }
}
