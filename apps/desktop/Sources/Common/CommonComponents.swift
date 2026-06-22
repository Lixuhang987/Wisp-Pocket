import SwiftUI

struct CommonPage<Content: View>: View {
    @Environment(\.appTheme) private var theme
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                content
            }
            .padding(.vertical, theme.spacing.lg)
        }
    }
}

struct CommonSectionHeader: View {
    @Environment(\.appTheme) private var theme
    let title: String

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title)
            .font(.system(size: 12, weight: .semibold))
            .tracking(1)
            .foregroundStyle(theme.colors.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, CommonLayout.dividerLeadingPadding)
            .padding(.top, theme.spacing.lg)
            .padding(.bottom, 12)
    }
}

struct CommonSection<Content: View>: View {
    @Environment(\.appTheme) private var theme
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack(spacing: 0) {
            content
        }
        .padding(.vertical, theme.spacing.lg)
        .padding(.horizontal, theme.spacing.xl)
    }
}

struct CommonListSection<Data: RandomAccessCollection, RowContent: View>: View where Data.Element: Identifiable {
    let items: Data
    private let rowContent: (Data.Element) -> RowContent

    init(_ items: Data, @ViewBuilder rowContent: @escaping (Data.Element) -> RowContent) {
        self.items = items
        self.rowContent = rowContent
    }

    var body: some View {
        CommonSection {
            let firstID = items.first?.id
            ForEach(items) { item in
                if item.id != firstID {
                    CommonRowDivider()
                }
                rowContent(item)
            }
        }
    }
}

struct CommonRow<Control: View>: View {
    @Environment(\.appTheme) private var theme
    let label: String
    private let control: Control

    init(_ label: String, @ViewBuilder control: () -> Control) {
        self.label = label
        self.control = control()
    }

    var body: some View {
        HStack(alignment: .center, spacing: theme.spacing.md) {
            Text(label)
                .font(theme.typography.bodyFont)
                .foregroundStyle(theme.colors.body)
                .frame(width: CommonLayout.labelWidth, alignment: .trailing)
            control
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 12)
    }
}

struct CommonRowDivider: View {
    @Environment(\.appTheme) private var theme

    var body: some View {
        Divider()
            .overlay(theme.colors.hairlineSoft)
            .padding(.leading, CommonLayout.dividerLeadingPadding)
    }
}

struct CommonSectionSeparator: View {
    @Environment(\.appTheme) private var theme

    var body: some View {
        Rectangle()
            .fill(theme.colors.hairline)
            .frame(height: 0.5)
    }
}

struct CommonSegmentedControl<Option: Identifiable & Equatable>: View {
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
        .background {
            RoundedRectangle(cornerRadius: theme.radius.md)
                .fill(theme.colors.surfaceSoft)
        }
        .overlay {
            RoundedRectangle(cornerRadius: theme.radius.md)
                .strokeBorder(theme.colors.hairline, lineWidth: 0.8)
        }
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
                .background {
                    RoundedRectangle(cornerRadius: theme.radius.sm)
                        .fill(isSelected ? theme.colors.surfaceElevated : Color.clear)
                }
                .overlay {
                    RoundedRectangle(cornerRadius: theme.radius.sm)
                        .strokeBorder(isSelected ? theme.colors.accentRing : Color.clear, lineWidth: 0.8)
                }
                .contentShape(RoundedRectangle(cornerRadius: theme.radius.sm))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title(option))
    }
}

struct CommonTextField: View {
    let placeholder: String
    @Binding var text: String
    var width: CGFloat? = CommonLayout.controlMaxWidth
    @Environment(\.appTheme) private var theme

    var body: some View {
        CommonInputChrome(text: text, placeholder: placeholder, width: width) {
            TextField("", text: $text)
                .textFieldStyle(.plain)
                .font(theme.typography.bodyFont)
                .foregroundStyle(theme.colors.textPrimary)
                .accessibilityLabel(placeholder)
        }
    }
}

struct CommonSecureField: View {
    let placeholder: String
    @Binding var text: String
    var width: CGFloat? = CommonLayout.controlMaxWidth
    @Environment(\.appTheme) private var theme

    var body: some View {
        CommonInputChrome(text: text, placeholder: placeholder, width: width) {
            SecureField("", text: $text)
                .textFieldStyle(.plain)
                .font(theme.typography.bodyFont)
                .foregroundStyle(theme.colors.textPrimary)
                .accessibilityLabel(placeholder)
        }
    }
}

struct CommonTextEditor: View {
    @Binding var text: String
    let placeholder: String
    @Environment(\.appTheme) private var theme

