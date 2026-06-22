import SwiftUI

struct AppendPromptSettingsView: View {
    @Bindable var viewModel: AppendPromptSettingsViewModel
    @Environment(\.appTheme) private var theme
    @State private var isAdding = false
    @State private var name = ""
    @State private var trigger = ""
    @State private var title = ""
    @State private var description = ""
    @State private var template = ""

    var body: some View {
        SettingsPage {
            if viewModel.prompts.isEmpty {
                emptyState
            } else {
                SettingsListSection(items: viewModel.prompts) { prompt in
                    promptRow(prompt)
                }
            }

            SettingsSectionSeparator()
            addButton

            if isAdding {
                SettingsSectionSeparator()
                createForm
            }

            if let error = viewModel.saveErrorMessage {
                errorFooter(error)
            }

            Spacer(minLength: 0)
        }
        .overlayScrollbar()
    }

    private var emptyState: some View {
        SettingsEmptyState(title: "暂无 Append Prompt", systemImage: "text.badge.plus", reload: viewModel.reload)
    }

    private func promptRow(_ prompt: AppendPromptEntry) -> some View {
        SettingsRow(prompt.title) {
            VStack(alignment: .leading, spacing: theme.spacing.sm) {
                HStack(alignment: .firstTextBaseline, spacing: theme.spacing.sm) {
                    Text(prompt.description.isEmpty ? prompt.template : prompt.description)
                        .font(theme.typography.captionFont)
                        .foregroundStyle(theme.colors.textPrimary)
                        .lineLimit(2)
                    Spacer()
                    SettingsActionButton(title: "删除", systemImage: "trash", role: .destructive) {
                        viewModel.deletePrompt(id: prompt.id)
                    }
                }
                HStack(spacing: theme.spacing.sm) {
                    Text(prompt.trigger)
                        .font(theme.typography.captionFont.monospaced())
                    Spacer()
                }
                .foregroundStyle(theme.colors.textSecondary)
            }
        }
    }

    private var addButton: some View {
        SettingsSection {
            HStack {
                SettingsActionButton(
                    title: isAdding ? "收起" : "新增 Append Prompt",
                    systemImage: isAdding ? "chevron.up" : "plus",
                    role: .primary
                ) {
                    isAdding.toggle()
                }

                Spacer()

                SettingsActionButton(title: "添加示例", systemImage: "sparkles", role: .secondary) {
                    viewModel.installExamplePrompts()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var createForm: some View {
        VStack(spacing: 0) {
            SettingsSectionHeader("新增 Append Prompt")
            SettingsSection {
                SettingsRow("名称") {
                    SettingsTextField(placeholder: "explain", text: $name)
                }
                SettingsRowDivider()
                SettingsRow("Trigger") {
                    SettingsTextField(placeholder: "explain", text: $trigger)
                }
                SettingsRowDivider()
                SettingsRow("标题") {
                    SettingsTextField(placeholder: "Explain Code", text: $title)
                }
                SettingsRowDivider()
                SettingsRow("描述") {
                    SettingsTextField(placeholder: "Explain a code block", text: $description)
                }
                SettingsRowDivider()
                SettingsRow("Template") {
                    SettingsTextEditor(text: $template, placeholder: "Explain the code the user provides.")
                }
                SettingsRowDivider()
                formButtons
            }
        }
    }

    private var formButtons: some View {
        SettingsFormActions {
            SettingsActionButton(
                title: "取消",
                systemImage: "xmark",
                role: .secondary,
                action: resetForm
            )
        } trailing: {
            SettingsActionButton(
                title: "保存",
                systemImage: "checkmark",
                role: .primary,
                action: {
                    let didCreate = viewModel.createPrompt(
                        name: name,
                        trigger: trigger,
                        title: title,
                        description: description,
                        template: template
                    )
                    if didCreate {
                        resetForm()
                    }
                }
            )
            .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .font(theme.typography.bodyFont)
    }

    private func resetForm() {
        isAdding = false
        name = ""
        trigger = ""
        title = ""
        description = ""
        template = ""
    }

    private func errorFooter(_ error: String) -> some View {
        SettingsErrorFooter(message: error)
    }
}
