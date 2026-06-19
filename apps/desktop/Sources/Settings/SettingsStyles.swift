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

// MARK: - Section

struct SettingsSectionHeader: View {
    @Environment(\.appTheme) private var theme
    let title: String

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title)
            .font(theme.typography.captionFont.weight(.semibold))
            .foregroundStyle(theme.colors.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, theme.spacing.xxl)
            .padding(.top, theme.spacing.lg)
            .padding(.bottom, theme.spacing.xs)
    }
}

struct SettingsSection<Content: View>: View {
    @Environment(\.appTheme) private var theme
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            content()
        }
        .padding(.vertical, theme.spacing.lg)
        .padding(.horizontal, theme.spacing.xxl)
    }
}

struct SettingsListSection<Data: RandomAccessCollection, RowContent: View>: View where Data.Element: Identifiable {
    let items: Data
    @ViewBuilder let rowContent: (Data.Element) -> RowContent

    var body: some View {
        SettingsSection {
            let firstID = items.first?.id
            ForEach(items) { item in
                if item.id != firstID {
                    SettingsRowDivider()
                }
                rowContent(item)
            }
        }
    }
}

// MARK: - Row (left label, right control)

struct SettingsRow<Control: View>: View {
    @Environment(\.appTheme) private var theme
    let label: String
    @ViewBuilder let control: () -> Control

    init(_ label: String, @ViewBuilder control: @escaping () -> Control) {
        self.label = label
        self.control = control
    }

    var body: some View {
        HStack(alignment: .center, spacing: theme.spacing.xl) {
            Text(label)
                .font(theme.typography.bodyFont)
                .foregroundStyle(theme.colors.body)
                .frame(width: 120, alignment: .trailing)
            control()
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, theme.spacing.md)
    }
}

// MARK: - Row Divider

struct SettingsRowDivider: View {
    @Environment(\.appTheme) private var theme

    var body: some View {
        Divider()
            .overlay(theme.colors.hairline)
            .padding(.leading, 152)
    }
}

// MARK: - Segmented Control

struct SettingsSegmentedControl<Option: Identifiable & Equatable>: View {
    let options: [Option]
    @Binding var selection: Option
    let title: (Option) -> String
    @Environment(\.appTheme) private var theme

    init(
        _ options: [Option],
        selection: Binding<Option>,
        title: @escaping (Option) -> String
    ) {
        self.options = options
        self._selection = selection
        self.title = title
    }

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options) { option in
                segment(option)
            }
        }
        .padding(3)
        .background(
            RoundedRectangle(cornerRadius: theme.radius.md)
                .fill(theme.colors.surfaceSoft)
        )
        .overlay(
            RoundedRectangle(cornerRadius: theme.radius.md)
                .strokeBorder(theme.colors.hairline, lineWidth: 0.8)
        )
    }

    private func segment(_ option: Option) -> some View {
        let isSelected = selection == option
        return Button {
            selection = option
        } label: {
            Text(title(option))
                .font(theme.typography.captionFont.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.82)
                .foregroundStyle(isSelected ? theme.colors.textPrimary : theme.colors.textSecondary)
                .frame(maxWidth: .infinity, minHeight: 30)
                .padding(.horizontal, theme.spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: theme.radius.sm)
                        .fill(isSelected ? theme.colors.surfaceElevated : Color.clear)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: theme.radius.sm)
                        .strokeBorder(isSelected ? theme.colors.accentRing : Color.clear, lineWidth: 0.8)
                )
                .contentShape(RoundedRectangle(cornerRadius: theme.radius.sm))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title(option))
    }
}

// MARK: - Field Style

struct SettingsFieldStyle: TextFieldStyle {
    @Environment(\.appTheme) private var theme

    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .textFieldStyle(.plain)
            .font(theme.typography.bodyFont)
            .foregroundStyle(theme.colors.textPrimary)
            .padding(.horizontal, theme.spacing.md)
            .padding(.vertical, 8)
            .frame(maxWidth: 340)
            .background(
                RoundedRectangle(cornerRadius: theme.radius.sm)
                    .fill(theme.colors.surfaceSoft)
            )
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.sm)
                    .strokeBorder(theme.colors.hairline, lineWidth: 0.8)
            )
    }
}

struct SettingsTextEditor: View {
    @Binding var text: String
    let placeholder: String
    @Environment(\.appTheme) private var theme

