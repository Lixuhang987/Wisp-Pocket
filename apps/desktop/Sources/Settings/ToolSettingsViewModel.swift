import Foundation

@Observable
@MainActor
final class ToolSettingsViewModel {
    @ObservationIgnored private let builtinFeatures: BuiltinFeatures?

    init(builtinFeatures: BuiltinFeatures? = nil) {
        self.builtinFeatures = builtinFeatures
    }

    var hasBuiltinFeatures: Bool { builtinFeatures != nil }
    var automationEnabled: Bool {
        get { builtinFeatures?.settingsStore.settings.automationEnabled ?? false }
        set { builtinFeatures?.settingsStore.update { $0.automationEnabled = newValue } }
    }
    var builtinSettingsError: String? { builtinFeatures?.settingsStore.errorMessage }
    var contextHistoryStatus: String {
        guard let module = builtinFeatures?.contextHistory else { return "采集模块不可用" }
        if let error = module.lastErrorMessage { return "采集失败：\(error)" }
        if let date = module.lastSampleAt { return "最近采样：\(date.formatted(date: .omitted, time: .standard))" }
        return "等待首次采样"
    }

}
