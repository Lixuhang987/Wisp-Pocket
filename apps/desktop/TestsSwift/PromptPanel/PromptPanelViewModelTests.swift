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
    func testSubmitCallsOnSubmitWithTextItemArray() {
        let vm = PromptPanelViewModel(actions: makeTestActions())
        var submitted: [PromptPanelComposerItem] = []
        vm.onSubmit = { items, _ in submitted = items }

        vm.draft = "  hello world  "
        vm.submit()

        XCTAssertEqual(texts(in: submitted), ["  hello world  "])
        XCTAssertEqual(vm.draft, "")
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
    func testDeleteChipBeforeTextRemovesLastSkillWhenTextIsEmpty() {
        let vm = PromptPanelViewModel(actions: makeTestActions())

        vm.appendSkill(makeTestActions()[0])
        vm.appendSkill(makeTestActions()[1])

        XCTAssertTrue(vm.deleteChipBeforeText())
        XCTAssertEqual(vm.skillItems.map(\.title), ["新建Thread"])
    }

    @MainActor
    func testDeleteChipBeforeTextDoesNotRemoveWhenTextHasContent() {
        let vm = PromptPanelViewModel(actions: makeTestActions())

        vm.appendSkill(makeTestActions()[0])
        vm.draft = "hello"

        XCTAssertFalse(vm.deleteChipBeforeText())
        XCTAssertEqual(vm.skillItems.count, 1)
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
