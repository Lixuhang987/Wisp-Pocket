import Foundation
import KeyboardShortcuts
import SwiftUI

@Observable
@MainActor
final class AppCoordinator {
    enum Action {
        case showPromptPanel
        case hidePromptPanel
        case togglePromptPanel
        case submitPrompt([PromptPanelComposerItem], attachments: [PromptAttachmentResult])
        case openSettings
        case openHistory
        case settingsWindowClosed
        case threadWindowClosed
    }

    var agentServerError: String? { agentServerHealth.errorMessage }

    @ObservationIgnored private let services: AppServices
    @ObservationIgnored private let agentServerHealth: AgentServerHealth
    @ObservationIgnored private let threadWindowLifecycle: any ThreadWindowManaging
    @ObservationIgnored private let activityWindowCommandClient: (any ActivityWindowCommanding)?
    @ObservationIgnored private let settingsLifecycle: SettingsLifecycle
    @ObservationIgnored private let activationPolicy = AppActivationPolicyCoordinator()
    @ObservationIgnored private var registeredActionShortcutNames: Set<KeyboardShortcuts.Name> = []
    @ObservationIgnored private var showThreadWindowMonitor: Any?
    @ObservationIgnored private let promptPanelController: any PromptPanelControlling
    @ObservationIgnored private lazy var captureCoordinator = PromptCaptureCoordinator(
        controller: promptPanelController,
        selectionProvider: MacSelectionCaptureProvider(),
        regionProvider: MacRegionCaptureProvider()
    )

    convenience init() { self.init(services: AppServices()) }

    init(
        services: AppServices,
        promptPanelController: (any PromptPanelControlling)? = nil
    ) {
        self.services = services
        self.agentServerHealth = AgentServerHealth(
            appServer: services.appServer,
            fatalAlertPresenter: services.fatalAlertPresenter,
            showsFatalAlert: services.showsFatalAlert
        )
        self.activityWindowCommandClient = services.activityWindowCommandClient
        self.threadWindowLifecycle = ElectronThreadWindowLifecycle(client: services.threadWindowCommandClient)
        self.settingsLifecycle = SettingsLifecycle(
            windowPresenter: services.settingsWindowPresenter,
            activationPolicy: activationPolicy,
            setActivationPolicy: services.setActivationPolicy
        )
        self.promptPanelController = promptPanelController ?? PromptPanelController(
            presentationMode: services.promptPanelPresentationMode
        )
        bootstrap()
    }

    func bootstrap() {
        setupAppearanceTheme()
        setupPromptPanel()
        setupHotkey()
        setupAgentServerHealth()
        agentServerHealth.start()
    }

    func shutdown() async {
        await services.builtinFeatures?.stopAndWait()
        if let showThreadWindowMonitor {
            NSEvent.removeMonitor(showThreadWindowMonitor)
        }
        services.appearanceChangeObserver.stop()
        unregisterActionShortcuts()
        agentServerHealth.stop()
        settingsLifecycle.close()
        threadWindowLifecycle.close()
    }

    func send(_ action: Action) {
        switch action {
        case .showPromptPanel:
            refreshActionDefinitions()
            promptPanelController.show()
        case .hidePromptPanel:
            promptPanelController.hide()
        case .togglePromptPanel:
            refreshActionDefinitions()
            promptPanelController.toggle()
        case .submitPrompt(let inputItems, let attachments):
            handleSubmitPrompt(inputItems, attachments: attachments)
        case .openSettings:
            handleOpenSettings()
        case .openHistory:
            handleOpenHistory()
        case .settingsWindowClosed:
            settingsLifecycle.handleClosed()
        case .threadWindowClosed:
            handleThreadWindowClosed()
        }
    }

    func makeSettingsViewModel() -> AgentSettingsViewModel {
        AgentSettingsViewModel(store: services.settingsStore)
    }

    func makeAppearanceSettingsViewModel() -> AppearanceSettingsViewModel {
        AppearanceSettingsViewModel(themeService: services.appearanceThemeService)
    }

    func makeToolSettingsViewModel() -> ToolSettingsViewModel {
        ToolSettingsViewModel(store: services.settingsStore, builtinFeatures: services.builtinFeatures)
    }

