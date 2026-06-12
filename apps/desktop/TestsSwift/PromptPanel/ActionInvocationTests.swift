import XCTest
@testable import HandAgentDesktop

final class ActionInvocationTests: XCTestCase {
    func testParsedActionInvocationCreatesSkillItem() {
        let action = ActionDefinition.skill(
            id: "weather/current",
            trigger: "weather",
            title: "天气",
            description: nil,
            template: "查询当前天气",
            defaultShortcut: nil
        )

        let item = ParsedActionInvocation(action: action).skillItem(id: "skill-1")

        XCTAssertEqual(item.id, "skill-1")
        XCTAssertEqual(item.actionId, "weather/current")
        XCTAssertEqual(item.title, "天气")
        XCTAssertEqual(item.prompt, "查询当前天气")
    }
}
