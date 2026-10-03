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
                            Text("记录应用、窗口、辅助功能内容与屏幕图片。应用运行期间持续采集，关闭窗口后继续，退出应用时停止。历史与文件读取默认可用，无需逐次确认。")
                                .font(theme.typography.captionFont)
                                .foregroundStyle(theme.colors.textSecondary)
                            HStack {
                                Text(viewModel.contextHistoryStatus)
                                    .font(theme.typography.captionFont)
                                    .foregroundStyle(theme.colors.textPrimary)
                                    .textSelection(.enabled)
                                Spacer()

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
            }

            Spacer(minLength: 0)
        }
        .overlayScrollbar()
    }

}
