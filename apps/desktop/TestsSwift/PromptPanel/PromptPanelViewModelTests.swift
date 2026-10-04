import XCTest
@testable import HandAgentDesktop

final class PromptPanelViewModelTests: XCTestCase {
    @MainActor
    func testFilteredActionsReturnsAllWhenDraftIsEmpty() {
        let vm = PromptPanelViewModel(actions: makeTestActions())

        XCTAssertEqual(vm.filteredActions.map(\.id), ["new-thread", "weather/current"])
        XCTAssertEqual(vm.selectedActionId, "new-thread")
    }

    @MainActor
    func testFilteredActionsFiltersByDraft() {
        let vm = PromptPanelViewModel(actions: makeTestActions())

        vm.draft = "weather"

        XCTAssertEqual(vm.filteredActions.map(\.id), ["weather/current"])
        XCTAssertEqual(vm.selectedActionId, "weather/current")
    }

    @MainActor
    func testSubmitCallsOnSubmitWithTextItemArray() async {
        let home = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: home) }
        let preferences = AgentSettingsStore(homeDirectoryURL: home)
        let client = PromptWorkspaceClient()
        let vm = PromptPanelViewModel(actions: makeTestActions(), workspaceClient: client, preferences: preferences)
        vm.refreshWorkspaces()
        for _ in 0..<50 where vm.workspaces.isEmpty { await Task.yield() }
        XCTAssertEqual(vm.selectedWorkspaceId, "workspace-first")
        vm.selectedWorkspaceId = "workspace-second"
        var submitted: [PromptPanelComposerItem] = []
        vm.onSubmit = { items, _ in submitted = items }

        vm.draft = "  hello world  "
        vm.submit()

        XCTAssertEqual(texts(in: submitted), ["  hello world  "])
        XCTAssertEqual(vm.draft, "")
        let restored = PromptPanelViewModel(actions: [], workspaceClient: client,
            preferences: AgentSettingsStore(homeDirectoryURL: home))
        restored.refreshWorkspaces()
        for _ in 0..<50 where restored.workspaces.isEmpty { await Task.yield() }
        XCTAssertEqual(restored.selectedWorkspaceId, "workspace-second")
        restored.resetForNewThread()
        XCTAssertEqual(restored.selectedWorkspaceId, "workspace-second")
    }

    @MainActor
    func testSubmitIgnoresEmptyInput() {
        let vm = PromptPanelViewModel(actions: makeTestActions())
        var didSubmit = false
        vm.onSubmit = { _, _ in didSubmit = true }

        vm.draft = "   "
        vm.submit()

        XCTAssertFalse(didSubmit)
    }

    @MainActor
    func testSubmitIsBlockedWhenAgentServerUnavailableAndKeepsDraft() {
        let vm = PromptPanelViewModel(actions: makeTestActions())
        var didSubmit = false
        vm.onSubmit = { _, _ in didSubmit = true }

        vm.draft = "hello"
        vm.setSubmissionEnabled(false, message: "agent-server 已断开，正在尝试重连…")
        vm.submit()

        XCTAssertFalse(didSubmit)
        XCTAssertEqual(vm.draft, "hello")
        XCTAssertEqual(vm.submissionDisabledMessage, "agent-server 已断开，正在尝试重连…")
    }

    @MainActor
    func testSubmitWorksAfterAgentServerBecomesAvailableAgain() {
        let vm = PromptPanelViewModel(actions: makeTestActions())
        var didSubmit = false
        vm.onSubmit = { _, _ in didSubmit = true }

        vm.draft = "hello"
        vm.setSubmissionEnabled(false, message: "agent-server 已断开，正在尝试重连…")
        vm.setSubmissionEnabled(true, message: nil)
        vm.submit()

        XCTAssertTrue(didSubmit)
        XCTAssertNil(vm.submissionDisabledMessage)
    }

    @MainActor
    func testSelectActionAppendsSkillChipAndClearsEditableText() {
        let action = makeReviewAction()
        let vm = PromptPanelViewModel(actions: [action])

        vm.draft = "review"
        vm.selectAction(action)

        XCTAssertEqual(vm.skillItems.map(\.actionId), ["review/code_review"])
        XCTAssertEqual(vm.skillItems.first?.prompt, "Review the user-provided code.")
        XCTAssertEqual(vm.draft, "")
        XCTAssertEqual(vm.inputItems.count, 2)
    }

    @MainActor
    func testSubmitSelectedActionAppendsSelectedSkillWithoutSubmitting() {
        let vm = PromptPanelViewModel(actions: makeTestActions())
        var didSubmit = false
        vm.onSubmit = { _, _ in didSubmit = true }

        vm.moveSelectedAction(.next)
        vm.submitSelectedAction()

        XCTAssertFalse(didSubmit)
        XCTAssertEqual(vm.skillItems.map(\.title), ["当前天气"])
        XCTAssertEqual(vm.draft, "")
    }

    @MainActor
    func testSkillOnlyInputCanSubmit() {
        let vm = PromptPanelViewModel(actions: [makeReviewAction()])
        var submitted: [PromptPanelComposerItem] = []
        vm.onSubmit = { items, _ in submitted = items }

        vm.submitSelectedAction()
        vm.submit()

        XCTAssertEqual(skills(in: submitted).map(\.title), ["Review"])
        XCTAssertEqual(vm.skillItems, [])
    }

    @MainActor
    func testMoveSelectedActionCyclesThroughFilteredActions() {
        let vm = PromptPanelViewModel(actions: makeTestActions())

        vm.moveSelectedAction(.next)
        XCTAssertEqual(vm.selectedActionId, "weather/current")

        vm.moveSelectedAction(.next)
        XCTAssertEqual(vm.selectedActionId, "new-thread")
    }

    @MainActor
    func testSubmitSelectedActionFallsBackToPlainSubmitWhenNoFilteredActionExists() {
        let vm = PromptPanelViewModel(actions: makeTestActions())
        var submitted: [PromptPanelComposerItem] = []
        vm.onSubmit = { items, _ in submitted = items }

        vm.draft = "hello"
        XCTAssertNil(vm.selectedAction)
        vm.submitSelectedAction()

        XCTAssertEqual(texts(in: submitted), ["hello"])
    }

    @MainActor
    func testAppendAttachmentSkipsNoAttachment() {
        let vm = PromptPanelViewModel(actions: [])
        vm.appendAttachment(.noAttachment)
        XCTAssertEqual(vm.attachments.count, 0)
    }

    @MainActor
    func testChipItemsExposeSkillsAndAttachmentsForDisplay() {
        let action = makeReviewAction()
        let vm = PromptPanelViewModel(actions: [action])

        vm.appendSkill(action)
        vm.appendAttachment(.imageRegion(id: "image-1", mimeType: "image/png", base64: "png-data"))

        XCTAssertEqual(vm.chipItems.map(\.displayLabel), ["Review", "区域截图"])
        XCTAssertEqual(vm.chipItems.map(\.iconSystemName), ["text.badge.plus", "photo"])
        XCTAssertEqual(vm.chipItems.map(\.tooltip), ["Review the user-provided code.", ""])
        XCTAssertEqual(vm.chipItems.map(\.canPreview), [false, true])
        XCTAssertEqual(vm.chipItems.map(\.id), ["skill:\(vm.skillItems[0].id)", "attachment:image-1"])
    }

    @MainActor
    func testRemoveChipDeletesSkillOrAttachmentByDisplayChipId() {
        let action = makeReviewAction()
        let vm = PromptPanelViewModel(actions: [action])

        vm.appendSkill(action)
        vm.appendAttachment(.textSelection(id: "selection-1", text: "selected code"))
        let skillChipId = vm.chipItems[0].id
        let attachmentChipId = vm.chipItems[1].id

        vm.removeChip(id: skillChipId)
        XCTAssertEqual(vm.skillItems, [])
        XCTAssertEqual(vm.attachments.map(\.id), ["selection-1"])

        vm.removeChip(id: attachmentChipId)
        XCTAssertEqual(vm.attachments, [])
    }

    @MainActor
    func testPreviewChipForwardsOnlyImageAttachments() {
        let action = makeReviewAction()
        let vm = PromptPanelViewModel(actions: [action])
        var previewedAttachment: PromptAttachmentResult?
        vm.onPreviewImage = { previewedAttachment = $0 }

        vm.appendSkill(action)
        vm.appendAttachment(.textSelection(id: "selection-1", text: "selected code"))
        vm.appendAttachment(.imageRegion(id: "image-1", mimeType: "image/png", base64: "png-data"))
        let skillChipId = vm.chipItems[0].id
        let selectionChipId = vm.chipItems[1].id
        let imageChipId = vm.chipItems[2].id

        vm.previewChip(id: skillChipId)
        XCTAssertNil(previewedAttachment)

        vm.previewChip(id: selectionChipId)
        XCTAssertNil(previewedAttachment)

        vm.previewChip(id: imageChipId)
        XCTAssertEqual(previewedAttachment, .imageRegion(id: "image-1", mimeType: "image/png", base64: "png-data"))
    }

    @MainActor
    func testSubmitForwardsAttachmentsAndDropsErrors() {
        let vm = PromptPanelViewModel(actions: [])
        vm.draft = "hello"
        vm.appendAttachment(.textSelection(id: "a", text: "code"))
        vm.appendAttachment(.selectionError(id: "b", message: "boom"))

        var received: [PromptAttachmentResult] = []
        vm.onSubmit = { _, attachments in received = attachments }
        vm.submit()

        XCTAssertEqual(received.count, 1)
        XCTAssertEqual(received.first?.id, "a")
        XCTAssertEqual(vm.attachments, [])
    }

    @MainActor
    func testOpenSettingsCallsOnOpenSettingsAndOnHide() {
        let vm = PromptPanelViewModel(actions: makeTestActions())
        var didOpenSettings = false
        var didHide = false
        vm.onOpenSettings = { didOpenSettings = true }
        vm.onHide = { didHide = true }

        vm.openSettings()

        XCTAssertTrue(didOpenSettings)
        XCTAssertTrue(didHide)
    }

    private func makeTestActions() -> [ActionDefinition] {
        [
            ActionDefinition.skill(
                id: "new-thread",
                trigger: "new",
                title: "新建Thread",
                description: "thread",
                template: "Start a new thread.",
                defaultShortcut: nil
            ),
            ActionDefinition.skill(
                id: "weather/current",
                trigger: "weather",
                title: "当前天气",
                description: "weather",
                template: "查询当前天气",
                defaultShortcut: nil
            )
        ]
    }

    private func makeReviewAction() -> ActionDefinition {
        ActionDefinition.skill(
            id: "review/code_review",
            trigger: "r",
            title: "Review",
            description: nil,
            template: "Review the user-provided code.",
            defaultShortcut: nil
        )
    }

    private func texts(in items: [PromptPanelComposerItem]) -> [String] {
        items.compactMap {
            if case .text(let item) = $0 { return item.text }
            return nil
        }
    }

    private func skills(in items: [PromptPanelComposerItem]) -> [PromptPanelSkillInputItem] {
        items.compactMap {
            if case .skill(let item) = $0 { return item }
            return nil
        }
    }
}

@MainActor
private final class PromptWorkspaceClient: WorkspaceManaging {
    func workspaceCommand(_ type: String, payload: [String: Any]?) async throws -> [String: Any] {
        ["workspaces": [
            ["id": "workspace-first", "rootPath": "/tmp/first", "name": "First", "createdAt": "2026-10-04T00:00:00Z"],
            ["id": "workspace-second", "rootPath": "/tmp/second", "name": "Second", "createdAt": "2026-10-04T00:00:00Z"]
        ]]
    }
}
