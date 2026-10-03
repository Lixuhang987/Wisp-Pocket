import AppKit
import Foundation

@MainActor
final class SettingsLifecycle {
    private let windowPresenter: any SettingsWindowPresenting
    private let activationPolicy: AppActivationPolicyCoordinator
    private let setActivationPolicy: @MainActor (NSApplication.ActivationPolicy) -> Void
    private var window: NSWindow?

    init(
        windowPresenter: any SettingsWindowPresenting,
        activationPolicy: AppActivationPolicyCoordinator,
        setActivationPolicy: @escaping @MainActor (NSApplication.ActivationPolicy) -> Void
    ) {
        self.windowPresenter = windowPresenter
        self.activationPolicy = activationPolicy
        self.setActivationPolicy = setActivationPolicy
    }

    func openOrFocus(
        appearanceViewModel: AppearanceSettingsViewModel,
        toolSettingsViewModel: ToolSettingsViewModel,
        agentTriggerSettingsViewModel: AgentTriggerSettingsViewModel,
        appendPromptSettingsViewModel: AppendPromptSettingsViewModel,
        shortcutActions: [ActionDefinition],
        appTheme: AppTheme,
        onClosed: @escaping @MainActor () -> Void
    ) {
        setActivationPolicy(activationPolicy.policyAfterUpdatingSettingsWindow(isOpen: true))

        if let window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        window = windowPresenter.present(
            appearanceViewModel: appearanceViewModel,
            toolSettingsViewModel: toolSettingsViewModel,
            agentTriggerSettingsViewModel: agentTriggerSettingsViewModel,
            appendPromptSettingsViewModel: appendPromptSettingsViewModel,
            shortcutActions: shortcutActions,
            appTheme: appTheme,
            onClose: { Task { @MainActor in onClosed() } }
        )
    }

    func handleClosed() {
        window = nil
        setActivationPolicy(activationPolicy.policyAfterUpdatingSettingsWindow(isOpen: false))
    }

    func updateTheme(_ appTheme: AppTheme) {
        guard let window else { return }
        windowPresenter.updateTheme(appTheme, for: window)
    }

    func close() {
        window?.close()
        window = nil
    }
}
