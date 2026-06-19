import Foundation

struct ActionManifestLoadResult: Equatable {
    let actions: [ActionDefinition]
    let disabled: [DisabledActionDefinition]
}

struct ActionManifestStore {
    static let manifestFileName = "action.json"

    let actionsDirectoryURL: URL

    init(
        actionsDirectoryURL: URL = FileManager.default
            .homeDirectoryForCurrentUser
            .appendingPathComponent(".spotAgent/actions", isDirectory: true)
    ) {
        self.actionsDirectoryURL = actionsDirectoryURL
    }

    func load() -> ActionManifestLoadResult {
        let fileManager = FileManager.default
        guard let directories = try? fileManager.contentsOfDirectory(
            at: actionsDirectoryURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return ActionManifestLoadResult(actions: [], disabled: [])
        }

        var manifests: [ActionManifestDefinition] = []
        var disabled: [DisabledActionDefinition] = []

        for directory in directories.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
            let values = try? directory.resourceValues(forKeys: [.isDirectoryKey])
            guard values?.isDirectory == true else { continue }

            let actionPackageId = directory.lastPathComponent
            let manifestURL = directory.appendingPathComponent(Self.manifestFileName)
            do {
                let data = try Data(contentsOf: manifestURL)
                let manifest = try ActionManifestDefinition.decode(data)
                guard manifest.id == actionPackageId else {
                    disabled.append(.init(id: "action:\(actionPackageId)", reason: "action manifest id must match directory name"))
                    continue
                }
                manifests.append(manifest)
            } catch {
                disabled.append(.init(id: "action:\(actionPackageId)", reason: "action manifest not readable"))
            }
        }

        let built = ActionDefinition.buildActions(from: manifests)
        return ActionManifestLoadResult(actions: built.enabled, disabled: disabled + built.disabled)
    }
}
