import AppKit
import SwiftUI
import XCTest
@testable import HandAgentDesktop

@MainActor
final class ProductionSettingsWindowPresenterTests: XCTestCase {
    func testPresentedWindowKeepsAquaForAppKitControlStabilization() {
        let presenter = ProductionSettingsWindowPresenter()

        let window = presenter.present(
            settingsViewModel: AgentSettingsViewModel(store: AgentSettingsStore()),
            appearanceViewModel: AppearanceSettingsViewModel(store: AgentSettingsStore()),
            toolSettingsViewModel: ToolSettingsViewModel(store: AgentSettingsStore()),
            agentTriggerSettingsViewModel: AgentTriggerSettingsViewModel(),
            appendPromptSettingsViewModel: AppendPromptSettingsViewModel(),
            mcpSettingsViewModel: MCPSettingsViewModel(),
            permissionRulesViewModel: PermissionRulesViewModel(),
            petViewModel: PetSettingsViewModel(),
            shortcutActions: [],
            appTheme: .dark,
            onClose: {}
        )
        defer { window?.close() }

        XCTAssertEqual(
            window?.appearance?.bestMatch(from: [NSAppearance.Name.aqua, NSAppearance.Name.darkAqua]),
            NSAppearance.Name.aqua
        )
        XCTAssertTrue(window?.contentViewController is NSHostingController<AnyView>)
    }

    func testUpdateThemeRefreshesPresentedSettingsRootView() {
        let presenter = ProductionSettingsWindowPresenter()

        let window = presenter.present(
            settingsViewModel: AgentSettingsViewModel(store: AgentSettingsStore()),
            appearanceViewModel: AppearanceSettingsViewModel(store: AgentSettingsStore()),
            toolSettingsViewModel: ToolSettingsViewModel(store: AgentSettingsStore()),
            agentTriggerSettingsViewModel: AgentTriggerSettingsViewModel(),
            appendPromptSettingsViewModel: AppendPromptSettingsViewModel(),
            mcpSettingsViewModel: MCPSettingsViewModel(),
            permissionRulesViewModel: PermissionRulesViewModel(),
            petViewModel: PetSettingsViewModel(),
            shortcutActions: [],
            appTheme: .light,
            onClose: {}
        )
        defer { window?.close() }

        presenter.updateTheme(.dark, for: window)

        let hosting = window?.contentViewController as? NSHostingController<AnyView>
        XCTAssertNotNil(hosting)
    }
}
