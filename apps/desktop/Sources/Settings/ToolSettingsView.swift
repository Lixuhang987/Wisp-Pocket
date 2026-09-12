import SwiftUI

struct ToolSettingsView: View {
    @Bindable var viewModel: ToolSettingsViewModel
    @Environment(\.appTheme) private var theme

    var body: some View {
        SettingsPage {
            if viewModel.hasBuiltinFeatures {
                SettingsSectionHeader("内置功能")
                SettingsSection {
                    SettingsRow("Context History") {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("记录应用、窗口、辅助功能内容与屏幕图片。关闭窗口后继续，禁用或退出应用时停止。")
                                .font(theme.typography.captionFont)
                                .foregroundStyle(theme.colors.textSecondary)
                            HStack {
                                Text(viewModel.contextHistoryStatus)
                                    .font(theme.typography.captionFont)
                                    .foregroundStyle(theme.colors.textPrimary)
                                    .textSelection(.enabled)
                                Spacer()
                                Toggle("启用 Context History", isOn: $viewModel.contextHistoryEnabled)
                                    .labelsHidden()
                                    .toggleStyle(.switch)
                            }
                        }
                    }
                    SettingsRow("Automation") {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("启用录制、保存流程、执行与修复数据工具。流程保存后可在下次启动继续使用。")
                                .font(theme.typography.captionFont)
                                .foregroundStyle(theme.colors.textSecondary)
                            Toggle("启用 Automation", isOn: $viewModel.automationEnabled)
                                .toggleStyle(.switch)
                        }
                    }
                }
                if let error = viewModel.builtinSettingsError {
                    SettingsErrorFooter(message: error)
                }
                SettingsSectionSeparator()
                SettingsSectionHeader("Agent 工具")
            }
            SettingsListSection(items: viewModel.tools) { tool in
                toolRow(tool)
            }

            Spacer(minLength: 0)
        }
        .overlayScrollbar()
    }

    private func toolRow(_ tool: BuiltinToolSetting) -> some View {
        SettingsRow(tool.title) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(tool.description)
                        .font(theme.typography.captionFont)
                        .foregroundStyle(theme.colors.textPrimary)
                        .lineLimit(2)
                    Spacer()
                    Text(tool.riskLabel)
                        .font(theme.typography.captionFont)
                        .foregroundStyle(riskColor(tool.risk))
                }
                HStack(spacing: 8) {
                    Text(tool.name)
                        .font(theme.typography.captionFont)
                        .foregroundStyle(theme.colors.textSecondary)
                    Spacer()
                    Toggle("启用", isOn: Binding(
                        get: { viewModel.isEnabled(tool.name) },
                        set: { viewModel.setEnabled(tool.name, enabled: $0) }
                    ))
                    .labelsHidden()
                    .toggleStyle(.switch)
                }
            }
        }
    }

    private func riskColor(_ risk: BuiltinToolSetting.Risk) -> Color {
        switch risk {
        case .low: return theme.colors.accentTeal
        case .medium: return theme.colors.warning
        case .high: return theme.colors.error
        }
    }
}
