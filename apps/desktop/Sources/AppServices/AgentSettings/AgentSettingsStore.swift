import Foundation

private struct NativePreferencesFile: Codable {
    var appearance: AppearanceSettings
}

/// Swift owns native preferences only. Backend model/tool settings use a different file.
@Observable
@MainActor
final class AgentSettingsStore {
    private(set) var appearance: AppearanceSettings
    private(set) var saveErrorMessage: String?
    @ObservationIgnored private let fileManager: FileManager
    @ObservationIgnored private let homeDirectoryURL: URL
    @ObservationIgnored private var lastLoadedData: Data?
    @ObservationIgnored private var pollingTask: Task<Void, Never>?

    init(fileManager: FileManager = .default, homeDirectoryURL: URL = FileManager.default.homeDirectoryForCurrentUser) {
        self.fileManager = fileManager
        self.homeDirectoryURL = homeDirectoryURL
        let state = Self.loadState(homeDirectoryURL: homeDirectoryURL)
        self.appearance = state.appearance
        self.lastLoadedData = state.data
        pollingTask = Task { [weak self] in
            while !Task.isCancelled {
                do { try await Task.sleep(for: .milliseconds(500)) } catch { return }
                guard let self else { return }
                self.reloadFromDisk()
            }
        }
    }

    deinit { pollingTask?.cancel() }

    func updateAppearance(_ mutate: (inout AppearanceSettings) -> Void) {
        var next = appearance
        mutate(&next)
        do {
            let url = Self.settingsFileURL(homeDirectoryURL: homeDirectoryURL)
            try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(NativePreferencesFile(appearance: next))
            try data.write(to: url, options: .atomic)
            appearance = next
            lastLoadedData = data
            saveErrorMessage = nil
        } catch {
            saveErrorMessage = "保存原生偏好失败：\(error.localizedDescription)"
        }
    }

    func reloadFromDisk() {
        let state = Self.loadState(homeDirectoryURL: homeDirectoryURL)
        guard state.data != lastLoadedData else { return }
        appearance = state.appearance
        lastLoadedData = state.data
        saveErrorMessage = nil
    }

    static func settingsFileURL(homeDirectoryURL: URL) -> URL {
        homeDirectoryURL.appendingPathComponent(".spotAgent", isDirectory: true).appendingPathComponent("native-preferences.json")
    }

    private static func loadState(homeDirectoryURL: URL) -> (appearance: AppearanceSettings, data: Data?) {
        guard let data = try? Data(contentsOf: settingsFileURL(homeDirectoryURL: homeDirectoryURL)),
              let file = try? JSONDecoder().decode(NativePreferencesFile.self, from: data) else { return (.defaultValue, nil) }
        return (file.appearance, data)
    }
}
