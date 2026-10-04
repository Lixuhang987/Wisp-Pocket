import XCTest
@testable import HandAgentDesktop

final class AppCoordinatorTests: XCTestCase {
    @MainActor
    func testOpenSettingsBuildsSettingsWindowAndPromotesRegularPolicy() {
        var builtWindowCount = 0
        var appliedPolicies: [NSApplication.ActivationPolicy] = []
        let presenter = StubSettingsWindowPresenter { builtWindowCount += 1 }
        let services = AppServices.testing(
            setActivationPolicy: { appliedPolicies.append($0) },
            settingsWindowPresenter: presenter
        )
        let coordinator = AppCoordinator(services: services)

        coordinator.send(.openSettings)

        XCTAssertEqual(builtWindowCount, 1)
        XCTAssertEqual(appliedPolicies.last, .regular)

        let shellServer = TriggerableAppServer()
        let commandClient = RecordingThreadWindowCommandClient()
        let electronCoordinator = AppCoordinator(services: electronServices(appServer: shellServer, commandClient: commandClient))
        electronCoordinator.send(.openElectronSettings)
        electronCoordinator.send(.openElectronSettings)
        XCTAssertEqual(shellServer.settingsOpenCount, 2)
        XCTAssertEqual(builtWindowCount, 1)
    }

    @MainActor
    func testSettingsWindowClosedReturnsAccessoryPolicyWithoutThreads() {
        var appliedPolicies: [NSApplication.ActivationPolicy] = []
        let presenter = StubSettingsWindowPresenter()
        let services = AppServices.testing(
            setActivationPolicy: { appliedPolicies.append($0) },
            settingsWindowPresenter: presenter
        )
        let coordinator = AppCoordinator(services: services)

        coordinator.send(.openSettings)
        coordinator.send(.settingsWindowClosed)

        XCTAssertEqual(appliedPolicies.suffix(2), [.regular, .accessory])
    }

    @MainActor
    func testSubmitPromptSendsElectronCommand() {
        let client = RecordingThreadWindowCommandClient()
        let coordinator = AppCoordinator(services: electronServices(commandClient: client))

        coordinator.send(.submitPrompt(promptItems("hello"), attachments: []))

        XCTAssertEqual(client.openedPrompts.map(\.textContent), ["hello"])
    }

    @MainActor
    func testSubmitPromptUsesSwiftThreadClientBeforeOpeningThreadWindow() async throws {
        let threadClient = RecordingSwiftThreadClient(threadId: "thread-123")
        let windowClient = RecordingThreadWindowCommandClient()
        let panel = RecordingPromptPanelController()
        let coordinator = AppCoordinator(
            services: electronServices(
                commandClient: windowClient,
                swiftThreadClient: threadClient
            ),
            promptPanelController: panel
        )

        coordinator.send(.submitPrompt(promptItems("hello"), attachments: []))
        try await Task.sleep(for: .milliseconds(10))

        XCTAssertEqual(threadClient.submittedPrompts.map(\.textContent), ["hello"])
        XCTAssertEqual(threadClient.submittedPrompts.first?.targetWorkspaceId, "workspace-test")
        XCTAssertTrue(windowClient.openedPrompts.isEmpty)
        XCTAssertEqual(windowClient.focusedThreadIDs, ["thread-123"])
        windowClient.complete(commandId: "focus-1", kind: .focus, ok: false, error: "window unavailable")
        XCTAssertFalse(panel.viewModel?.isSubmissionInputDisabled ?? true)
        panel.viewModel?.draft = "next task"
        panel.viewModel?.submit()
        try await Task.sleep(for: .milliseconds(10))
        XCTAssertEqual(threadClient.submittedPrompts.map(\.textContent), ["hello", "next task"])
        _ = coordinator
    }

    @MainActor
    func testThreadWindowOpenAckDoesNotPromoteSwiftHostPolicy() {
        var appliedPolicies: [NSApplication.ActivationPolicy] = []
        let client = RecordingThreadWindowCommandClient()
        let coordinator = AppCoordinator(
            services: electronServices(
                commandClient: client,
                setActivationPolicy: { appliedPolicies.append($0) }
            )
        )

        coordinator.send(.submitPrompt(promptItems("hello"), attachments: []))
        // 提交时隐藏 PromptPanel 会恢复宿主策略；这里只检查后续 Electron 事件。
        XCTAssertEqual(appliedPolicies, [.accessory])
        appliedPolicies.removeAll()
        client.complete(commandId: "open-initial-prompt-1", kind: .openInitialPrompt, ok: true)

        XCTAssertEqual(appliedPolicies, [])
    }

