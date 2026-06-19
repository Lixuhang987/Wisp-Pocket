import XCTest
@testable import HandAgentDesktop

final class ActionDefinitionTests: XCTestCase {
    func testParsesPromptManifestIntoAppendSkillActionDefinition() throws {
        let data = """
        {
          "version": 1,
          "id": "review",
          "title": "Review",
          "enabled": true,
          "prompts": [
            {
              "name": "code_review",
              "trigger": "r",
              "title": "Request Code Review",
              "description": "Review code",
              "template": "Review the code the user provides.",
              "globalShortcut": { "key": "r", "modifiers": ["command", "shift"] }
            }
          ]
        }
        """.data(using: .utf8)!

        let manifest = try ActionManifestDefinition.decode(data)
        let actions = ActionDefinition.buildActions(from: [manifest])

        XCTAssertEqual(actions.enabled.map(\.id), ["review/code_review"])
        XCTAssertEqual(actions.enabled.first?.trigger, "r")
        XCTAssertEqual(actions.enabled.first?.template, "Review the code the user provides.")
        XCTAssertEqual(actions.enabled.first?.shortcutName.rawValue, "action.review/code_review")
        XCTAssertEqual(actions.enabled.first?.defaultShortcut, .init(.r, modifiers: [.command, .shift]))
        XCTAssertEqual(actions.enabled.first?.submission, .appendSkill)
        XCTAssertEqual(actions.disabled, [])
    }

    func testBuildsAppendSkillDefinition() {
        let action = ActionDefinition.skill(
            id: "weather/current",
            trigger: "weather",
            title: "查询当前天气",
            description: "按当前上下文查询天气",
            template: "查询当前天气",
            defaultShortcut: .init(.w, modifiers: [.command, .shift])
        )

        XCTAssertEqual(action.id, "weather/current")
        XCTAssertEqual(action.trigger, "weather")
        XCTAssertEqual(action.submission, .appendSkill)
        XCTAssertEqual(action.defaultShortcut, .init(.w, modifiers: [.command, .shift]))
    }

    func testTemplatePlaceholdersArePlainTextNow() {
        let manifest = ActionManifestDefinition(
            version: 1,
            id: "review",
            title: "Review",
            description: nil,
            enabled: true,
            prompts: [
                ActionPromptDefinition(
                    name: "prompt",
                    trigger: "r",
                    title: "Review",
                    description: nil,
                    template: "Review {{code}}",
                    globalShortcut: nil,
                    icons: nil
                )
            ]
        )

        let actions = ActionDefinition.buildActions(from: [manifest])

        XCTAssertEqual(actions.enabled.first?.template, "Review {{code}}")
        XCTAssertEqual(actions.disabled, [])
    }

    func testTriggerConflictKeepsFirstManifestByStableOrder() throws {
        let first = ActionManifestDefinition.testManifest(id: "alpha", trigger: "r")
        let second = ActionManifestDefinition.testManifest(id: "beta", trigger: "R")

        let actions = ActionDefinition.buildActions(from: [second, first])

        XCTAssertEqual(actions.enabled.map(\.id), ["alpha/code_review"])
        XCTAssertEqual(actions.disabled.map(\.id), ["beta/code_review"])
        XCTAssertEqual(actions.disabled.first?.reason, "trigger conflicts with alpha/code_review")
    }
}

private extension ActionManifestDefinition {
    static func testManifest(id: String, trigger: String) -> ActionManifestDefinition {
        ActionManifestDefinition(
            version: 1,
            id: id,
            title: id,
            description: nil,
            enabled: true,
            prompts: [
                ActionPromptDefinition(
                    name: "code_review",
                    trigger: trigger,
                    title: "Review",
                    description: nil,
                    template: "Review the code the user provides.",
                    globalShortcut: nil,
                    icons: nil
                )
            ]
        )
    }
}
