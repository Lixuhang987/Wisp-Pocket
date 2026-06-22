import SwiftUI

// MARK: - Tab Bar

enum SettingsTab: String, CaseIterable, Identifiable {
    case model
    case appearance
    case tools
    case agentTriggers
    case appendPrompts
    case mcp
    case permissions
    case shortcuts
    case workspaces

    var id: String { rawValue }

    var title: String {
        switch self {
        case .model: return "模型"
        case .appearance: return "外观"
        case .tools: return "工具"
        case .agentTriggers: return "触发器"
        case .appendPrompts: return "追加"
        case .mcp: return "MCP"
        case .permissions: return "权限"
        case .shortcuts: return "快捷键"
        case .workspaces: return "工作区"
        }
    }

    var icon: String {
        switch self {
        case .model: return "cpu"
        case .appearance: return "circle.lefthalf.filled"
        case .tools: return "slider.horizontal.3"
        case .agentTriggers: return "bolt.badge.clock"
        case .appendPrompts: return "text.badge.plus"
        case .mcp: return "server.rack"
        case .permissions: return "lock.shield"
        case .shortcuts: return "keyboard"
        case .workspaces: return "folder"
        }
    }
}

struct SettingsTabBar: View {
    let tabs: [SettingsTab]
    @Binding var selected: SettingsTab
    @Environment(\.appTheme) private var theme

    var body: some View {
        HStack(spacing: theme.spacing.sm) {
            ForEach(tabs) { tab in
                tabButton(tab)
            }
        }
        .padding(.horizontal, theme.spacing.lg)
        .padding(.top, theme.spacing.sm)
        .padding(.bottom, theme.spacing.sm)
        .background(theme.colors.surfaceSoft)
    }

    private func tabButton(_ tab: SettingsTab) -> some View {
        let isSelected = selected == tab
        return Button {
            selected = tab
        } label: {
            VStack(spacing: 4) {
                Image(systemName: tab.icon)
                    .font(.system(size: 20))
                    .frame(height: 24)
                Text(tab.title)
                    .font(.system(size: 11))
            }
            .foregroundStyle(isSelected ? theme.colors.ink : theme.colors.muted)
            .frame(maxWidth: .infinity, minHeight: 56)
            .borderedCard(
                fill: isSelected ? theme.colors.canvas : Color.clear,
                border: isSelected ? theme.colors.accentRing : Color.clear,
                cornerRadius: theme.radius.md
            )
            .overlay(alignment: .bottom) {
                RoundedRectangle(cornerRadius: theme.radius.pill)
                    .fill(isSelected ? theme.colors.accent : Color.clear)
                    .frame(width: 28, height: 2)
                    .offset(y: -4)
            }
            .contentShape(RoundedRectangle(cornerRadius: theme.radius.md))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Settings semantic wrappers over Common

typealias SettingsSectionHeader = CommonSectionHeader
typealias SettingsSection<Content: View> = CommonSection<Content>
typealias SettingsRow<Control: View> = CommonRow<Control>
typealias SettingsRowDivider = CommonRowDivider
typealias SettingsSegmentedControl<Option: Identifiable & Equatable> = CommonSegmentedControl<Option>
typealias SettingsTextEditor = CommonTextEditor
typealias SettingsSectionSeparator = CommonSectionSeparator
typealias SettingsPage<Content: View> = CommonPage<Content>
typealias SettingsTextField = CommonTextField
typealias SettingsSecureField = CommonSecureField
typealias SettingsActionButton = CommonActionButton
typealias SettingsIconButton = CommonIconButton
typealias SettingsFormActions<Leading: View, Trailing: View> = CommonFormActions<Leading, Trailing>
typealias SettingsEmptyState = CommonEmptyState
typealias SettingsErrorFooter = CommonErrorFooter

struct SettingsListSection<Data: RandomAccessCollection, RowContent: View>: View where Data.Element: Identifiable {
    let items: Data
    private let rowContent: (Data.Element) -> RowContent

    init(_ items: Data, @ViewBuilder rowContent: @escaping (Data.Element) -> RowContent) {
        self.items = items
        self.rowContent = rowContent
    }

    init(items: Data, @ViewBuilder rowContent: @escaping (Data.Element) -> RowContent) {
        self.items = items
        self.rowContent = rowContent
    }

    var body: some View {
        CommonListSection(items, rowContent: rowContent)
    }
}
