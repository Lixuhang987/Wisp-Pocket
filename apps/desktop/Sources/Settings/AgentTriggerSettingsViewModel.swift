import Foundation

struct AgentTriggerPackageEntry: Identifiable, Equatable {
    let id: String
    let title: String
    let providerKind: String
    let description: String
    let defaultPromptTemplate: String
}

struct AgentTriggerPackageConnectionStatus: Equatable {
    let isAvailable: Bool
    let message: String
}

@Observable
@MainActor
final class AgentTriggerSettingsViewModel {
    private(set) var installedPackages: [AgentTriggerPackageEntry] = []
    private(set) var instances: [AgentTriggerInstance] = []
    private(set) var saveErrorMessage: String?
    private(set) var selectedPackageId: String?

    @ObservationIgnored private let store: AgentTriggerStore
    @ObservationIgnored private let runtime: (any AgentTriggerRuntimeReloading)?
    @ObservationIgnored private let packageConnectionStatusProvider: (AgentTriggerPackageEntry) -> AgentTriggerPackageConnectionStatus?

    init(
        store: AgentTriggerStore = AgentTriggerStore(),
        runtime: (any AgentTriggerRuntimeReloading)? = nil,
        packageConnectionStatusProvider: @escaping (AgentTriggerPackageEntry) -> AgentTriggerPackageConnectionStatus? = {
            package in
            guard package.providerKind == "chrome.bookmarks" else { return nil }
            let status = ChromeBookmarksNativeHostInstaller.fromEnvironment().installationStatus()
            return AgentTriggerPackageConnectionStatus(
                isAvailable: status.isAvailable,
                message: status.message
            )
        }
    ) {
        self.store = store
        self.runtime = runtime
        self.packageConnectionStatusProvider = packageConnectionStatusProvider
        reload()
    }

    func reload() {
        installedPackages = store.listInstalledPackages().map {
            AgentTriggerPackageEntry(
                id: $0.id,
                title: $0.title,
                providerKind: $0.providerKind,
                description: $0.description ?? "",
                defaultPromptTemplate: $0.defaultPromptTemplate
            )
        }
        instances = store.loadInstances()
        saveErrorMessage = store.saveErrorMessage
        if let selected = selectedPackageId,
           !installedPackages.contains(where: { $0.id == selected }) {
            selectedPackageId = nil
        }
    }

    func selectPackage(id: String) {
        guard installedPackages.contains(where: { $0.id == id }) else { return }
        selectedPackageId = id
        saveErrorMessage = nil
    }

    func clearSelection() {
        selectedPackageId = nil
        saveErrorMessage = nil
    }

    func instances(forPackageId id: String) -> [AgentTriggerInstance] {
        instances.filter { $0.packageId == id }
    }

    func connectionStatus(for package: AgentTriggerPackageEntry) -> AgentTriggerPackageConnectionStatus? {
        packageConnectionStatusProvider(package)
    }

    @discardableResult
    func createInstanceForCurrentPackage(
        title: String,
        config: [String: AgentTriggerConfigValue],
        promptTemplate: String? = nil
    ) -> Bool {
        guard let packageId = selectedPackageId else {
            saveErrorMessage = "未选中触发器"
            return false
        }
        guard let manifest = store.listInstalledPackages().first(where: { $0.id == packageId }) else {
            saveErrorMessage = "未找到 AgentTrigger 包"
            return false
        }
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else {
            saveErrorMessage = "标题不能为空"
            return false
        }
        let resolvedPromptTemplate = (promptTemplate ?? manifest.defaultPromptTemplate)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !resolvedPromptTemplate.isEmpty else {
            saveErrorMessage = "提示词不能为空"
            return false
        }
        let instance = AgentTriggerInstance(
            id: UUID().uuidString,
            packageId: packageId,
            title: trimmedTitle,
            enabled: true,
            config: config,
            promptTemplate: resolvedPromptTemplate,
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

    @discardableResult
    func deleteInstance(id: String) -> Bool {
        let didDelete = store.deleteInstance(id: id)
        if didDelete {
            try? runtime?.reload()
        }
        reload()
        return didDelete
    }
}
