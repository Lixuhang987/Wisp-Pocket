import XCTest
@testable import HandAgentDesktop

final class AppendPromptSettingsViewModelTests: XCTestCase {
    @MainActor
    func testLoadsSkillPromptsFromManifestsWithoutArguments() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        try TestFiles.writePlugin(
            homeURL,
            id: "append-prompts",
            json: """
            {
              "version": 1,
              "id": "append-prompts",
              "title": "Append Prompts",
              "enabled": true,
              "prompts": [
                {
                  "name": "summarize",
                  "trigger": "sum",
                  "title": "Summarize",
                  "description": "Summarize pasted text",
                  "template": "Summarize the text the user provides."
                }
              ]
            }
            """
        )

        let viewModel = AppendPromptSettingsViewModel(homeDirectoryURL: homeURL)

        XCTAssertEqual(viewModel.prompts.map(\.id), ["append-prompts/summarize"])
        XCTAssertEqual(viewModel.prompts.first?.trigger, "sum")
        XCTAssertEqual(viewModel.prompts.first?.template, "Summarize the text the user provides.")
    }

    @MainActor
    func testCreatesSkillPromptInAppendPromptsManifestWithoutArguments() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let viewModel = AppendPromptSettingsViewModel(homeDirectoryURL: homeURL)

        viewModel.createPrompt(
            name: "explain",
            trigger: "explain",
            title: "Explain Code",
            description: "Explain a code block",
            template: "Explain the code the user provides."
        )

        let manifest = try PluginManifestDefinition.decode(
            Data(contentsOf: TestFiles.pluginsDirectoryURL(homeURL).appendingPathComponent("append-prompts/plugin.json"))
        )
        XCTAssertEqual(manifest.id, "append-prompts")
        XCTAssertEqual(manifest.prompts.first?.name, "explain")
        XCTAssertEqual(manifest.prompts.first?.template, "Explain the code the user provides.")
        XCTAssertEqual(viewModel.prompts.first?.id, "append-prompts/explain")
    }

    @MainActor
    func testCreatePromptRejectsIncompleteFields() {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let viewModel = AppendPromptSettingsViewModel(homeDirectoryURL: homeURL)

        let didCreate = viewModel.createPrompt(
            name: "broken",
            trigger: "",
            title: "Broken",
            description: "",
            template: ""
        )

        XCTAssertFalse(didCreate)
        XCTAssertEqual(viewModel.prompts, [])
        XCTAssertNotNil(viewModel.saveErrorMessage)
    }

    @MainActor
    func testDeletesPromptAndRemovesEmptyAppendPromptManifest() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let viewModel = AppendPromptSettingsViewModel(homeDirectoryURL: homeURL)
        viewModel.createPrompt(
            name: "explain",
            trigger: "explain",
            title: "Explain Code",
            description: "",
            template: "Explain the code the user provides."
        )

        viewModel.deletePrompt(id: "append-prompts/explain")

        XCTAssertEqual(viewModel.prompts, [])
        XCTAssertFalse(FileManager.default.fileExists(atPath: TestFiles.pluginsDirectoryURL(homeURL).appendingPathComponent("append-prompts/plugin.json").path))
    }

    @MainActor
    func testInstallExamplePromptsCreatesSkillActionsWithoutArguments() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let viewModel = AppendPromptSettingsViewModel(homeDirectoryURL: homeURL)

        viewModel.installExamplePrompts()

        XCTAssertEqual(viewModel.prompts.map(\.id), [
            "append-prompts/explain-code",
            "append-prompts/summarize-text",
        ])
        XCTAssertTrue(viewModel.prompts.allSatisfy { !$0.template.contains("{{") })
    }
}