    func makeAgentTriggerSettingsViewModel() -> AgentTriggerSettingsViewModel {
        AgentTriggerSettingsViewModel(
            store: services.agentTriggerStore,
            runtime: services.agentTriggerRuntime,
            petClient: services.swiftThreadClient as? any PetManaging
        )
    }

    func makeAppendPromptSettingsViewModel() -> AppendPromptSettingsViewModel {
        AppendPromptSettingsViewModel()
    }

    func makeMCPSettingsViewModel() -> MCPSettingsViewModel {
        MCPSettingsViewModel()
    }

    func makePermissionRulesViewModel() -> PermissionRulesViewModel {
        PermissionRulesViewModel()
    }

    private func setupPromptPanel() {
        promptPanelController.updateTheme(services.appearanceThemeService.appTheme)
        refreshActionDefinitions()
        promptPanelController.onSubmit = { [weak self] inputItems, attachments in
            self?.send(.submitPrompt(inputItems, attachments: attachments))
        }
        promptPanelController.onOpenSettings = { [weak self] in
            self?.send(.openSettings)
        }
        promptPanelController.onDidHide = { [weak self] in
            self?.handlePromptPanelHidden()
        }
    }

    private func setupAppearanceTheme() {
        services.appearanceThemeService.onThemeChange = { [weak self] theme in
            guard let self else { return }
            let appTheme = self.services.appearanceThemeService.appTheme
            self.promptPanelController.updateTheme(appTheme)
            self.settingsLifecycle.updateTheme(appTheme)
            try? self.services.threadWindowCommandClient.sendThemeChanged(theme)
        }
        services.appearanceChangeObserver.onSystemAppearanceChange = { [weak self] in
            self?.services.appearanceThemeService.systemAppearanceDidChange()
        }
        services.appearanceChangeObserver.start()
    }

    private func setupAgentServerHealth() {
        services.builtinFeatures?.start()
        services.appServer.onHostTerminationRequest = { [weak self] in
            guard let self else { return }
            self.services.terminateApplication()
        }
        agentServerHealth.onAvailabilityChange = { [weak self] available, message in
            guard let self else { return }
            self.promptPanelController.setSubmissionEnabled(available, message: message)
            if available {
                try? self.services.threadWindowCommandClient.sendThemeChanged(
                    self.services.appearanceThemeService.currentTheme
                )
                self.showElectronActivityWindow()
            }
        }
    }

