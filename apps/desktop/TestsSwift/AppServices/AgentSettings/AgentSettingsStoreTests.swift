import Foundation
import XCTest
@testable import HandAgentDesktop

final class AgentSettingsStoreTests: XCTestCase {
    @MainActor
    func testLoadsDefaultAppearanceWhenSettingsFileDoesNotExist() {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }

        let store = AgentSettingsStore(homeDirectoryURL: homeURL)

        XCTAssertEqual(store.appearance.themePreference, .system)
    }

    @MainActor
    func testUpdatingAppearancePreservesModelAndTools() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }

        let fileURL = TestFiles.settingsFileURL(homeURL)
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data(
            """
            {
              "llm": {
                "provider": "anthropic",
                "model": "claude-sonnet",
                "apiKey": "key",
                "baseUrl": "https://example.com",
                "api": "chat"
              },
              "tools": {
                "denylist": ["screen.capture"]
              }
            }
            """.utf8
        ).write(to: fileURL)

        let store = AgentSettingsStore(homeDirectoryURL: homeURL)
        XCTAssertTrue(store.updatePromptWorkspace("workspace-selected"))
        store.updateAppearance { appearance in
            appearance.themePreference = .dark
        }

        let json = try TestFiles.readJSON(fileURL)
        let nativeFile = homeURL.appendingPathComponent(".spotAgent/native-preferences.json")
        XCTAssertEqual((try TestFiles.readJSON(nativeFile)["appearance"] as? [String: Any])?["themePreference"] as? String, "dark")
        XCTAssertEqual((json["llm"] as? [String: Any])?["model"] as? String, "claude-sonnet")
        XCTAssertEqual((json["tools"] as? [String: Any])?["denylist"] as? [String], ["screen.capture"])
        try Data(#"{"llm":{"model":"updated","summarizerModel":"summary"},"tools":{"denylist":["file.write"]}}"#.utf8).write(to: fileURL)
        store.updateAppearance { $0.themePreference = .light }
        let reread = try TestFiles.readJSON(fileURL)
        XCTAssertEqual(AgentSettingsStore(homeDirectoryURL: homeURL).promptWorkspaceId, "workspace-selected")
        XCTAssertEqual((reread["llm"] as? [String: Any])?["summarizerModel"] as? String, "summary")
        XCTAssertEqual((reread["llm"] as? [String: Any])?["model"] as? String, "updated")
        XCTAssertEqual((try TestFiles.readJSON(nativeFile)["appearance"] as? [String: Any])?["themePreference"] as? String, "light")
    }

    @MainActor
    func testReloadsSettingsFromDiskAfterExternalChange() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let fileURL = AgentSettingsStore.settingsFileURL(homeDirectoryURL: homeURL)
        let store = AgentSettingsStore(homeDirectoryURL: homeURL)
        store.updateAppearance { $0.themePreference = .dark }
        try Data(#"{"appearance":{"themePreference":"light"}}"#.utf8).write(to: fileURL)
        store.reloadFromDisk()
        XCTAssertEqual(store.appearance.themePreference, .light)
    }
}