    var body: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty {
                CommonInputPlaceholder(placeholder, font: theme.typography.captionFont)
                    .padding(.horizontal, theme.spacing.md)
                    .padding(.vertical, theme.spacing.sm)
            }
            TextEditor(text: $text)
                .font(theme.typography.captionFont.monospaced())
                .foregroundStyle(theme.colors.textPrimary)
                .scrollContentBackground(.hidden)
                .padding(.horizontal, theme.spacing.sm)
                .padding(.vertical, theme.spacing.xs)
                .accessibilityLabel(placeholder)
        }
        .frame(maxWidth: CommonLayout.controlMaxWidth, minHeight: 92)
        .borderedCard(
            fill: theme.colors.surfaceSoft,
            border: theme.colors.hairline,
            cornerRadius: theme.radius.sm
        )
    }
}

struct CommonActionButton: View {
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
            .background {
                RoundedRectangle(cornerRadius: theme.radius.sm)
                    .fill(fillColor)
            }
            .overlay {
                RoundedRectangle(cornerRadius: theme.radius.sm)
                    .strokeBorder(borderColor, lineWidth: 0.8)
            }
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

struct CommonIconButton: View {
    let title: String
    let systemImage: String
    let action: () -> Void
    @Environment(\.appTheme) private var theme
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(theme.colors.textSecondary)
                .frame(width: 32, height: 32)
                .background {
                    RoundedRectangle(cornerRadius: theme.radius.md)
                        .fill(isHovered ? theme.colors.surfaceHover : Color.clear)
                }
                .contentShape(RoundedRectangle(cornerRadius: theme.radius.md))
        }
        .buttonStyle(.plain)
        .help(title)
        .accessibilityLabel(title)
        .onHover { isHovered = $0 }
    }
}

struct CommonFormActions<Leading: View, Trailing: View>: View {
    @Environment(\.appTheme) private var theme
    private let leading: Leading
    private let trailing: Trailing

    init(
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.leading = leading()
        self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .center, spacing: theme.spacing.md) {
            Color.clear
                .frame(width: CommonLayout.labelWidth, height: 1)
            HStack(spacing: theme.spacing.sm) {
                leading
                Spacer(minLength: theme.spacing.sm)
                trailing
            }
            .frame(maxWidth: CommonLayout.controlMaxWidth)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 12)
    }
}

struct CommonEmptyState: View {
    let title: String
    let systemImage: String
    let reload: (() -> Void)?
    @Environment(\.appTheme) private var theme

    var body: some View {
        CommonSection {
            VStack(spacing: theme.spacing.sm) {
                Image(systemName: systemImage)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(theme.colors.muted)
                Text(title)
                    .font(theme.typography.captionFont)
                    .foregroundStyle(theme.colors.textSecondary)
                if let reload {
                    CommonActionButton(
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

struct CommonErrorFooter: View {
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
        .padding(.horizontal, theme.spacing.xl)
        .padding(.vertical, theme.spacing.sm)
    }
}

private struct CommonInputChrome<Field: View>: View {
    @Environment(\.appTheme) private var theme
    let text: String
    let placeholder: String
    let width: CGFloat?
    private let field: Field

    init(
        text: String,
        placeholder: String,
        width: CGFloat?,
        @ViewBuilder field: () -> Field
    ) {
        self.text = text
        self.placeholder = placeholder
        self.width = width
        self.field = field()
    }

    var body: some View {
        ZStack(alignment: .leading) {
            if text.isEmpty {
                CommonInputPlaceholder(placeholder, font: theme.typography.bodyFont)
                    .padding(.horizontal, theme.spacing.md)
                    .padding(.vertical, 8)
            }
            field
                .padding(.horizontal, theme.spacing.md)
                .padding(.vertical, 8)
        }
        .frame(maxWidth: width)
        .background {
            RoundedRectangle(cornerRadius: theme.radius.sm)
                .fill(theme.colors.surfaceSoft)
        }
        .overlay {
            RoundedRectangle(cornerRadius: theme.radius.sm)
                .strokeBorder(theme.colors.hairline, lineWidth: 0.8)
        }
    }
}

private struct CommonInputPlaceholder: View {
    @Environment(\.appTheme) private var theme
    let placeholder: String
    let font: Font

    init(_ placeholder: String, font: Font) {
        self.placeholder = placeholder
        self.font = font
    }

    var body: some View {
        Text(placeholder)
            .font(font)
            .foregroundStyle(theme.colors.textSecondary)
            .allowsHitTesting(false)
    }
}

private enum CommonLayout {
    static let labelWidth: CGFloat = 140
    static let dividerLeadingPadding: CGFloat = 188
    static let controlMaxWidth: CGFloat = 420
}
