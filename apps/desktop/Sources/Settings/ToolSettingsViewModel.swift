import Foundation

struct BuiltinToolSetting: Identifiable, Equatable {
    enum Risk: String, Equatable {
        case low
        case medium
        case high

        var label: String {
            switch self {
            case .low: return "低风险"
            case .medium: return "中风险"
            case .high: return "高风险"
            }
        }
    }

    let id: String
    let name: String
    let title: String
    let description: String
    let risk: Risk
    var isEnabled: Bool

    var riskLabel: String { risk.label }
}

@Observable
@MainActor
final class ToolSettingsViewModel {
    @ObservationIgnored private let store: AgentSettingsStore
    @ObservationIgnored private let builtinFeatures: BuiltinFeatures?

    private static let catalog: [BuiltinToolSetting] = [
        BuiltinToolSetting(
            id: "file.write",
            name: "file.write",
            title: "文件写入",
            description: "写入或修改 所属桌宠固定目录内的文件。",
            risk: .high,
            isEnabled: true
        )
    ]

    init(store: AgentSettingsStore, builtinFeatures: BuiltinFeatures? = nil) {
        self.store = store
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

    var tools: [BuiltinToolSetting] {
        Self.catalog.map { tool in
            var next = tool
            next.isEnabled = isEnabled(tool.name)
            return next
        }
    }

    func isEnabled(_ toolName: String) -> Bool {
        guard Self.catalog.contains(where: { $0.name == toolName }) else { return true }
        if store.toolSettings.denylist.contains(toolName) {
            return false
        }
        if let allowlist = store.toolSettings.allowlist {
            return allowlist.contains(toolName)
        }
        return true
    }

    func setEnabled(_ toolName: String, enabled: Bool) {
        guard Self.catalog.contains(where: { $0.name == toolName }) else { return }
        store.updateToolSettings { settings in
            var denylist = Set(settings.denylist)
            let allowlist = settings.allowlist

            if enabled {
                denylist.remove(toolName)
                if var allowlist {
                    if !allowlist.contains(toolName) {
                        allowlist.append(toolName)
                        allowlist.sort()
                    }
                    settings.allowlist = allowlist
                }
            } else {
                denylist.insert(toolName)
            }

            settings.denylist = Array(denylist).sorted()
        }
    }
}
