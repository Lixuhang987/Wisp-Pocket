import SwiftUI

struct PromptPanelView: View {
    @Bindable var viewModel: PromptPanelViewModel
    @Environment(\.appTheme) private var theme
    @FocusState private var isQueryFocused: Bool
    @State private var hoveredActionId: String?
    @State private var isSettingsHovered = false
    @State private var inputHeight: CGFloat = 20

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            workspacePicker
                .padding(.bottom, 8)
            firstRow
                .padding(.bottom, viewModel.chipItems.isEmpty ? 16 : 8)
            if !viewModel.chipItems.isEmpty {
                chipRow
                    .padding(.bottom, 16)
            }
            if let message = viewModel.submissionDisabledMessage ?? viewModel.workspaceErrorMessage {
                submissionDisabledBanner(message)
                    .padding(.bottom, 16)
            }
            Divider()
                .overlay(theme.colors.hairline)
                .padding(.bottom, 8)
            actionList
        }
        .promptPanelContainer()
        .onAppear { isQueryFocused = true }
        .onChange(of: viewModel.focusSeed) { isQueryFocused = true }
    }

    private var workspacePicker: some View {
        Picker("工作区", selection: $viewModel.selectedWorkspaceId) {
            Text("请选择工作区").tag("")
            if !viewModel.selectedWorkspaceId.isEmpty,
               !viewModel.workspaces.contains(where: { $0.id == viewModel.selectedWorkspaceId }) {
                Text("工作区不可用").tag(viewModel.selectedWorkspaceId)
            }
            ForEach(viewModel.workspaces) { workspace in
                Text(workspace.name).tag(workspace.id)
            }
        }
        .pickerStyle(.menu)
        .accessibilityLabel("任务工作区")
    }

    private var chipRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(viewModel.chipItems) { chip in
                    chipView(chip)
                }
            }
        }
    }

    private func chipView(_ chip: PromptPanelChipItem) -> some View {
        let style = chipStyle(for: chip)
        return HStack(spacing: 4) {
            chipLabel(for: chip, foreground: style.foreground)
            Button {
                viewModel.removeChip(id: chip.id)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(style.foreground)
                    .frame(width: 18, height: 18)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .help("移除")
            .accessibilityLabel("移除 \(chip.displayLabel)")
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .borderedCard(fill: style.background, border: style.border, cornerRadius: theme.radius.sm, borderWidth: 0.8)
        .help(chip.tooltip)
    }

    private func chipStyle(for chip: PromptPanelChipItem) -> (
        foreground: Color,
        background: Color,
        border: Color
    ) {
        if chip.isError {
            return (theme.colors.error, theme.colors.surfaceSoft, theme.colors.error.opacity(0.55))
        }
        if chip.isImage || chip.isSkill {
            return (theme.colors.textPrimary, theme.colors.surfaceCard, Color.clear)
        }
        return (theme.colors.textPrimary, theme.colors.surfaceSoft, Color.clear)
    }

    @ViewBuilder
    private func chipLabel(for chip: PromptPanelChipItem, foreground: Color) -> some View {
        let content = HStack(spacing: 6) {
            Image(systemName: chip.iconSystemName)
                .font(.system(size: 11, weight: (chip.isImage || chip.isSkill) ? .semibold : .regular))
                .foregroundStyle((chip.isImage || chip.isSkill) ? theme.colors.accent : foreground)
            Text(chip.displayLabel)
                .font(.system(size: 12))
                .foregroundStyle(foreground)
                .lineLimit(1)
        }
        if chip.canPreview {
            Button {
                viewModel.previewChip(id: chip.id)
            } label: {
                content.contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("点击预览（空格键）")
        } else {
            content
        }
    }

    private var firstRow: some View {
        HStack(spacing: 12) {
            inputComposer
            if !inputShouldExpand {
                Spacer(minLength: theme.spacing.lg)
            }
            settingsButton
        }
    }

    private var inputComposer: some View {
        inputField
        .frame(maxWidth: inputShouldExpand ? .infinity : nil, alignment: .leading)
    }

    private var inputField: some View {
        PromptPanelGrowingTextView(
            text: $viewModel.draft,
            measuredHeight: $inputHeight,
            placeholder: "输入请求，Return 提交",
            fontSize: theme.typography.promptInputFontSize,
            isFocused: isQueryFocused,
            isDisabled: viewModel.isSubmissionInputDisabled,
            maxVisibleLines: 5,
            onSubmit: { viewModel.submit() },
            onMoveSelection: { viewModel.moveSelectedAction($0) },
            onSubmitSelectedAction: { viewModel.submitSelectedAction() }
        )
        .frame(height: inputHeight)
        .frame(width: PromptPanelInputLayout.inputWidth(for: viewModel.draft))
        .frame(maxWidth: inputShouldExpand ? .infinity : nil)
        .onTapGesture {
            isQueryFocused = true
        }
    }

    private var inputShouldExpand: Bool {
        PromptPanelInputLayout.shouldExpandInput(for: viewModel.draft)
    }

    private func submissionDisabledBanner(_ message: String) -> some View {
        let isActionError = message.contains("Action")
        let semanticColor = isActionError ? theme.colors.error : theme.colors.warning
        let iconName = isActionError ? "exclamationmark.triangle" : "wifi.exclamationmark"
        let displayMessage = isActionError ? message : "\(message)，草稿已保留"

        return HStack(spacing: theme.spacing.sm) {
            Image(systemName: iconName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(semanticColor)
            Text(displayMessage)
                .font(theme.typography.captionFont)
                .foregroundStyle(theme.colors.textSecondary)
                .lineLimit(2)
        }
        .padding(.horizontal, theme.spacing.md)
        .padding(.vertical, theme.spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: theme.radius.sm)
                .fill(theme.colors.surfaceSoft)
        )
        .overlay(
            RoundedRectangle(cornerRadius: theme.radius.sm)
                .strokeBorder(semanticColor.opacity(0.5), lineWidth: 0.8)
        )
    }

    private var settingsButton: some View {
        Button { viewModel.openSettings() } label: {
            Image(systemName: "gearshape")
                .foregroundStyle(isSettingsHovered ? theme.colors.textSecondary : theme.colors.mutedSoft)
                .font(.system(size: 14, weight: .medium))
                .promptPanelIconButton(isHovered: isSettingsHovered)
        }
        .buttonStyle(.plain)
        .help("打开设置 (⌘,)")
        .accessibilityLabel("打开设置")
        .onHover { hovering in
            withAnimation(.easeInOut(duration: theme.animation.highlightDuration)) {
                isSettingsHovered = hovering
            }
        }
    }

    private var actionList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 2) {
                if viewModel.filteredActions.isEmpty {
                    Text(emptyActionsMessage)
                        .foregroundStyle(theme.colors.muted)
                        .font(theme.typography.bodyFont)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, theme.spacing.md)
                } else {
                    ForEach(viewModel.filteredActions) { action in
                        actionRow(action)
                    }
                }
            }
        }
        .overlayScrollbar()
    }

    private var emptyActionsMessage: String {
        viewModel.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "暂无可用 Action"
            : "没有匹配的 Action"
    }

    private func actionRow(_ action: ActionDefinition) -> some View {
        let isHovered = hoveredActionId == action.id
        let isSelected = viewModel.selectedAction?.id == action.id
        let isHighlighted = isHovered || isSelected
        return Button { viewModel.selectAction(action) } label: {
            HStack(alignment: .center, spacing: theme.spacing.md) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(action.title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(isHighlighted ? theme.colors.textPrimary : theme.colors.bodyStrong)
                        .lineLimit(1)
                    if let description = action.description, !description.isEmpty {
                        Text(description)
                            .font(.system(size: 12))
                            .foregroundStyle(theme.colors.muted)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: theme.spacing.md)
                Text(action.trigger)
                    .promptPanelTriggerPill(isHighlighted: isHighlighted)
            }
            .actionRow(isHighlighted: isHighlighted)
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: theme.animation.highlightDuration)) {
                hoveredActionId = hovering ? action.id : nil
            }
        }
    }
}
