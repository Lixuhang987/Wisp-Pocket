import SwiftUI

struct SettingsView: View {
    @Bindable var settingsViewModel: AgentSettingsViewModel
    @Bindable var appearanceViewModel: AppearanceSettingsViewModel
    @Bindable var toolSettingsViewModel: ToolSettingsViewModel
    @Bindable var agentTriggerSettingsViewModel: AgentTriggerSettingsViewModel
    @Bindable var appendPromptSettingsViewModel: AppendPromptSettingsViewModel
    @Bindable var mcpSettingsViewModel: MCPSettingsViewModel
    @Bindable var permissionRulesViewModel: PermissionRulesViewModel
    @Bindable var petViewModel: PetSettingsViewModel
    let shortcutActions: [ActionDefinition]
    @Environment(\.appTheme) private var theme
    @State private var selectedTab = SettingsTab.model

    var body: some View {
        VStack(spacing: 0) {
            SettingsTabBar(tabs: SettingsTab.allCases, selected: $selectedTab)
            SettingsSectionSeparator()
            tabContent
        }
        .frame(width: 680, height: 560)
        .background(theme.colors.canvas)
    }

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .model:
            AgentSettingsView(viewModel: settingsViewModel)
        case .appearance:
            AppearanceSettingsView(viewModel: appearanceViewModel)
        case .tools:
            ToolSettingsView(viewModel: toolSettingsViewModel)
        case .agentTriggers:
            AgentTriggerSettingsView(viewModel: agentTriggerSettingsViewModel)
        case .appendPrompts:
            AppendPromptSettingsView(viewModel: appendPromptSettingsViewModel)
        case .mcp:
            MCPSettingsView(viewModel: mcpSettingsViewModel)
        case .permissions:
            PermissionRulesView(viewModel: permissionRulesViewModel)
        case .shortcuts:
            ShortcutSettingsView(actions: shortcutActions)
        case .pets:
            PetSettingsView(viewModel: petViewModel)
        }
    }
}
