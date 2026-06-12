import Foundation

struct PromptUserInput: Encodable, Equatable {
    let items: [PromptInputItem]
}

enum PromptInputItem: Encodable, Equatable {
    case text(id: String, text: String)
    case image(id: String, mimeType: String, base64: String)
    case skill(id: String, actionId: String, title: String, prompt: String)
    case textSelection(id: String, text: String)

    private enum CodingKeys: String, CodingKey {
        case type, id, text, mimeType, base64, actionId, title, prompt
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .text(let id, let text):
            try container.encode("text", forKey: .type)
            try container.encode(id, forKey: .id)
            try container.encode(text, forKey: .text)
        case .image(let id, let mimeType, let base64):
            try container.encode("image", forKey: .type)
            try container.encode(id, forKey: .id)
            try container.encode(mimeType, forKey: .mimeType)
            try container.encode(base64, forKey: .base64)
        case .skill(let id, let actionId, let title, let prompt):
            try container.encode("skill", forKey: .type)
            try container.encode(id, forKey: .id)
            try container.encode(actionId, forKey: .actionId)
            try container.encode(title, forKey: .title)
            try container.encode(prompt, forKey: .prompt)
        case .textSelection(let id, let text):
            try container.encode("text_selection", forKey: .type)
            try container.encode(id, forKey: .id)
            try container.encode(text, forKey: .text)
        }
    }
}

struct PromptSubmission {
    let userInput: PromptUserInput
    let summary: String

    var socketAttachments: [UserMessageAttachmentPayload] {
        userInput.items.compactMap { item in
            switch item {
            case .textSelection(let id, let text):
                return .textSelection(id: id, text: text)
            case .image(let id, let mimeType, let base64):
                return .image(id: id, mimeType: mimeType, base64: base64)
            case .text, .skill:
                return nil
            }
        }
    }

    static func compose(
        inputItems: [PromptPanelComposerItem],
        attachments: [PromptAttachmentResult]
    ) -> PromptSubmission? {
        let composerItems = inputItems.compactMap(promptInputItem)
        let attachmentItems = attachments.compactMap(promptInputItem)
        let items = composerItems + attachmentItems
        guard !items.isEmpty else { return nil }

        return PromptSubmission(
            userInput: PromptUserInput(items: items),
            summary: summarize(items: items)
        )
    }

    static func compose(
        draft: String,
        attachments: [PromptAttachmentResult]
    ) -> PromptSubmission? {
        let text = PromptPanelComposerItem.text(.init(id: UUID().uuidString, text: draft))
        return compose(inputItems: [text], attachments: attachments)
    }

    private static func promptInputItem(_ item: PromptPanelComposerItem) -> PromptInputItem? {
        switch item {
        case .skill(let skill):
            return .skill(id: skill.id, actionId: skill.actionId, title: skill.title, prompt: skill.prompt)
        case .text(let text):
            let trimmed = text.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }
            return .text(id: text.id, text: trimmed)
        }
    }

    private static func promptInputItem(_ attachment: PromptAttachmentResult) -> PromptInputItem? {
        switch attachment {
        case .textSelection(let id, let text):
            return .textSelection(id: id, text: text)
        case .imageRegion(let id, let mimeType, let base64):
            return .image(id: id, mimeType: mimeType, base64: base64)
        case .textToken(let token):
            let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }
            return .text(id: UUID().uuidString, text: trimmed)
        case .selectionError, .noAttachment:
            return nil
        }
    }

    private static func summarize(items: [PromptInputItem]) -> String {
        let primary = items.compactMap { item -> String? in
            switch item {
            case .text(_, let text):
                return text
            case .skill(_, _, let title, _):
                return title
            case .textSelection(_, let text):
                return text
            case .image:
                return nil
            }
        }.first ?? "[图片]"

        return items.count > 1
            ? primary + "\n\n[输入项 ×\(items.count - 1)]"
            : primary
    }
}
