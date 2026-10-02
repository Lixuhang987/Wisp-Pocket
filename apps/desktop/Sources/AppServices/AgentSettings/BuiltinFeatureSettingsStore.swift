import Foundation

struct BuiltinFeatureSettings: Codable, Equatable {
    var automationEnabled = false
}

@Observable
@MainActor
final class BuiltinFeatureSettingsStore {
    private(set) var settings = BuiltinFeatureSettings()
    private(set) var errorMessage: String?
    @ObservationIgnored var onChange: (() -> Void)?
    @ObservationIgnored private let fileURL: URL

    init(homeDirectoryURL: URL = FileManager.default.homeDirectoryForCurrentUser) {
        fileURL = homeDirectoryURL.appendingPathComponent(".spotAgent/builtin-features.json")
        do {
            settings = try JSONDecoder().decode(BuiltinFeatureSettings.self, from: Data(contentsOf: fileURL))
        } catch CocoaError.fileReadNoSuchFile {
            return
        } catch {
            errorMessage = "读取内置功能设置失败：\(error.localizedDescription)"
        }
    }

    func update(_ mutate: (inout BuiltinFeatureSettings) -> Void) {
        var next = settings
        mutate(&next)
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(next)
            try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: fileURL, options: .atomic)
            settings = next
            errorMessage = nil
            onChange?()
        } catch {
            errorMessage = "保存内置功能设置失败：\(error.localizedDescription)"
        }
    }
}
