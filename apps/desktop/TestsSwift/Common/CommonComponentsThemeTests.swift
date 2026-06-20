import SwiftUI
import XCTest
@testable import HandAgentDesktop

@MainActor
final class CommonComponentsThemeTests: XCTestCase {
    func testCommonInputsUseOverlayPlaceholderInsteadOfNativePromptOnly() throws {
        let source = try commonComponentsSource()

        XCTAssertTrue(source.contains("CommonInputPlaceholder"))
        XCTAssertTrue(source.contains("if text.isEmpty"))
        XCTAssertFalse(source.contains("prompt: Text(placeholder)"))
        XCTAssertFalse(source.contains("TextField(\"\", text: $text, prompt:"))
        XCTAssertFalse(source.contains("SecureField(\"\", text: $text, prompt:"))
    }

    func testCommonInputsRenderWithLightAndDarkTheme() {
        @State var text = ""
        @State var secureText = ""

        assertRendersWithBothThemes(
            CommonTextField(placeholder: "占位", text: $text)
        )
        assertRendersWithBothThemes(
            CommonSecureField(placeholder: "密钥", text: $secureText)
        )
    }

    func testCommonActionButtonRolesExposeExpectedSemanticRoles() {
        let roles: [CommonActionButton.Role] = [.primary, .secondary, .destructive]
        XCTAssertEqual(roles, [.primary, .secondary, .destructive])
    }

    func testCommonFormActionsRendersWithBothThemes() {
        assertRendersWithBothThemes(
            CommonFormActions {
                CommonActionButton(title: "取消", role: .secondary) {}
            } trailing: {
                CommonActionButton(title: "保存", role: .primary) {}
            }
        )
    }

    private func assertRendersWithBothThemes<V: View>(_ view: V) {
        for theme in [AppTheme.light, AppTheme.dark] {
            let hosted = NSHostingView(
                rootView: view.environment(\.appTheme, theme)
            )
            XCTAssertNotNil(hosted)
            _ = hosted.frame.size
        }
    }

    private func commonComponentsSource() throws -> String {
        let url = Self.repositoryRoot(from: #filePath)
            .appendingPathComponent("apps/desktop/Sources/Common/CommonComponents.swift")
        return try String(contentsOf: url, encoding: .utf8)
    }

    static func repositoryRoot(from testFilePath: String) -> URL {
        var url = URL(fileURLWithPath: testFilePath)
        while url.path != "/" {
            let candidate = url.appendingPathComponent("Package.swift")
            if FileManager.default.fileExists(atPath: candidate.path) {
                return url
            }
            url = url.deletingLastPathComponent()
        }
        return URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    }
}