    @MainActor
    func testThreadWindowClosedDoesNotDemoteSwiftHostPolicy() {
        var appliedPolicies: [NSApplication.ActivationPolicy] = []
        let client = RecordingThreadWindowCommandClient()
        let coordinator = AppCoordinator(
            services: electronServices(
                commandClient: client,
                setActivationPolicy: { appliedPolicies.append($0) }
            )
        )

        coordinator.send(.submitPrompt(promptItems("hello"), attachments: []))
        // 提交时隐藏 PromptPanel 会恢复宿主策略；这里只检查后续 Electron 事件。
        XCTAssertEqual(appliedPolicies, [.accessory])
        appliedPolicies.removeAll()
        client.complete(commandId: "open-initial-prompt-1", kind: .openInitialPrompt, ok: true)
        XCTAssertEqual(appliedPolicies, [])
        coordinator.send(.threadWindowClosed)

        XCTAssertEqual(appliedPolicies, [])
    }

    @MainActor
    func testPromptPanelHideRestoresAccessoryPolicyWhenSettingsIsClosed() {
        var appliedPolicies: [NSApplication.ActivationPolicy] = []
        let promptPanel = RecordingPromptPanelController()
        let coordinator = AppCoordinator(
            services: electronServices(
                commandClient: RecordingThreadWindowCommandClient(),
                setActivationPolicy: { appliedPolicies.append($0) }
            ),
            promptPanelController: promptPanel
        )
        coordinator.bootstrap()

        coordinator.send(.showPromptPanel)
        coordinator.send(.hidePromptPanel)

        XCTAssertEqual(appliedPolicies, [.accessory])
    }

    @MainActor
    func testOpenHistorySendsElectronCommand() {
        let client = RecordingThreadWindowCommandClient()
        let coordinator = AppCoordinator(services: electronServices(commandClient: client))

        coordinator.send(.openHistory)

        XCTAssertEqual(client.openHistoryCount, 1)
    }

    @MainActor
    func testOpenHistoryHidesPromptPanelWithoutRestoringFocus() async throws {
        let client = RecordingThreadWindowCommandClient()
        let promptPanel = RecordingPromptPanelController()
        let coordinator = AppCoordinator(
            services: electronServices(commandClient: client),
            promptPanelController: promptPanel
        )

        coordinator.send(.showPromptPanel)
        coordinator.send(.openHistory)
        try await Task.sleep(for: .milliseconds(10))

        XCTAssertEqual(promptPanel.hideCalls, [false])
        XCTAssertEqual(client.openHistoryCount, 1)
    }

    @MainActor
    func testOpenHistoryHidesPromptPanelBeforeSendingThreadWindowCommand() async throws {
        var events: [String] = []
        let client = RecordingThreadWindowCommandClient {
            events.append($0)
        }
        let promptPanel = RecordingPromptPanelController {
            events.append($0)
        }
        let coordinator = AppCoordinator(
            services: electronServices(commandClient: client),
            promptPanelController: promptPanel
        )

        coordinator.send(.showPromptPanel)
        coordinator.send(.openHistory)
        try await Task.sleep(for: .milliseconds(10))

        XCTAssertEqual(events, ["promptPanel.show", "promptPanel.hide(false)", "threadWindow.openHistory"])
    }

    @MainActor
    func testOpenHistoryHidesVisiblePromptPanelBeforeOpeningThreadWindow() async throws {
        let client = RecordingThreadWindowCommandClient()
        let promptPanel = RecordingPromptPanelController()
        let coordinator = AppCoordinator(
            services: electronServices(commandClient: client),
            promptPanelController: promptPanel
        )

        coordinator.send(.showPromptPanel)
        coordinator.send(.openHistory)
        try await Task.sleep(for: .milliseconds(10))

        XCTAssertEqual(promptPanel.hideCalls, [false])
        XCTAssertFalse(promptPanel.isVisible)
    }

    @MainActor
    func testAppearancePreferenceChangeSendsThemeToElectron() {
        let client = RecordingThreadWindowCommandClient()
        let coordinator = AppCoordinator(services: electronServices(commandClient: client))

        coordinator.makeAppearanceSettingsViewModel().themePreference = .dark

        XCTAssertEqual(client.sentThemes.last, HostThemePayload(preference: .dark, resolved: .dark))
    }

