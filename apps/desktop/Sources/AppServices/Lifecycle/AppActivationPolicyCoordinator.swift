import AppKit

@MainActor
final class AppActivationPolicyCoordinator {
    private var isSettingsWindowOpen = false

    func policyAfterUpdatingSettingsWindow(isOpen: Bool) -> NSApplication.ActivationPolicy {
        isSettingsWindowOpen = isOpen
        return currentPolicy()
    }

    func currentPolicy() -> NSApplication.ActivationPolicy {
        isSettingsWindowOpen ? .regular : .accessory
    }
}
