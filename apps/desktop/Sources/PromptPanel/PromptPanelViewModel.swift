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

enum PromptPanelChipItem: Equatable, Identifiable {
    case skill(PromptPanelSkillInputItem)
    case attachment(PromptAttachmentResult)

    var id: String {
        switch self {
        case .skill(let item): return "skill:\(item.id)"
        case .attachment(let attachment): return "attachment:\(attachment.id)"
        }
    }

    var displayLabel: String {
        switch self {
        case .skill(let item): return item.title
        case .attachment(let attachment): return attachment.displayLabel
        }
    }

    var iconSystemName: String {
        switch self {
        case .skill: return "text.badge.plus"
        case .attachment(let attachment): return attachment.iconSystemName
        }
    }

    var tooltip: String {
        switch self {
        case .skill(let item):
            return item.prompt
        case .attachment(.selectionError(_, let message)):
            return message
        case .attachment(.textSelection(_, let text)):
            return text
        case .attachment:
            return ""
        }
    }

    var isError: Bool {
        if case .attachment(let attachment) = self {
            return attachment.isError
        }
        return false
    }

    var isImage: Bool {
        if case .attachment(let attachment) = self {
            return attachment.isImage
        }
        return false
    }

    var isSkill: Bool {
        if case .skill = self { return true }
        return false
    }

    var canPreview: Bool {
        isImage
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

    private(set) var workspaces: [WorkspaceEntry] = []
    private(set) var workspaceErrorMessage: String?
    var selectedWorkspaceId: String {
        didSet {
            guard !selectedWorkspaceId.isEmpty else { return }
            if let preferences, !preferences.updatePromptWorkspace(selectedWorkspaceId) {
                workspaceErrorMessage = preferences.saveErrorMessage
            } else {
                workspaceErrorMessage = nil
            }
        }
    }
    @ObservationIgnored private let workspaceClient: (any WorkspaceManaging)?
    @ObservationIgnored private let preferences: AgentSettingsStore?
    @ObservationIgnored private var workspaceReloadTask: Task<Void, Never>?

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

    var chipItems: [PromptPanelChipItem] {
        skillItems.map(PromptPanelChipItem.skill)
            + attachments.map(PromptPanelChipItem.attachment)
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

    init(
        actions: [ActionDefinition],
        workspaceClient: (any WorkspaceManaging)? = nil,
        preferences: AgentSettingsStore? = nil
    ) {
        self.workspaceClient = workspaceClient
        self.preferences = preferences
        self.selectedWorkspaceId = preferences?.promptWorkspaceId ?? ""
        self.actions = actions
        let textId = UUID().uuidString
        self.editableTextItemId = textId
        self.inputItems = [.text(.init(id: textId, text: ""))]
        normalizeSelectedAction()
    }

    func showSubmissionError(_ message: String) {
        submissionDisabledMessage = message
    }

    func showWorkspaceRequired() {
        workspaceErrorMessage = "请选择工作区"
    }

    func refreshWorkspaces() {
        guard let workspaceClient else { return }
        workspaceReloadTask?.cancel()
        workspaceReloadTask = Task { @MainActor [weak self] in
            do {
                let workspaces = try await workspaceClient.listWorkspaces()
                guard !Task.isCancelled, let self else { return }
                self.workspaces = workspaces
                if self.selectedWorkspaceId.isEmpty, let first = workspaces.first {
                    self.selectedWorkspaceId = first.id
                }
                self.workspaceErrorMessage = workspaces.contains { $0.id == self.selectedWorkspaceId }
                    ? nil : "请选择可用工作区"
            } catch {
                guard !Task.isCancelled else { return }
                self?.workspaceErrorMessage = error.localizedDescription
            }
        }
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

    func removeChip(id: String) {
        guard let chip = chipItems.first(where: { $0.id == id }) else { return }
        switch chip {
        case .skill(let item):
            removeInputItem(id: item.id)
        case .attachment(let attachment):
            removeAttachment(id: attachment.id)
        }
    }

    func previewChip(id: String) {
        guard
            let chip = chipItems.first(where: { $0.id == id }),
            case .attachment(let attachment) = chip,
            attachment.isImage
        else {
            return
        }
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
        if workspaceClient != nil {
            guard workspaces.contains(where: { $0.id == selectedWorkspaceId }) else {
                workspaceErrorMessage = "请选择可用工作区"
                return
            }
        }
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
