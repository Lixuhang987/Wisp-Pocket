@testable import HandAgentDesktop

@MainActor
func promptItems(_ text: String) -> [PromptPanelComposerItem] {
    [.text(.init(id: "text-\(text)", text: text))]
}

extension PromptSubmission {
    var textContent: String {
        userInput.items.compactMap { item in
            switch item {
            case .text(_, let text):
                return text
            case .skill(_, _, _, let prompt):
                return prompt
            case .textSelection(_, let text):
                return text
            case .image:
                return nil
            }
        }.joined(separator: "\n\n")
    }
}
