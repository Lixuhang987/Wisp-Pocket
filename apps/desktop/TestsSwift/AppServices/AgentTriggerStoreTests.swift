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
                promptTemplate: "Start the daily study routine.",
                deliveryPolicy: .default,
                notificationPolicy: .default
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
            defaultPromptTemplate: "Summarize the bookmarked page.",
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
