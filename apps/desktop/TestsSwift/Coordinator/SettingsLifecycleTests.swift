import AppKit
import XCTest
@testable import HandAgentDesktop

final class SettingsLifecycleTests: XCTestCase {
    @MainActor
    func testOpenOrFocusFirstTimePresentsAndPromotesPolicy() {
        var presentCount = 0
        let presenter = StubSettingsWindowPresenter { presentCount += 1 }
        var policies: [NSApplication.ActivationPolicy] = []
        let lifecycle = SettingsLifecycle(
            windowPresenter: presenter,
            activationPolicy: AppActivationPolicyCoordinator(),
            setActivationPolicy: { policies.append($0) }
        )

        lifecycle.openOrFocus(
            appearanceViewModel: AppearanceSettingsViewModel(store: AgentSettingsStore()),
            toolSettingsViewModel: ToolSettingsViewModel(),
            agentTriggerSettingsViewModel: AgentTriggerSettingsViewModel(),
            appendPromptSettingsViewModel: AppendPromptSettingsViewModel(),
            shortcutActions: [],
            appTheme: .default,
            onClosed: {}
        )

        XCTAssertEqual(presentCount, 1)
        XCTAssertEqual(policies.last, .regular)
    }

    @MainActor
    func testOpenOrFocusSecondTimeDoesNotRepresent() {
        var presentCount = 0
        let presenter = StubSettingsWindowPresenter { presentCount += 1 }
        let lifecycle = SettingsLifecycle(
            windowPresenter: presenter,
            activationPolicy: AppActivationPolicyCoordinator(),
            setActivationPolicy: { _ in }
        )

        lifecycle.openOrFocus(
            appearanceViewModel: AppearanceSettingsViewModel(store: AgentSettingsStore()),
            toolSettingsViewModel: ToolSettingsViewModel(),
            agentTriggerSettingsViewModel: AgentTriggerSettingsViewModel(),
            appendPromptSettingsViewModel: AppendPromptSettingsViewModel(),
            shortcutActions: [],
            appTheme: .default,
            onClosed: {}
        )
        lifecycle.openOrFocus(
            appearanceViewModel: AppearanceSettingsViewModel(store: AgentSettingsStore()),
            toolSettingsViewModel: ToolSettingsViewModel(),
            agentTriggerSettingsViewModel: AgentTriggerSettingsViewModel(),
            appendPromptSettingsViewModel: AppendPromptSettingsViewModel(),
            shortcutActions: [],
            appTheme: .default,
            onClosed: {}
        )

        XCTAssertEqual(presentCount, 1)
    }

    @MainActor
    func testHandleClosedDemotesPolicy() {
        var policies: [NSApplication.ActivationPolicy] = []
        let lifecycle = SettingsLifecycle(
            windowPresenter: StubSettingsWindowPresenter(),
            activationPolicy: AppActivationPolicyCoordinator(),
            setActivationPolicy: { policies.append($0) }
        )

        lifecycle.openOrFocus(
            appearanceViewModel: AppearanceSettingsViewModel(store: AgentSettingsStore()),
            toolSettingsViewModel: ToolSettingsViewModel(),
            agentTriggerSettingsViewModel: AgentTriggerSettingsViewModel(),
            appendPromptSettingsViewModel: AppendPromptSettingsViewModel(),
            shortcutActions: [],
            appTheme: .default,
            onClosed: {}
        )
        lifecycle.handleClosed()

        XCTAssertEqual(policies.suffix(2), [.regular, .accessory])
    }

    @MainActor
    func testUpdateThemeRefreshesOpenWindow() {
        let presenter = ThemeRefreshingSettingsWindowPresenter()
        let lifecycle = SettingsLifecycle(
            windowPresenter: presenter,
            activationPolicy: AppActivationPolicyCoordinator(),
            setActivationPolicy: { _ in }
        )

        lifecycle.openOrFocus(
            appearanceViewModel: AppearanceSettingsViewModel(store: AgentSettingsStore()),
            toolSettingsViewModel: ToolSettingsViewModel(),
            agentTriggerSettingsViewModel: AgentTriggerSettingsViewModel(),
            appendPromptSettingsViewModel: AppendPromptSettingsViewModel(),
            shortcutActions: [],
            appTheme: .light,
            onClosed: {}
        )

        lifecycle.updateTheme(.dark)

        XCTAssertEqual(presenter.refreshedThemes.count, 1)
    }
}

@MainActor
private final class ThemeRefreshingSettingsWindowPresenter: SettingsWindowPresenting {
    private(set) var refreshedThemes: [AppTheme] = []
    private let window = NSWindow()

    func present(
        appearanceViewModel: AppearanceSettingsViewModel,
        toolSettingsViewModel: ToolSettingsViewModel,
        agentTriggerSettingsViewModel: AgentTriggerSettingsViewModel,
        appendPromptSettingsViewModel: AppendPromptSettingsViewModel,
        shortcutActions: [ActionDefinition],
        appTheme: AppTheme,
        onClose: @escaping () -> Void
    ) -> NSWindow? {
        _ = appearanceViewModel
        _ = toolSettingsViewModel
        _ = agentTriggerSettingsViewModel
        _ = appendPromptSettingsViewModel
        _ = shortcutActions
        _ = onClose
        return window
    }

    func updateTheme(_ appTheme: AppTheme, for window: NSWindow?) {
        refreshedThemes.append(appTheme)
    }
}
