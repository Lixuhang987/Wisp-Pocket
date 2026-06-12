import Foundation

enum PromptPanelActionSelectionDirection {
    case previous
    case next
}

struct PromptPanelSkillInputItem: Equatable, Identifiable {
    let id: String
    let actionId: String
    let title: String
    let prompt: String
}

struct PromptPanelTextInputItem: Equatable, Identifiable {
    let id: String
    var text: String
}

enum PromptPanelComposerItem: Equatable, Identifiable {
    case skill(PromptPanelSkillInputItem)
    case text(PromptPanelTextInputItem)

    var id: String {
        switch self {
        case .skill(let item): return item.id
        case .text(let item): return item.id
        }
    }
}

@Observable
@MainActor
final class PromptPanelViewModel {
    var inputItems: [PromptPanelComposerItem]
    var focusSeed = 0
    var attachments: [PromptAttachmentResult] = []
    var selectedActionId: String?
    private(set) var submissionDisabledMessage: String?
    private(set) var isSubmissionInputDisabled = false

    var onSubmit: (([PromptPanelComposerItem], [PromptAttachmentResult]) -> Void)?
    var onHide: (() -> Void)?
    var onOpenSettings: (() -> Void)?
    var onPreviewImage: ((PromptAttachmentResult) -> Void)?

    @ObservationIgnored private var actions: [ActionDefinition]
    @ObservationIgnored private let editableTextItemId: String

    var draft: String {
        get { editableTextItem.text }
        set {
            replaceEditableText(newValue)
            normalizeSelectedAction()
        }
    }

    var skillItems: [PromptPanelSkillInputItem] {
        inputItems.compactMap {
            if case .skill(let item) = $0 { return item }
            return nil
        }
    }

    var hasVisibleInput: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || !skillItems.isEmpty
            || validAttachments().isEmpty == false
    }

    var filteredActions: [ActionDefinition] {
        ActionDefinition.filter(actions, query: draft)
    }

    var selectedAction: ActionDefinition? {
        let actions = filteredActions
        guard !actions.isEmpty else { return nil }
        if let selectedActionId,
           let selected = actions.first(where: { $0.id == selectedActionId }) {
            return selected
        }
        return actions.first
    }

    init(actions: [ActionDefinition]) {
        self.actions = actions
        let textId = UUID().uuidString
        self.editableTextItemId = textId
        self.inputItems = [.text(.init(id: textId, text: ""))]
        normalizeSelectedAction()
    }

    func updateActions(_ actions: [ActionDefinition]) {
        self.actions = actions
        normalizeSelectedAction()
    }

    func appendAttachment(_ attachment: PromptAttachmentResult) {
        switch attachment {
        case .noAttachment:
            return
        case .textSelection, .selectionError, .textToken, .imageRegion:
            attachments.append(attachment)
        }
    }

    func removeAttachment(id: String) {
        attachments.removeAll { $0.id == id }
    }

    func previewAttachment(_ attachment: PromptAttachmentResult) {
        guard attachment.isImage else { return }
        onPreviewImage?(attachment)
    }

    func resetForNewThread() {
        inputItems = [.text(.init(id: editableTextItemId, text: ""))]
        attachments = []
        normalizeSelectedAction()
    }

    func setSubmissionEnabled(_ enabled: Bool, message: String?) {
        isSubmissionInputDisabled = !enabled
        submissionDisabledMessage = enabled ? nil : message
    }

    func submit() {
        guard hasVisibleInput else { return }
        guard !isSubmissionInputDisabled else { return }
        submissionDisabledMessage = nil

        onSubmit?(inputItems, validAttachments())
        resetForNewThread()
    }

    func selectAction(_ action: ActionDefinition) {
        appendSkill(action)
    }

    func appendSkill(_ action: ActionDefinition) {
        let skill = ParsedActionInvocation(action: action).skillItem()
        let text = editableTextItem
        let chips = inputItems.compactMap { item -> PromptPanelComposerItem? in
            if case .skill = item { return item }
            return nil
        }
        inputItems = chips + [.skill(skill), .text(.init(id: text.id, text: ""))]
        submissionDisabledMessage = nil
        normalizeSelectedAction()
    }

    @discardableResult
    func deleteChipBeforeText() -> Bool {
        guard draft.isEmpty else { return false }
        guard let index = inputItems.lastIndex(where: {
            if case .skill = $0 { return true }
            return false
        }) else {
            return false
        }
        inputItems.remove(at: index)
        normalizeSelectedAction()
        return true
    }

    func removeInputItem(id: String) {
        inputItems.removeAll { item in
            guard item.id == id else { return false }
            if case .text = item { return false }
            return true
        }
        ensureEditableTextItem()
        normalizeSelectedAction()
    }

    func moveSelectedAction(_ direction: PromptPanelActionSelectionDirection) {
        let actions = filteredActions
        guard !actions.isEmpty else {
            selectedActionId = nil
            return
        }

        guard
            let currentSelectedActionId = selectedActionId,
            let currentIndex = actions.firstIndex(where: { $0.id == currentSelectedActionId })
        else {
            selectedActionId = direction == .next ? actions.first?.id : actions.last?.id
            return
        }

        let offset = direction == .next ? 1 : -1
        let nextIndex = (currentIndex + offset + actions.count) % actions.count
        selectedActionId = actions[nextIndex].id
    }

    func submitSelectedAction() {
        guard let action = selectedAction else {
            submit()
            return
        }
        appendSkill(action)
    }

    private func normalizeSelectedAction() {
        let actions = filteredActions
        guard !actions.isEmpty else {
            selectedActionId = nil
            return
        }

        if let selectedActionId,
           actions.contains(where: { $0.id == selectedActionId }) {
            return
        }

        selectedActionId = actions.first?.id
    }

    func openSettings() {
        onOpenSettings?()
        onHide?()
    }

    private func validAttachments() -> [PromptAttachmentResult] {
        attachments.filter {
            if case .selectionError = $0 { return false }
            return true
        }
    }

    private var editableTextItem: PromptPanelTextInputItem {
        inputItems.compactMap {
            if case .text(let item) = $0 { return item }
            return nil
        }.first ?? .init(id: editableTextItemId, text: "")
    }

    private func replaceEditableText(_ text: String) {
        var nextItems = inputItems.filter {
            if case .text = $0 { return false }
            return true
        }
        nextItems.append(.text(.init(id: editableTextItemId, text: text)))
        inputItems = nextItems
    }

    private func ensureEditableTextItem() {
        guard inputItems.contains(where: {
            if case .text = $0 { return true }
            return false
        }) else {
            inputItems.append(.text(.init(id: editableTextItemId, text: "")))
            return
        }

        let text = editableTextItem
        inputItems = inputItems.filter {
            if case .text = $0 { return false }
            return true
        } + [.text(text)]
    }
}
