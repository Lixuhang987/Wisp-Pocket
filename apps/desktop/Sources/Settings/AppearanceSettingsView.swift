import SwiftUI

struct AppearanceSettingsView: View {
    @Bindable var viewModel: AppearanceSettingsViewModel
    @Environment(\.appTheme) private var theme

    var body: some View {
        SettingsPage {
            SettingsSectionHeader("外观")
            SettingsSection {
                SettingsRow("主题") {
                    SettingsSegmentedControl(
                        AppearanceThemePreference.allCases,
                        selection: $viewModel.themePreference,
                        title: \.title
                    )
                    .frame(width: 260)
                }
            }
            if let saveErrorMessage = viewModel.saveErrorMessage {
                SettingsErrorFooter(message: saveErrorMessage)
            }
            Spacer(minLength: 0)
        }
        .overlayScrollbar()
    }
}
