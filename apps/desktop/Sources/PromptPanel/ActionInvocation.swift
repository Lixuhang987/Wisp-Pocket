import Foundation

struct ParsedActionInvocation: Equatable {
    let action: ActionDefinition

    func skillItem(id: String = UUID().uuidString) -> PromptPanelSkillInputItem {
        PromptPanelSkillInputItem(
            id: id,
            actionId: action.id,
            title: action.title,
            prompt: action.template
        )
    }
}