    @MainActor
    func testSystemAppearanceChangeSendsResolvedThemeToElectron() async {
        let client = RecordingThreadWindowCommandClient()
        let observer = RecordingAppearanceChangeObserver()
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let settingsStore = AgentSettingsStore(homeDirectoryURL: homeURL)
        var resolvedTheme: ResolvedAppearanceTheme = .light
        let appearanceThemeService = AppearanceThemeService(
            store: settingsStore,
            systemResolver: { resolvedTheme }
        )
        let coordinator = AppCoordinator(
            services: AppServices(
                appServer: NopAppServer(),
                threadWindowCommandClient: client,
                settingsStore: settingsStore,
                appearanceThemeService: appearanceThemeService,
                appearanceChangeObserver: observer,
                hotkeyRegistrar: NopHotkeyRegistrar(),
                settingsWindowPresenter: NopSettingsWindowPresenter(),
                fatalAlertPresenter: NopFatalAlertPresenter(),
                setActivationPolicy: { _ in }
            )
        )

        XCTAssertEqual(observer.startCount, 1)

        resolvedTheme = .dark
        observer.publishSystemAppearanceChange()

        XCTAssertEqual(client.sentThemes.last, HostThemePayload(preference: .system, resolved: .dark))

        await coordinator.shutdown()
        XCTAssertEqual(observer.stopCount, 1)
    }

    @MainActor
    func testShowAndTogglePromptPanelDoNotSendThreadWindowCommand() {
        let client = RecordingThreadWindowCommandClient()
        let coordinator = AppCoordinator(services: electronServices(commandClient: client))

        coordinator.send(.showPromptPanel)
        coordinator.send(.togglePromptPanel)

        XCTAssertEqual(client.commandCount, 0)
    }

    @MainActor
    func testShowsActivityWindowWhenAppServerBecomesAvailable() async throws {
        let appServer = TriggerableAppServer()
        appServer.isAvailable = false
        let client = RecordingThreadWindowCommandClient()
        let activityClient = RecordingActivityWindowCommandClient()
        let coordinator = AppCoordinator(
            services: electronServices(
                appServer: appServer,
                commandClient: client,
                activityClient: activityClient
            )
        )

        XCTAssertEqual(activityClient.showCount, 0)

        appServer.publishAvailability(true)
        try await Task.sleep(for: .milliseconds(10))

        XCTAssertEqual(activityClient.showCount, 1)
        XCTAssertEqual(client.sentThemes, [HostThemePayload(preference: .system, resolved: .light)])
        _ = coordinator
    }

    @MainActor
    func testActivityShowThrowDoesNotCreateSwiftStatusBubbleFallback() async throws {
        closeStatusBubblePanels()
        let appServer = TriggerableAppServer()
        appServer.isAvailable = false
        let activityClient = RecordingActivityWindowCommandClient()
        activityClient.showError = RecordingActivityWindowCommandError.showFailed
        let coordinator = AppCoordinator(
            services: electronServices(
                appServer: appServer,
                commandClient: RecordingThreadWindowCommandClient(),
                activityClient: activityClient
            )
        )

        appServer.publishAvailability(true)
        try await Task.sleep(for: .milliseconds(10))

        XCTAssertEqual(activityClient.showCount, 1)
        XCTAssertEqual(visibleStatusBubblePanelCount(), 0)
        await coordinator.shutdown()
        closeStatusBubblePanels()
    }

    @MainActor
    func testShutdownClosesPromptPanelWindows() async throws {
        closePromptPanelWindows()
        let app = NSApplication.shared
        let commandClient = RecordingThreadWindowCommandClient()
        let activityClient = RecordingActivityWindowCommandClient()
        let coordinator = AppCoordinator(
            services: electronServices(
                commandClient: commandClient,
                activityClient: activityClient
            )
        )

        await coordinator.shutdown()
        try await Task.sleep(for: .milliseconds(10))

        XCTAssertFalse(app.windows.contains { $0 is PromptPanelWindow && $0.isVisible })
        closePromptPanelWindows()
    }

    @MainActor
    func testSubmitPromptIgnoresEmptyString() {
        let client = RecordingThreadWindowCommandClient()
        let coordinator = AppCoordinator(services: electronServices(commandClient: client))

        coordinator.send(.submitPrompt(promptItems("   "), attachments: []))

        XCTAssertEqual(client.commandCount, 0)
    }

