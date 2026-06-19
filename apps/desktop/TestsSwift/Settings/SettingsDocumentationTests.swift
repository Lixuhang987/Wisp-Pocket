import XCTest
@testable import HandAgentDesktop

@MainActor
final class SettingsDocumentationTests: XCTestCase {
    func testSettingsDocsMentionThemeSafeComponentsAndSwiftLint() throws {
        let repositoryRoot = Self.repositoryRoot(from: #filePath)

        let settingsMD = try String(
            contentsOf: repositoryRoot
                .appendingPathComponent("apps/desktop/Sources/Settings/settings.md"),
            encoding: .utf8
        )
        XCTAssertTrue(settingsMD.contains("SettingsTextField"))
        XCTAssertTrue(settingsMD.contains("SwiftLint"))
        XCTAssertTrue(settingsMD.contains("SettingsPage"))

        let themeMD = try String(
            contentsOf: repositoryRoot
                .appendingPathComponent("apps/desktop/Sources/Theme/theme.md"),
            encoding: .utf8
        )
        XCTAssertTrue(themeMD.contains("SettingsStyles"))

        let manualQA = try String(
            contentsOf: repositoryRoot.appendingPathComponent("docs/manual-qa.md"),
            encoding: .utf8
        )
        XCTAssertTrue(manualQA.contains("Settings"))
        XCTAssertTrue(manualQA.contains("dark"))
        XCTAssertTrue(manualQA.contains("SwiftLint"))
    }

    func testSwiftLintConfigForbidsBareInputsAndHardcodedColors() throws {
        let repositoryRoot = Self.repositoryRoot(from: #filePath)
        let config = try String(
            contentsOf: repositoryRoot.appendingPathComponent(".swiftlint.yml"),
            encoding: .utf8
        )
        XCTAssertTrue(config.contains("settings_no_bare_textfield"))
        XCTAssertTrue(config.contains("settings_no_hardcoded_colors"))
        XCTAssertTrue(config.contains("SettingsStyles.swift"))
    }

    private static func repositoryRoot(from testFilePath: String) -> URL {
        var url = URL(fileURLWithPath: testFilePath)
        while url.path != "/" {
            if FileManager.default.fileExists(atPath: url.appendingPathComponent("Package.swift").path) {
                return url
            }
            url = url.deletingLastPathComponent()
        }
        return URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    }
}
