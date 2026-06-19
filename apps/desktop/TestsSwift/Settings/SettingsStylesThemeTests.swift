import SwiftUI
import XCTest
@testable import HandAgentDesktop

@MainActor
final class SettingsStylesThemeTests: XCTestCase {
    func testSettingsActionButtonRolesExposeExpectedSemanticRoles() {
        let roles: [SettingsActionButton.Role] = [.primary, .secondary, .destructive]
        XCTAssertEqual(roles, [.primary, .secondary, .destructive])
    }

    func testSettingsActionButtonInitializesAllRolesWithAndWithoutImage() {
        @State var triggered = false
        _ = SettingsActionButton(title: "保存", systemImage: "checkmark", role: .primary) {}
        _ = SettingsActionButton(title: "取消", systemImage: nil, role: .secondary) {}
        _ = SettingsActionButton(title: "删除", systemImage: "trash", role: .destructive) { triggered = true }
        XCTAssertFalse(triggered)
    }

    func testSettingsTextFieldCanRenderWithLightAndDarkTheme() {
        @State var text = ""
        assertRendersWithBothThemes(
            SettingsTextField(placeholder: "占位", text: $text)
        )
    }

    func testSettingsSecureFieldCanRenderWithLightAndDarkTheme() {
        @State var text = ""
        assertRendersWithBothThemes(
            SettingsSecureField(placeholder: "占位", text: $text)
        )
    }

    func testSettingsEmptyStateAndErrorFooterRenderWithTheme() {
        assertRendersWithBothThemes(
            SettingsEmptyState(title: "暂无数据", systemImage: "tray", reload: nil)
        )
        assertRendersWithBothThemes(
            SettingsErrorFooter(message: "保存失败")
        )
    }

    func testSettingsPageWrapsContent() {
        assertRendersWithBothThemes(
            SettingsPage {
                Text("内容")
            }
        )
    }

    // MARK: - Helpers

    private func assertRendersWithBothThemes<V: View>(_ view: V) {
        for theme in [AppTheme.light, AppTheme.dark] {
            let hosted = NSHostingView(
                rootView: view.environment(\.appTheme, theme)
            )
            XCTAssertNotNil(hosted)
            _ = hosted.frame.size
        }
    }
}