    @MainActor
    func testSubmitPromptDoesNotCreateThreadWhileAgentServerUnavailable() async throws {
        let stub = TriggerableAppServer()
        let client = RecordingThreadWindowCommandClient()
        let services = electronServices(appServer: stub, commandClient: client)
        let coordinator = AppCoordinator(services: services)

        stub.publishAvailability(false)
        try await Task.sleep(for: .milliseconds(10))
        coordinator.send(.submitPrompt(promptItems("hello"), attachments: []))

        XCTAssertEqual(client.commandCount, 0)
        XCTAssertEqual(coordinator.agentServerError, "agent-server 已断开，正在尝试重连…")
    }

    @MainActor
    func testHistoryActionSendsCommandEveryTime() {
        let client = RecordingThreadWindowCommandClient()
        let coordinator = AppCoordinator(services: electronServices(commandClient: client))

        coordinator.send(.openHistory)
        coordinator.send(.openHistory)

        XCTAssertEqual(client.openHistoryCount, 2)
    }

    @MainActor
    func testMultiplePromptsSendMultipleElectronCommands() {
        let client = RecordingThreadWindowCommandClient()
        let coordinator = AppCoordinator(services: electronServices(commandClient: client))

        coordinator.send(.submitPrompt(promptItems("first"), attachments: []))
        coordinator.send(.submitPrompt(promptItems("second"), attachments: []))

        XCTAssertEqual(client.openedPrompts.map(\.textContent), ["first", "second"])
    }

    @MainActor
    func testInjectedAgentServerStartIsCalledOnBootstrap() throws {
        let stub = TriggerableAppServer()
        _ = AppCoordinator(services: electronServices(appServer: stub, commandClient: RecordingThreadWindowCommandClient()))

        XCTAssertEqual(stub.startCount, 1)
    }

    @MainActor
    func testHostTerminationRequestTerminatesApplication() {
        let appServer = TriggerableAppServer()
        var terminateCount = 0
        let coordinator = AppCoordinator(
            services: electronServices(
                appServer: appServer,
                commandClient: RecordingThreadWindowCommandClient(),
                terminateApplication: { terminateCount += 1 }
            )
        )

        appServer.requestHostTermination()

        _ = coordinator
        XCTAssertEqual(terminateCount, 1)
    }

    @MainActor
    func testShortcutActionsComeOnlyFromManifestActions() throws {
        let root = try FileManager.default.url(
            for: .itemReplacementDirectory,
            in: .userDomainMask,
            appropriateFor: FileManager.default.temporaryDirectory,
            create: true
        )
        defer { try? FileManager.default.removeItem(at: root) }
        let actions = root.appendingPathComponent("actions", isDirectory: true)
        let actionDir = actions.appendingPathComponent("conflict", isDirectory: true)
        try FileManager.default.createDirectory(at: actionDir, withIntermediateDirectories: true)
        try """
        {
          "version": 1,
          "id": "conflict",
          "title": "Conflict",
          "enabled": true,
          "prompts": [
            {
              "name": "settings",
              "trigger": "settings",
              "title": "Action Settings",
              "template": "Action settings"
            }
          ]
        }
        """.data(using: .utf8)!.write(to: actionDir.appendingPathComponent("action.json"))
        let presenter = StubSettingsWindowPresenter()
        let services = AppServices.testing(
            settingsWindowPresenter: presenter,
            actionManifestStore: ActionManifestStore(actionsDirectoryURL: actions)
        )
        let coordinator = AppCoordinator(services: services)

        coordinator.send(.openSettings)

        XCTAssertEqual(presenter.lastShortcutActions.map(\.id), ["conflict/settings"])
    }
}

@MainActor
private func closePromptPanelWindows() {
    for window in NSApplication.shared.windows where window is PromptPanelWindow {
        window.close()
    }
}

@MainActor
private func visibleStatusBubblePanelCount() -> Int {
    NSApplication.shared.windows.filter {
        String(describing: type(of: $0)).contains("StatusBubblePanel") && $0.isVisible
    }.count
}

@MainActor
private func closeStatusBubblePanels() {
    for window in NSApplication.shared.windows where String(describing: type(of: window)).contains("StatusBubblePanel") {
        window.close()
    }
}

