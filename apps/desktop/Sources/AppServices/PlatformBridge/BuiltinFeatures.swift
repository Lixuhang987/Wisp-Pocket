import Foundation
import HandAgentHostAutomation

@MainActor
final class BuiltinFeatures {
    let settingsStore: BuiltinFeatureSettingsStore
    let contextHistory: ContextHistoryModule
    let automation: AutomationModule
    var onToolsChanged: (() -> Void)?
    private var isStarted = false

    init(settingsStore: BuiltinFeatureSettingsStore, contextHistory: ContextHistoryModule, automation: AutomationModule) {
        self.settingsStore = settingsStore
        self.contextHistory = contextHistory
        self.automation = automation
    }

    var dynamicToolSpecs: [[String: Any]] {
        guard isStarted else { return [] }
        return settingsStore.settings.automationEnabled ? BuiltinFeatureToolSpecs.automation : []
    }

    func start() {
        guard !isStarted else { return }
        isStarted = true
        settingsStore.onChange = { [weak self] in self?.applySettings() }
        applySettings()
    }

    func stop() {
        isStarted = false
        settingsStore.onChange = nil
        contextHistory.stop()
        automation.stop()
        onToolsChanged?()
    }

    func stopAndWait() async {
        stop()
        await automation.stopAndWait()
    }

    func handle(namespace: String, tool: String, arguments: Any?) async -> DynamicToolResult? {
        guard isStarted else { return nil }
        switch namespace {
        case "automation":
            return await automation.handle(tool: tool, arguments: arguments)
        default:
            return nil
        }
    }

    private func applySettings() {
        guard isStarted else { return }
        contextHistory.start()
        if settingsStore.settings.automationEnabled { automation.start() }
        else { automation.stop() }
        onToolsChanged?()
    }
}
