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
    @ObservationIgnored private var isThreadWindowCountedInActivationPolicy = false
    @ObservationIgnored private var registeredActionShortcutNames: Set<KeyboardShortcuts.Name> = []
    @ObservationIgnored private var showThreadWindowMonitor: Any?
    @ObservationIgnored private lazy var promptPanelController = PromptPanelController(
        presentationMode: services.promptPanelPresentationMode
    )
    @ObservationIgnored private lazy var captureCoordinator = PromptCaptureCoordinator(
        controller: promptPanelController,
        selectionProvider: MacSelectionCaptureProvider(),
        regionProvider: MacRegionCaptureProvider()
    )

    convenience init() { self.init(services: AppServices()) }

    init(services: AppServices) {
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
        bootstrap()
    }

    func bootstrap() {
        setupAppearanceTheme()
        setupPromptPanel()
        setupHotkey()
        setupAgentServerHealth()
        agentServerHealth.start()
    }

    func shutdown() {
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
        ToolSettingsViewModel(store: services.settingsStore)
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
            let shortcut = KeyboardShortcuts.getShortcut(for: .showThreadWindow)
                ?? KeyboardShortcuts.Name.showThreadWindow.defaultShortcut
            if let shortcut, let pressed = KeyboardShortcuts.Shortcut(event: event), pressed == shortcut {
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
        threadWindowLifecycle.createTabWithInitialPrompt(
            prompt,
            onOpened: { [weak self] in
                guard let self else { return }
                self.handleThreadWindowOpened()
            },
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
            appendPromptSettingsViewModel: makeAppendPromptSettingsViewModel(),
            mcpSettingsViewModel: makeMCPSettingsViewModel(),
            permissionRulesViewModel: makePermissionRulesViewModel(),
            workspaceViewModel: WorkspaceSettingsViewModel(),
            shortcutActions: actions,
            appTheme: services.appearanceThemeService.appTheme,
            onClosed: { [weak self] in self?.send(.settingsWindowClosed) }
        )
    }

    private func handleOpenHistory() {
        threadWindowLifecycle.openOrFocusHistory(
            onOpened: { [weak self] in
                self?.handleThreadWindowOpened()
            },
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

    private func handleThreadWindowOpened() {
        guard !isThreadWindowCountedInActivationPolicy else { return }
        isThreadWindowCountedInActivationPolicy = true
        services.setActivationPolicy(activationPolicy.policyAfterUpdatingOpenThreadWindows(by: 1))
    }

    private func handleThreadWindowClosed() {
        threadWindowLifecycle.close()
        guard isThreadWindowCountedInActivationPolicy else { return }
        isThreadWindowCountedInActivationPolicy = false
        services.setActivationPolicy(activationPolicy.policyAfterUpdatingOpenThreadWindows(by: -1))
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