@MainActor
private func electronServices(
    appServer: any AppServerManaging = NopAppServer(),
    commandClient: RecordingThreadWindowCommandClient,
    activityClient: RecordingActivityWindowCommandClient? = nil,
    swiftThreadClient: (any SwiftThreadSubmitting)? = nil,
    fatalAlertPresenter: any FatalAlertPresenting = NopFatalAlertPresenter(),
    setActivationPolicy: @escaping @MainActor (NSApplication.ActivationPolicy) -> Void = { _ in },
    terminateApplication: @escaping @MainActor () -> Void = {}
) -> AppServices {
    let settingsStore = AgentSettingsStore(homeDirectoryURL: TestFiles.makeTemporaryHomeDirectory())
    settingsStore.updatePromptWorkspace("workspace-test")
    return AppServices(
        appServer: appServer,
        threadWindowCommandClient: commandClient,
        activityWindowCommandClient: activityClient,
        settingsStore: settingsStore,
        appearanceThemeService: AppearanceThemeService(store: settingsStore, systemResolver: { .light }),
        swiftThreadClient: swiftThreadClient,
        hotkeyRegistrar: NopHotkeyRegistrar(),
        settingsWindowPresenter: NopSettingsWindowPresenter(),
        fatalAlertPresenter: fatalAlertPresenter,
        setActivationPolicy: setActivationPolicy,
        terminateApplication: terminateApplication,
        promptPanelPresentationMode: .hiddenForTesting
    )
}

@MainActor
private final class RecordingPromptPanelController: PromptPanelControlling {
    private let recordEvent: (String) -> Void
    var onSubmit: (([PromptPanelComposerItem], [PromptAttachmentResult]) -> Void)?
    var onOpenSettings: (() -> Void)?
    var onDidShow: (() -> Void)?
    var onDidHide: (() -> Void)?
    var isVisible = false
    private(set) var viewModel: PromptPanelViewModel?
    private(set) var hideCalls: [Bool] = []

    init(recordEvent: @escaping (String) -> Void = { _ in }) {
        self.recordEvent = recordEvent
    }

    func configure(viewModel: PromptPanelViewModel) {
        self.viewModel = viewModel
        viewModel.onSubmit = { [weak self] items, attachments in self?.onSubmit?(items, attachments) }
    }
    func updateTheme(_ theme: AppTheme) {}
    func register(actions: [ActionDefinition]) {}
    func appendAttachment(_ attachment: PromptAttachmentResult) {}
    func selectActionAndShow(_ action: ActionDefinition) {}
    func setSubmissionEnabled(_ enabled: Bool, message: String?) { viewModel?.setSubmissionEnabled(enabled, message: message) }

    func show() {
        isVisible = true
        recordEvent("promptPanel.show")
        onDidShow?()
    }

    func hide(restoringFocus: Bool) {
        isVisible = false
        hideCalls.append(restoringFocus)
        recordEvent("promptPanel.hide(\(restoringFocus))")
        onDidHide?()
    }

    func toggle() {
        if isVisible {
            hide(restoringFocus: true)
        } else {
            show()
        }
    }
}

private enum RecordingActivityWindowCommandError: Error {
    case showFailed
}

@MainActor
private final class RecordingAppearanceChangeObserver: AppearanceChangeObserving {
    var onSystemAppearanceChange: (() -> Void)?
    private(set) var startCount = 0
    private(set) var stopCount = 0

    func start() {
        startCount += 1
    }

    func stop() {
        stopCount += 1
    }

    func publishSystemAppearanceChange() {
        onSystemAppearanceChange?()
    }
}

@MainActor
private final class RecordingActivityWindowCommandClient: ActivityWindowCommanding {
    var onActivityWindowCommandResult: ((ActivityWindowCommandResult) -> Void)?
    var showError: Error?
    private(set) var showCount = 0

    func showActivityWindow() throws -> String {
        showCount += 1
        if let showError {
            throw showError
        }
        return "activity-show-\(showCount)"
    }
}

@MainActor
private final class TriggerableAppServer: AppServerManaging, SettingsWindowCommanding {
    var isAvailable = true
    var startupErrorMessage: String?
    var onAvailabilityChange: ((Bool) -> Void)?
    var onFatalError: ((String) -> Void)?
    var onHostTerminationRequest: (() -> Void)?
    private(set) var startCount = 0
    private(set) var settingsOpenCount = 0
    var onSettingsCommandFailure: ((String) -> Void)?

    func openSettingsWindow() throws -> String {
        settingsOpenCount += 1
        return "settings-\(settingsOpenCount)"
    }

    func start() { startCount += 1 }
    func stop() {}

    func publishAvailability(_ available: Bool) {
        isAvailable = available
        onAvailabilityChange?(available)
    }

    func requestHostTermination() {
        onHostTerminationRequest?()
    }
}

