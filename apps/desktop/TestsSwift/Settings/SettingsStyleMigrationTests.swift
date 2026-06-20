import XCTest
@testable import HandAgentDesktop

@MainActor
final class SettingsStyleMigrationTests: XCTestCase {
    func testSettingsSourceDoesNotUseBareInputsOutsideCommonAndSettingsWrappers() throws {
        let files = settingsSourceFiles(excludingBasenames: ["SettingsStyles.swift"])
        try assertNoMatch(files, #"\bTextField\("#)
        try assertNoMatch(files, #"\bSecureField\("#)
        try assertNoMatch(files, #"\bTextEditor\("#)
    }

    func testSettingsSourceDoesNotUseHardcodedColorsOutsideCommonAndSettingsWrappers() throws {
        let files = settingsSourceFiles(excludingBasenames: ["SettingsStyles.swift"])
        try assertNoMatch(files, #"Color\.(white|black|gray|red|blue|green)"#)
    }

    func testSettingsSourceDoesNotUseBareButtonsForCommonActions() throws {
        let files = settingsSourceFiles(excludingBasenames: ["SettingsStyles.swift"])
        try assertNoMatch(
            files,
            #"Button\s*\(\s*"(保存|取消|删除|新增|添加示例|添加 Workspace|撤销)""#
        )
    }

    func testSettingsPagesUseSettingsPageOrCommonPage() throws {
        let requiredContainers = [
            "apps/desktop/Sources/AppServices/AgentSettings/AgentSettingsView.swift",
            "apps/desktop/Sources/Settings/AppearanceSettingsView.swift",
            "apps/desktop/Sources/Settings/ToolSettingsView.swift",
            "apps/desktop/Sources/Settings/AgentTriggerSettingsView.swift",
            "apps/desktop/Sources/Settings/AppendPromptSettingsView.swift",
            "apps/desktop/Sources/Settings/MCPSettingsView.swift",
            "apps/desktop/Sources/Settings/PermissionRulesView.swift",
            "apps/desktop/Sources/Settings/ShortcutSettingsView.swift",
            "apps/desktop/Sources/Settings/WorkspaceSettingsView.swift"
        ]

        for relativePath in requiredContainers {
            let source = try readSource(relativePath)
            XCTAssertTrue(
                source.contains("SettingsPage") || source.contains("CommonPage"),
                "\(relativePath) must use SettingsPage or CommonPage as its content container."
            )
        }
    }

    func testSettingsStylesWrapCommonComponentsWithoutDuplicatingInputRendering() throws {
        let source = try readSource("apps/desktop/Sources/Settings/SettingsStyles.swift")

        XCTAssertTrue(source.contains("CommonTextField"))
        XCTAssertTrue(source.contains("CommonSecureField"))
        XCTAssertTrue(source.contains("CommonTextEditor"))
        XCTAssertTrue(source.contains("CommonActionButton"))
        XCTAssertFalse(source.contains("TextField("))
        XCTAssertFalse(source.contains("SecureField("))
        XCTAssertFalse(source.contains("TextEditor("))
    }

    func testAgentTriggerCreateFormUsesCommonFormActions() throws {
        let source = try readSource("apps/desktop/Sources/Settings/AgentTriggerSettingsView.swift")

        XCTAssertTrue(source.contains("SettingsPage"))
        XCTAssertTrue(source.contains("SettingsFormActions") || source.contains("CommonFormActions"))
        XCTAssertFalse(source.contains("HStack {\n                        SettingsActionButton(title: \"取消\""))
    }

    // MARK: - Helpers

    private func settingsSourceFiles(excludingBasenames: [String]) -> [(url: URL, source: String)] {
        let urls = settingsSwiftFiles()
            .filter { url in
                !excludingBasenames.contains(url.lastPathComponent)
            }
        return urls.map { url in
            (url, (try? String(contentsOf: url, encoding: .utf8)) ?? "")
        }
    }

    private func settingsSwiftFiles() -> [URL] {
        let fileManager = FileManager.default
        let repositoryRoot = Self.repositoryRoot(from: #filePath)
        let directories = [
            repositoryRoot
                .appendingPathComponent("apps/desktop/Sources/Settings"),
            repositoryRoot
                .appendingPathComponent("apps/desktop/Sources/AppServices/AgentSettings")
        ]
        return directories.flatMap { directory in
            guard let enumerator = fileManager.enumerator(at: directory, includingPropertiesForKeys: nil) else {
                return [URL]()
            }
            return enumerator.compactMap { $0 as? URL }
                .filter { $0.pathExtension == "swift" }
        }
    }

    private func readSource(_ relativePath: String) throws -> String {
        let url = Self.repositoryRoot(from: #filePath)
            .appendingPathComponent(relativePath)
        return try String(contentsOf: url, encoding: .utf8)
    }

    private func assertNoMatch(
        _ files: [(url: URL, source: String)],
        _ pattern: String
    ) throws {
        let regex = try NSRegularExpression(pattern: pattern)
        for (url, source) in files {
            let range = NSRange(source.startIndex..., in: source)
            if regex.firstMatch(in: source, range: range) != nil {
                XCTFail("Forbidden pattern '\(pattern)' found in \(url.path)")
            }
        }
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
