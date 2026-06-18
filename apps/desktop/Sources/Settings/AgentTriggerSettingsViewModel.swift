import Foundation

struct AgentTriggerPackageEntry: Identifiable, Equatable {
    let id: String
    let title: String
    let providerKind: String
    let description: String
}

@Observable
@MainActor
final class AgentTriggerSettingsViewModel {
    private(set) var installedPackages: [AgentTriggerPackageEntry] = []
    private(set) var instances: [AgentTriggerInstance] = []
    private(set) var saveErrorMessage: String?

    @ObservationIgnored private let store: AgentTriggerStore
    @ObservationIgnored private let runtime: (any AgentTriggerRuntimeReloading)?

    init(
        store: AgentTriggerStore = AgentTriggerStore(),
        runtime: (any AgentTriggerRuntimeReloading)? = nil
    ) {
        self.store = store
        self.runtime = runtime
        reload()
    }

    func reload() {
        installedPackages = store.listInstalledPackages().map {
            AgentTriggerPackageEntry(
                id: $0.id,
                title: $0.title,
                providerKind: $0.providerKind,
                description: $0.description ?? ""
            )
        }
        instances = store.loadInstances()
        saveErrorMessage = store.saveErrorMessage
    }

    func installBuiltins() {
        _ = store.installPackage(Self.chromeBookmarksManifest)
        _ = store.installPackage(Self.systemClockManifest)
        reload()
    }

    @discardableResult
    func createInstance(
        packageId: String,
        title: String,
        config: [String: AgentTriggerConfigValue]
    ) -> Bool {
        guard let manifest = store.listInstalledPackages().first(where: { $0.id == packageId }) else {
            saveErrorMessage = "未找到 AgentTrigger 包"
            return false
        }
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else {
            saveErrorMessage = "标题不能为空"
            return false
        }
        let instance = AgentTriggerInstance(
            id: UUID().uuidString,
            packageId: packageId,
            title: trimmedTitle,
            enabled: true,
            config: config,
            promptTemplate: manifest.defaultPromptTemplate,
            deliveryPolicy: manifest.defaultDeliveryPolicy,
            notificationPolicy: manifest.defaultNotificationPolicy
        )
        var nextInstances = store.loadInstances()
        nextInstances.append(instance)
        let didSave = store.saveInstances(nextInstances)
        if didSave {
            try? runtime?.reload()
        }
        reload()
        return didSave
    }

    private static let chromeBookmarksManifest = AgentTriggerPackageManifest(
        version: 1,
        id: "chrome-bookmarks",
        title: "Chrome Bookmarks",
        description: "监听指定书签文件夹新增的书签。",
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

    private static let systemClockManifest = AgentTriggerPackageManifest(
        version: 1,
        id: "system-clock",
        title: "System Clock",
        description: "在本机时间到达指定时刻时触发任务。",
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