@MainActor
private final class RecordingThreadWindowCommandClient: ThreadWindowCommanding {
    private let recordEvent: (String) -> Void
    var onThreadWindowClosed: (() -> Void)?
    var onCommandResult: ((ThreadWindowCommandResult) -> Void)?
    private(set) var openedPrompts: [PromptSubmission] = []
    private(set) var openHistoryCount = 0
    private(set) var focusedThreadIDs: [String?] = []
    private(set) var sentThemes: [HostThemePayload] = []
    private var commandCounters: [ThreadWindowCommandKind: Int] = [:]

    var commandCount: Int {
        openedPrompts.count + openHistoryCount + focusedThreadIDs.count
    }

    init(recordEvent: @escaping (String) -> Void = { _ in }) {
        self.recordEvent = recordEvent
    }

    func openInitialPrompt(_ prompt: PromptSubmission) throws -> String {
        openedPrompts.append(prompt)
        recordEvent("threadWindow.openInitialPrompt")
        return nextCommandId(for: .openInitialPrompt)
    }

    func openHistory() throws -> String {
        openHistoryCount += 1
        recordEvent("threadWindow.openHistory")
        return nextCommandId(for: .openHistory)
    }

    func focus(threadId: String?) throws -> String {
        focusedThreadIDs.append(threadId)
        recordEvent("threadWindow.focus")
        return nextCommandId(for: .focus)
    }

    func sendThemeChanged(_ theme: HostThemePayload) throws -> String {
        sentThemes.append(theme)
        return "theme-\(sentThemes.count)"
    }

    func complete(
        commandId: String,
        kind: ThreadWindowCommandKind,
        ok: Bool,
        error: String? = nil
    ) {
        onCommandResult?(
            ThreadWindowCommandResult(
                commandId: commandId,
                kind: kind,
                ok: ok,
                error: error
            )
        )
    }

    private func nextCommandId(for kind: ThreadWindowCommandKind) -> String {
        let next = (commandCounters[kind] ?? 0) + 1
        commandCounters[kind] = next
        switch kind {
        case .openInitialPrompt:
            return "open-initial-prompt-\(next)"
        case .openHistory:
            return "open-history-\(next)"
        case .focus:
            return "focus-\(next)"
        }
    }
}

@MainActor
private final class RecordingSwiftThreadClient: SwiftThreadSubmitting {
    private let threadId: String
    private(set) var submittedPrompts: [PromptSubmission] = []
    private(set) var connectCount = 0
    private(set) var disconnectCount = 0

    init(threadId: String) {
        self.threadId = threadId
    }

    func connect() {
        connectCount += 1
    }

    func disconnect() {
        disconnectCount += 1
    }

    func submitInitialPrompt(_ prompt: PromptSubmission) async throws -> String {
        submittedPrompts.append(prompt)
        return threadId
    }
}

@MainActor
private final class RecordingFatalAlertPresenter: FatalAlertPresenting {
    private(set) var fatalCalls: [(String, String)] = []
    var triggerSecondaryAction = false

    func showFatal(title: String, message: String, primaryButtonTitle: String, secondaryButtonTitle: String?, onSecondary: (() -> Void)?) {
        _ = primaryButtonTitle
        _ = secondaryButtonTitle
        fatalCalls.append((title, message))
        if triggerSecondaryAction {
            onSecondary?()
        }
    }
}

@MainActor
final class StubSettingsWindowPresenter: SettingsWindowPresenting {
    private let onPresent: () -> Void
    private(set) var lastShortcutActions: [ActionDefinition] = []
    private(set) var presentedWindow: NSWindow?
    private(set) var refreshedThemes: [AppTheme] = []

    init(onPresent: @escaping () -> Void = {}) {
        self.onPresent = onPresent
    }

    func present(
        appearanceViewModel: AppearanceSettingsViewModel,
        toolSettingsViewModel: ToolSettingsViewModel,
        agentTriggerSettingsViewModel: AgentTriggerSettingsViewModel,
        appendPromptSettingsViewModel: AppendPromptSettingsViewModel,
        shortcutActions: [ActionDefinition],
        appTheme: AppTheme,
        onClose: @escaping () -> Void
    ) -> NSWindow? {
        _ = appearanceViewModel
        _ = toolSettingsViewModel
        _ = agentTriggerSettingsViewModel
        _ = appendPromptSettingsViewModel
        _ = appTheme
        _ = onClose
        lastShortcutActions = shortcutActions
        onPresent()
        let window = NSWindow()
        presentedWindow = window
        return window
    }

    func updateTheme(_ appTheme: AppTheme, for window: NSWindow?) {
        refreshedThemes.append(appTheme)
    }
}
