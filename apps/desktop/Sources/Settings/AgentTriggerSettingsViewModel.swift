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

struct ChromeBookmarkFolderOption: Identifiable, Equatable {
    let id: String
    let title: String
    let childCount: Int
    let depth: Int
}

@Observable
@MainActor
final class AgentTriggerSettingsViewModel {
    private(set) var installedPackages: [AgentTriggerPackageEntry] = []
    private(set) var instances: [AgentTriggerInstance] = []
    private(set) var chromeBookmarkFolders: [ChromeBookmarkFolderOption] = []
    private(set) var saveErrorMessage: String?
    private(set) var selectedPackageId: String?
    var targetWorkspaceId = ""
    private(set) var workspaces: [WorkspaceEntry] = []
    var deliveryErrorMessage: String? { store.deliveryErrorMessage }
    @ObservationIgnored private let workspaceClient: (any WorkspaceManaging)?

    @ObservationIgnored private let store: AgentTriggerStore
    @ObservationIgnored private let runtime: (any AgentTriggerRuntimeReloading)?
    @ObservationIgnored private let chromeBookmarksFolderTreeStore: ChromeBookmarksFolderTreeStore
    @ObservationIgnored private let packageConnectionStatusProvider: (AgentTriggerPackageEntry) -> AgentTriggerPackageConnectionStatus?

    init(
        store: AgentTriggerStore = AgentTriggerStore(),
        runtime: (any AgentTriggerRuntimeReloading)? = nil,
        workspaceClient: (any WorkspaceManaging)? = nil,
        chromeBookmarksFolderTreeStore: ChromeBookmarksFolderTreeStore = ChromeBookmarksFolderTreeStore(),
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
        self.workspaceClient = workspaceClient
        self.chromeBookmarksFolderTreeStore = chromeBookmarksFolderTreeStore
        self.packageConnectionStatusProvider = packageConnectionStatusProvider
        reload()
    }

    func reloadWorkspaces() async {
        guard let workspaceClient else { return }
        do { workspaces = try await workspaceClient.listWorkspaces() }
        catch { saveErrorMessage = error.localizedDescription }
    }

    func reload() {
        reloadChromeBookmarkFolders()
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

    func reloadChromeBookmarkFolders() {
        chromeBookmarkFolders = Self.flattenChromeBookmarkFolders(
            chromeBookmarksFolderTreeStore.load()?.folders ?? []
        )
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

    func clearSaveError() {
        saveErrorMessage = nil
    }

    func instances(forPackageId id: String) -> [AgentTriggerInstance] {
        instances.filter { $0.packageId == id }
    }

    func connectionStatus(for package: AgentTriggerPackageEntry) -> AgentTriggerPackageConnectionStatus? {
        packageConnectionStatusProvider(package)
    }

    @discardableResult
    func createChromeBookmarkInstance(
        title: String,
        folderIds: [String],
        promptTemplate: String? = nil
    ) -> Bool {
        let selectedFolderIds = folderIds.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        guard !selectedFolderIds.isEmpty else {
            saveErrorMessage = "至少选择一个收藏夹文件夹"
            return false
        }
        return createInstanceForCurrentPackage(
            title: title,
            config: ["folderIds": .stringList(selectedFolderIds)],
            promptTemplate: promptTemplate
        )
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
        let selectedWorkspace = targetWorkspaceId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !selectedWorkspace.isEmpty else { saveErrorMessage = "请选择目标工作区"; return false }
        let instance = AgentTriggerInstance(
            id: UUID().uuidString,
            packageId: packageId,
            title: trimmedTitle,
            enabled: true,
            config: config,
            promptTemplate: resolvedPromptTemplate,
            deliveryPolicy: manifest.defaultDeliveryPolicy,
            notificationPolicy: manifest.defaultNotificationPolicy,
            targetWorkspaceId: selectedWorkspace
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

    func configSummary(_ instance: AgentTriggerInstance) -> String {
        if instance.packageId == "chrome-bookmarks",
           let folderIds = instance.folderIdsForSummary {
            let namesById = Dictionary(uniqueKeysWithValues: chromeBookmarkFolders.map { ($0.id, "\($0.title) (\($0.childCount))") })
            let folders = folderIds.map { namesById[$0] ?? "未知文件夹" }.joined(separator: ", ")
            return "Folders: \(folders)"
        }
        return instance.config
            .sorted { $0.key < $1.key }
            .map { key, value in
                switch value {
                case .string(let raw):
                    return "\(key): \(raw)"
                case .stringList(let values):
                    return "\(key): \(values.joined(separator: ", "))"
                }
            }
            .joined(separator: " | ")
    }

    private static func flattenChromeBookmarkFolders(
        _ nodes: [ChromeBookmarksFolderTreeNode],
        depth: Int = 0
    ) -> [ChromeBookmarkFolderOption] {
        nodes.flatMap { node in
            [
                ChromeBookmarkFolderOption(
                    id: node.id,
                    title: node.title,
                    childCount: node.childCount,
                    depth: depth
                )
            ] + flattenChromeBookmarkFolders(node.children, depth: depth + 1)
        }
    }
}

private extension AgentTriggerInstance {
    var folderIdsForSummary: [String]? {
        switch config["folderIds"] {
        case .string(let value):
            return [value]
        case .stringList(let values):
            return values
        default:
            return nil
        }
    }
}