    private func setupHotkey() {
        services.hotkeyRegistrar.registerShowPromptPanel { [weak self] in
            Task { @MainActor in self?.send(.togglePromptPanel) }
        }
        services.hotkeyRegistrar.registerCaptureSelection { [weak self] in
            Task { @MainActor in await self?.captureCoordinator.captureSelectionAndShow() }
        }
        services.hotkeyRegistrar.registerCaptureRegion { [weak self] in
            Task { @MainActor in await self?.captureCoordinator.captureRegionAndShow() }
        }
        showThreadWindowMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyUp) { [weak self] event in
            if AppScopedShortcutMatcher.matches(event, name: .showThreadWindow) {
                Task { @MainActor in self?.send(.openHistory) }
                return nil
            }
            return event
        }
    }

    private func showElectronActivityWindow() {
        guard let activityWindowCommandClient else { return }
        do {
            _ = try activityWindowCommandClient.showActivityWindow()
        } catch {
        }
    }

    private func handleSubmitPrompt(
        _ inputItems: [PromptPanelComposerItem],
        attachments: [PromptAttachmentResult]
    ) {
        ThreadWindowDiagnostics.emit("coordinator.submit_prompt")
        if let agentServerError {
            promptPanelController.setSubmissionEnabled(false, message: agentServerError)
            promptPanelController.show()
            return
        }

        guard let prompt = PromptSubmission.compose(
            inputItems: inputItems,
            attachments: attachments
        ) else { return }
        promptPanelController.hide(restoringFocus: false)

        if let swiftThreadClient = services.swiftThreadClient {
            Task { @MainActor in
                do {
                    let threadId = try await swiftThreadClient.submitInitialPrompt(prompt)
                    self.focusThreadWindowAfterSwiftThreadStart(threadId: threadId)
                } catch {
                    self.handleThreadWindowOpenFailure(error.localizedDescription)
                }
            }
            return
        }

        threadWindowLifecycle.createTabWithInitialPrompt(
            prompt,
            onOpened: {},
            onFailed: { [weak self] message in
                self?.handleThreadWindowOpenFailure(message)
            },
            onClosed: { [weak self] in
                self?.send(.threadWindowClosed)
            }
        )
    }

    private func focusThreadWindowAfterSwiftThreadStart(threadId: String) {
        threadWindowLifecycle.openOrFocusThread(
            threadID: threadId,
            onOpened: {},
            onFailed: { [weak self] message in
                self?.handleThreadWindowOpenFailure(message)
            },
            onClosed: { [weak self] in
                self?.send(.threadWindowClosed)
            }
        )
    }

    private func handleOpenSettings() {
        let actions = buildActionDefinitions()
        registerActionShortcuts(actions)
        settingsLifecycle.openOrFocus(
            settingsViewModel: makeSettingsViewModel(),
            appearanceViewModel: makeAppearanceSettingsViewModel(),
            toolSettingsViewModel: makeToolSettingsViewModel(),
            agentTriggerSettingsViewModel: makeAgentTriggerSettingsViewModel(),
            appendPromptSettingsViewModel: makeAppendPromptSettingsViewModel(),
            mcpSettingsViewModel: makeMCPSettingsViewModel(),
            permissionRulesViewModel: makePermissionRulesViewModel(),
            petViewModel: PetSettingsViewModel(client: services.swiftThreadClient as? any PetManaging, visibility: activityWindowCommandClient),
            shortcutActions: actions,
            appTheme: services.appearanceThemeService.appTheme,
            onClosed: { [weak self] in self?.send(.settingsWindowClosed) }
        )
    }

    private func handleOpenHistory() {
        ThreadWindowDiagnostics.emit("coordinator.open_history promptPanelVisible=\(promptPanelController.isVisible)")
        promptPanelController.hide(restoringFocus: false)
        threadWindowLifecycle.openOrFocusHistory(
            onOpened: {},
            onFailed: { [weak self] message in
                self?.handleThreadWindowOpenFailure(message)
            },
            onClosed: { [weak self] in
                self?.send(.threadWindowClosed)
            }
        )
    }

    private func handleThreadWindowOpenFailure(_ message: String) {
        promptPanelController.setSubmissionEnabled(false, message: message)
        promptPanelController.show()
    }

    private func handlePromptPanelHidden() {
        services.setActivationPolicy(activationPolicy.currentPolicy())
    }

    private func handleThreadWindowClosed() {
        threadWindowLifecycle.close()
    }

    private func refreshActionDefinitions() {
        let actions = buildActionDefinitions()
        promptPanelController.register(actions: actions)
        registerActionShortcuts(actions)
    }

    private func buildActionDefinitions() -> [ActionDefinition] {
        uniqueActionsByTrigger(services.actionManifestStore.load().actions)
    }

    private func uniqueActionsByTrigger(_ actions: [ActionDefinition]) -> [ActionDefinition] {
        var seen: Set<String> = []
        var result: [ActionDefinition] = []
        for action in actions {
            let trigger = action.trigger.lowercased()
            guard !seen.contains(trigger) else { continue }
            seen.insert(trigger)
            result.append(action)
        }
        return result
    }

    private func registerActionShortcuts(_ actions: [ActionDefinition]) {
        let names = Set(actions.map(\.shortcutName))
        for staleName in registeredActionShortcutNames.subtracting(names) {
            services.hotkeyRegistrar.unregisterActionShortcut(name: staleName)
        }
        registeredActionShortcutNames = names

        for action in actions {
            services.hotkeyRegistrar.registerActionShortcut(
                name: action.shortcutName,
                defaultShortcut: action.defaultShortcut
            ) { [weak self] in
                Task { @MainActor in self?.performActionShortcut(action) }
            }
        }
    }

    private func unregisterActionShortcuts() {
        for name in registeredActionShortcutNames {
            services.hotkeyRegistrar.unregisterActionShortcut(name: name)
        }
        registeredActionShortcutNames = []
    }

    private func performActionShortcut(_ action: ActionDefinition) {
        promptPanelController.selectActionAndShow(action)
    }
}
