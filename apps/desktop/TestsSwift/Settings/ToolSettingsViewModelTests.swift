import Foundation
import XCTest
@testable import HandAgentDesktop

final class ToolSettingsViewModelTests: XCTestCase {
    @MainActor
    func testLoadsDenylistAsDisabledTool() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        try TestFiles.writeSettings(
            homeURL,
            """
            {
              "tools": {
                "denylist": ["file.write"]
              }
            }
            """
        )

        let store = AgentSettingsStore(homeDirectoryURL: homeURL)
        let viewModel = ToolSettingsViewModel(store: store)

        XCTAssertFalse(viewModel.isEnabled("file.write"))

    }

    @MainActor
    func testDisablingToolAddsItToDenylist() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }

        let store = AgentSettingsStore(homeDirectoryURL: homeURL)
        let viewModel = ToolSettingsViewModel(store: store)

        viewModel.setEnabled("file.write", enabled: false)

        XCTAssertEqual(store.toolSettings.denylist, ["file.write"])
    }

    @MainActor
    func testEnablingToolRemovesDenylistAndUpdatesAllowlistWhenPresent() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        try TestFiles.writeSettings(
            homeURL,
            """
            {
              "tools": {
                "allowlist": [],
                "denylist": ["file.write"]
              }
            }
            """
        )

        let store = AgentSettingsStore(homeDirectoryURL: homeURL)
        let viewModel = ToolSettingsViewModel(store: store)

        viewModel.setEnabled("file.write", enabled: true)

        XCTAssertEqual(store.toolSettings.denylist, [])
        XCTAssertEqual(store.toolSettings.allowlist, ["file.write"])
    }

    @MainActor
    func testBuiltinToolCatalogContainsExpectedToolsAndRiskLabels() {
        let store = AgentSettingsStore(homeDirectoryURL: TestFiles.makeTemporaryHomeDirectory())
        let viewModel = ToolSettingsViewModel(store: store)

        XCTAssertEqual(viewModel.tools.map(\.name), [
            "file.write",
        ])
        XCTAssertEqual(viewModel.tools.first(where: { $0.name == "file.write" })?.riskLabel, "高风险")
    }

}
