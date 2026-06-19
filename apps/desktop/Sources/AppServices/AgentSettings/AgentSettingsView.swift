import SwiftUI

struct AgentSettingsView: View {
    @Bindable var viewModel: AgentSettingsViewModel
    @Environment(\.appTheme) private var theme

    var body: some View {
        SettingsPage {
            SettingsSection {
                SettingsRow("Provider") {
                    providerSegmented
                }
                SettingsRowDivider()
                SettingsRow("模型") {
                    SettingsTextField(placeholder: "gpt-5-mini", text: $viewModel.model)
                }
                SettingsRowDivider()
                SettingsRow("接口") {
                    apiSegmented
                }
                SettingsRowDivider()
                SettingsRow("Base URL") {
                    SettingsTextField(placeholder: "https://api.openai.com/v1", text: $viewModel.baseURL)
                }
            }

            SettingsSectionSeparator()

            SettingsSection {
                SettingsRow("API Key") {
                    SettingsSecureField(placeholder: "sk-...", text: $viewModel.apiKey)
                        .privacySensitive()
                }
            }

            Spacer(minLength: 0)

            if let error = viewModel.saveErrorMessage {
                SettingsErrorFooter(message: error)
            }
        }
        .overlayScrollbar()
    }

    private var apiSegmented: some View {
        SettingsSegmentedControl(
            AgentAPIType.allCases,
            selection: $viewModel.api,
            title: \.title
        )
        .frame(maxWidth: 340)
    }

    private var providerSegmented: some View {
        SettingsSegmentedControl(
            AgentLLMProvider.allCases,
            selection: $viewModel.provider,
            title: \.title
        )
        .frame(maxWidth: 340)
    }
}
