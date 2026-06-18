import Foundation

struct AgentTriggerInstancesFile: Codable, Equatable {
    var instances: [AgentTriggerInstance]
}

@MainActor
final class AgentTriggerStore {
    private(set) var saveErrorMessage: String?

    @ObservationIgnored private let fileManager: FileManager
    @ObservationIgnored private let homeDirectoryURL: URL

    init(
        homeDirectoryURL: URL = FileManager.default.homeDirectoryForCurrentUser,
        fileManager: FileManager = .default
    ) {
        self.homeDirectoryURL = homeDirectoryURL
        self.fileManager = fileManager
    }

    static func triggersDirectoryURL(homeDirectoryURL: URL) -> URL {
        homeDirectoryURL
            .appendingPathComponent(".spotAgent", isDirectory: true)
            .appendingPathComponent("agent-triggers", isDirectory: true)
    }

    static func packagesDirectoryURL(homeDirectoryURL: URL) -> URL {
        triggersDirectoryURL(homeDirectoryURL: homeDirectoryURL)
            .appendingPathComponent("packages", isDirectory: true)
    }

    static func instancesFileURL(homeDirectoryURL: URL) -> URL {
        triggersDirectoryURL(homeDirectoryURL: homeDirectoryURL)
            .appendingPathComponent("instances.json")
    }

    func listInstalledPackages() -> [AgentTriggerPackageManifest] {
        let packagesDirectoryURL = Self.packagesDirectoryURL(homeDirectoryURL: homeDirectoryURL)
        guard let directories = try? fileManager.contentsOfDirectory(
            at: packagesDirectoryURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        return directories
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
            .compactMap { directory in
                guard (try? directory.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true else {
                    return nil
                }
                let fileURL = directory.appendingPathComponent("trigger.json")
                guard let data = try? Data(contentsOf: fileURL) else {
                    return nil
                }
                return try? AgentTriggerPackageManifest.decode(data)
            }
    }

    @discardableResult
    func installPackage(_ manifest: AgentTriggerPackageManifest) -> Bool {
        let fileURL = Self.packagesDirectoryURL(homeDirectoryURL: homeDirectoryURL)
            .appendingPathComponent(manifest.id, isDirectory: true)
            .appendingPathComponent("trigger.json")
        do {
            try fileManager.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(manifest).write(to: fileURL, options: .atomic)
            saveErrorMessage = nil
            return true
        } catch {
            saveErrorMessage = "保存 AgentTrigger 失败：\(error.localizedDescription)"
            return false
        }
    }

    func loadInstances() -> [AgentTriggerInstance] {
        let fileURL = Self.instancesFileURL(homeDirectoryURL: homeDirectoryURL)
        guard let data = try? Data(contentsOf: fileURL),
              let file = try? JSONDecoder().decode(AgentTriggerInstancesFile.self, from: data) else {
            return []
        }
        return file.instances
    }

    @discardableResult
    func saveInstances(_ instances: [AgentTriggerInstance]) -> Bool {
        let fileURL = Self.instancesFileURL(homeDirectoryURL: homeDirectoryURL)
        do {
            try fileManager.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(AgentTriggerInstancesFile(instances: instances)).write(to: fileURL, options: .atomic)
            saveErrorMessage = nil
            return true
        } catch {
            saveErrorMessage = "保存 AgentTrigger 实例失败：\(error.localizedDescription)"
            return false
        }
    }
}
