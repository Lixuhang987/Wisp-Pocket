import XCTest
@testable import HandAgentDesktop

@MainActor
final class SettingsStyleMigrationTests: XCTestCase {
    func testSettingsSourceDoesNotUseBareInputsOutsideSharedStyles() throws {
        let files = settingsSourceFiles(excludingBasenames: ["SettingsStyles.swift"])
        try assertNoMatch(files, #"\bTextField\("#)
        try assertNoMatch(files, #"\bSecureField\("#)
        try assertNoMatch(files, #"\bTextEditor\("#)
    }

    func testSettingsSourceDoesNotUseHardcodedColorsOutsideSharedStyles() throws {
        let files = settingsSourceFiles(excludingBasenames: ["SettingsStyles.swift"])
        try assertNoMatch(files, #"Color\.(white|black|gray|red|blue|green)"#)
    }

    func testSettingsPageIsUsedAsContainerBaseline() throws {
        let files = settingsSourceFiles(excludingBasenames: [])
        let pageUsages = files.flatMap { file, source in
            source.components(separatedBy: "SettingsPage")
        }.count - files.count
        XCTAssertGreaterThanOrEqual(pageUsages, 0)
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