    var body: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty {
                Text(placeholder)
                    .font(theme.typography.captionFont)
                    .foregroundStyle(theme.colors.muted)
                    .padding(.horizontal, theme.spacing.md)
                    .padding(.vertical, theme.spacing.sm)
                    .allowsHitTesting(false)
            }
            TextEditor(text: $text)
                .font(theme.typography.captionFont.monospaced())
                .foregroundStyle(theme.colors.textPrimary)
                .scrollContentBackground(.hidden)
                .padding(.horizontal, theme.spacing.sm)
                .padding(.vertical, theme.spacing.xs)
        }
        .frame(maxWidth: 340, minHeight: 92)
        .borderedCard(
            fill: theme.colors.surfaceSoft,
            border: theme.colors.hairline,
            cornerRadius: theme.radius.sm
        )
    }
}

// MARK: - Section Separator

struct SettingsSectionSeparator: View {
    @Environment(\.appTheme) private var theme

    var body: some View {
        Rectangle()
            .fill(theme.colors.hairline)
            .frame(height: 0.5)
    }
}

// MARK: - Page Container

struct SettingsPage<Content: View>: View {
    @Environment(\.appTheme) private var theme
    @ViewBuilder let content: () -> Content

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                content()
            }
            .padding(.vertical, theme.spacing.lg)
        }
    }
}

// MARK: - Theme-safe Inputs

struct SettingsTextField: View {
    let placeholder: String
    @Binding var text: String
    var width: CGFloat? = 340
    @Environment(\.appTheme) private var theme

    var body: some View {
        TextField(
            "",
            text: $text,
            prompt: Text(placeholder).foregroundStyle(theme.colors.textSecondary)
        )
        .textFieldStyle(SettingsFieldStyle())
        .frame(maxWidth: width)
    }
}

struct SettingsSecureField: View {
    let placeholder: String
    @Binding var text: String
    var width: CGFloat? = 340
    @Environment(\.appTheme) private var theme

    var body: some View {
        SecureField(
            "",
            text: $text,
            prompt: Text(placeholder).foregroundStyle(theme.colors.textSecondary)
        )
        .textFieldStyle(SettingsFieldStyle())
        .frame(maxWidth: width)
    }
}

// MARK: - Action Button

struct SettingsActionButton: View {
    enum Role: Equatable {
        case primary
        case secondary
        case destructive
    }

    let title: String
    let systemImage: String?
    let role: Role
    let action: () -> Void
    @Environment(\.appTheme) private var theme

    init(
        title: String,
        systemImage: String? = nil,
        role: Role = .secondary,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.systemImage = systemImage
        self.role = role
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: theme.spacing.xs) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 12, weight: .medium))
                }
                Text(title)
                    .font(theme.typography.bodyFont.weight(.medium))
            }
            .foregroundStyle(labelColor)
            .padding(.horizontal, theme.spacing.md)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: theme.radius.sm)
                    .fill(fillColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.sm)
                    .strokeBorder(borderColor, lineWidth: 0.8)
            )
        }
        .buttonStyle(.plain)
    }

    private var labelColor: Color {
        switch role {
        case .primary: return theme.colors.onPrimary
        case .secondary: return theme.colors.textPrimary
        case .destructive: return theme.colors.error
        }
    }

    private var fillColor: Color {
        switch role {
        case .primary: return theme.colors.accent
        case .secondary: return theme.colors.surfaceSoft
        case .destructive: return theme.colors.surfaceSoft
        }
    }

    private var borderColor: Color {
        switch role {
        case .primary: return Color.clear
        case .secondary: return theme.colors.hairline
        case .destructive: return theme.colors.error.opacity(0.4)
        }
    }
}

// MARK: - Empty State

struct SettingsEmptyState: View {
    let title: String
    let systemImage: String
    let reload: (() -> Void)?
    @Environment(\.appTheme) private var theme

    var body: some View {
        SettingsSection {
            VStack(spacing: theme.spacing.sm) {
                Image(systemName: systemImage)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(theme.colors.muted)
                Text(title)
                    .font(theme.typography.captionFont)
                    .foregroundStyle(theme.colors.textSecondary)
                if let reload {
                    SettingsActionButton(
                        title: "刷新",
                        systemImage: "arrow.clockwise",
                        role: .secondary,
                        action: reload
                    )
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, theme.spacing.lg)
        }
    }
}

// MARK: - Error Footer

struct SettingsErrorFooter: View {
    let message: String
    @Environment(\.appTheme) private var theme

    var body: some View {
        HStack(spacing: theme.spacing.xs) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(theme.colors.error)
            Text(message)
                .font(theme.typography.captionFont)
                .foregroundStyle(theme.colors.error)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, theme.spacing.xxl)
        .padding(.vertical, theme.spacing.sm)
    }
}
