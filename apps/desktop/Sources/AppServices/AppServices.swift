import AppKit
import Foundation
import KeyboardShortcuts

@MainActor
protocol SettingsWindowPresenting {
    func present(
        settingsViewModel: AgentSettingsViewModel,
        appearanceViewModel: AppearanceSettingsViewModel,
        toolSettingsViewModel: ToolSettingsViewModel,
        agentTriggerSettingsViewModel: AgentTriggerSettingsViewModel,
        appendPromptSettingsViewModel: AppendPromptSettingsViewModel,
        mcpSettingsViewModel: MCPSettingsViewModel,
        permissionRulesViewModel: PermissionRulesViewModel,
        workspaceViewModel: WorkspaceSettingsViewModel,
        shortcutActions: [ActionDefinition],
        appTheme: AppTheme,
        onClose: @escaping () -> Void
    ) -> NSWindow?

    func updateTheme(_ appTheme: AppTheme, for window: NSWindow?)
}

@MainActor
protocol HotkeyRegistering {
    func registerShowPromptPanel(handler: @escaping () -> Void)
    func registerCaptureSelection(handler: @escaping () -> Void)
    func registerCaptureRegion(handler: @escaping () -> Void)
    func registerActionShortcut(
        name: KeyboardShortcuts.Name,
        defaultShortcut: KeyboardShortcuts.Shortcut?,
        handler: @escaping () -> Void
    )
    func unregisterActionShortcut(name: KeyboardShortcuts.Name)
}

@MainActor
protocol FatalAlertPresenting {
    func showFatal(title: String, message: String, primaryButtonTitle: String, secondaryButtonTitle: String?, onSecondary: (() -> Void)?)
}

@MainActor
struct ElectronShellLaunchConfiguration: Equatable {
    let launchPath: String
    let arguments: [String]
    let environment: [String: String]
    let currentDirectoryURL: URL?
}

@MainActor
struct AppServicesRuntime {
    let appServer: any AppServerManaging
    let swiftThreadClient: (any SwiftThreadSubmitting)?
    let threadWindowCommandClient: any ThreadWindowCommanding
    let activityWindowCommandClient: (any ActivityWindowCommanding)?
}

@MainActor
final class AppServices {
    static let initialThemeEnvironmentKey = "HANDAGENT_INITIAL_THEME"

    let appServer: any AppServerManaging
    let threadWindowCommandClient: any ThreadWindowCommanding
    let activityWindowCommandClient: (any ActivityWindowCommanding)?
    let settingsStore: AgentSettingsStore
    let agentTriggerStore: AgentTriggerStore
    let agentTriggerRuntime: any AgentTriggerRuntimeService
    let appearanceThemeService: AppearanceThemeService
    let appearanceChangeObserver: any AppearanceChangeObserving
    let actionManifestStore: ActionManifestStore
    let dynamicToolServerURL: URL
    let threadServerURL: URL
    let swiftThreadClient: (any SwiftThreadSubmitting)?
    let hotkeyRegistrar: any HotkeyRegistering
    let settingsWindowPresenter: any SettingsWindowPresenting
    let fatalAlertPresenter: any FatalAlertPresenting
    let setActivationPolicy: @MainActor (NSApplication.ActivationPolicy) -> Void
    let terminateApplication: @MainActor () -> Void
    let showsFatalAlert: Bool
    let promptPanelPresentationMode: PromptPanelPresentationMode

    init(
        appServer: (any AppServerManaging)? = nil,
        threadWindowCommandClient: (any ThreadWindowCommanding)? = nil,
        activityWindowCommandClient: (any ActivityWindowCommanding)? = nil,
        settingsStore: AgentSettingsStore = AgentSettingsStore(),
        agentTriggerStore: AgentTriggerStore = AgentTriggerStore(),
        agentTriggerRuntime: (any AgentTriggerRuntimeService)? = nil,
        appearanceThemeService: AppearanceThemeService? = nil,
        appearanceChangeObserver: (any AppearanceChangeObserving)? = nil,
        actionManifestStore: ActionManifestStore = ActionManifestStore(),
        dynamicToolServerURL: URL = URL(string: "ws://127.0.0.1:4317/api/dynamic-tools")!,
        threadServerURL: URL = URL(string: "ws://127.0.0.1:4317/api/thread")!,
        swiftThreadClient: (any SwiftThreadSubmitting)? = nil,
        hotkeyRegistrar: any HotkeyRegistering = ProductionHotkeyRegistrar(),
        settingsWindowPresenter: any SettingsWindowPresenting = ProductionSettingsWindowPresenter(),
        fatalAlertPresenter: any FatalAlertPresenting = ProductionFatalAlertPresenter(),
        setActivationPolicy: @escaping @MainActor (NSApplication.ActivationPolicy) -> Void = {
            NSApplication.shared.setActivationPolicy($0)
        },
        terminateApplication: @escaping @MainActor () -> Void = {
            NSApplication.shared.terminate(nil)
        },
        environment: [String: String] = ProcessInfo.processInfo.environment,
        showsFatalAlert: Bool = true,
        promptPanelPresentationMode: PromptPanelPresentationMode = .visible
    ) {
        let resolvedAppearanceThemeService = appearanceThemeService ?? AppearanceThemeService(store: settingsStore)
        let runtime = appServer == nil
            ? AppServices.defaultRuntime(
                environment: environment,
                initialTheme: resolvedAppearanceThemeService.currentTheme,
                dynamicToolServerURL: dynamicToolServerURL,
                threadServerURL: threadServerURL
            )
            : nil
        let resolvedSwiftThreadClient = swiftThreadClient ?? runtime?.swiftThreadClient
        self.appServer = appServer ?? runtime!.appServer
        self.swiftThreadClient = resolvedSwiftThreadClient
        self.threadWindowCommandClient = threadWindowCommandClient ?? runtime?.threadWindowCommandClient ?? NopThreadWindowCommandClient()
        self.activityWindowCommandClient = activityWindowCommandClient ?? runtime?.activityWindowCommandClient
        self.settingsStore = settingsStore
        self.agentTriggerStore = agentTriggerStore
        self.agentTriggerStore.ensureBuiltinPackagesInstalled()
        ChromeBookmarksNativeHostInstaller.fromEnvironment(environment).ensureInstalled()
        self.agentTriggerRuntime = agentTriggerRuntime ?? AgentTriggerRuntime(
            registry: AgentTriggerRegistry(factories: [
                ChromeBookmarksAgentTriggerProviderFactory(),
                SystemClockAgentTriggerProviderFactory(),
            ]),
            store: agentTriggerStore,
            submit: { [weak swiftThreadClient = resolvedSwiftThreadClient] prompt in
                Task { @MainActor in
                    _ = try? await swiftThreadClient?.submitInitialPrompt(prompt)
                }
            }
        )
        self.appearanceThemeService = resolvedAppearanceThemeService
        self.appearanceChangeObserver = appearanceChangeObserver ?? SystemAppearanceChangeObserver()
        self.actionManifestStore = actionManifestStore
        self.dynamicToolServerURL = dynamicToolServerURL
        self.threadServerURL = threadServerURL
        self.hotkeyRegistrar = hotkeyRegistrar
        self.settingsWindowPresenter = settingsWindowPresenter
        self.fatalAlertPresenter = fatalAlertPresenter
        self.setActivationPolicy = setActivationPolicy
        self.terminateApplication = terminateApplication
        self.showsFatalAlert = showsFatalAlert
        self.promptPanelPresentationMode = promptPanelPresentationMode
    }

    static func testing(
        setActivationPolicy: @escaping @MainActor (NSApplication.ActivationPolicy) -> Void = { _ in },
        threadWindowCommandClient: any ThreadWindowCommanding = NopThreadWindowCommandClient(),
        activityWindowCommandClient: (any ActivityWindowCommanding)? = nil,
        settingsWindowPresenter: any SettingsWindowPresenting = NopSettingsWindowPresenter(),
        settingsStore: AgentSettingsStore = AgentSettingsStore(),
        agentTriggerStore: AgentTriggerStore = AgentTriggerStore(),
        agentTriggerRuntime: (any AgentTriggerRuntimeService)? = nil,
        appearanceThemeService: AppearanceThemeService? = nil,
        appearanceChangeObserver: (any AppearanceChangeObserving)? = nil,
        actionManifestStore: ActionManifestStore = ActionManifestStore(
            actionsDirectoryURL: URL(fileURLWithPath: "/dev/null", isDirectory: true)
        ),
        swiftThreadClient: (any SwiftThreadSubmitting)? = nil
    ) -> AppServices {
        AppServices(
            appServer: NopAppServer(),
            threadWindowCommandClient: threadWindowCommandClient,
            activityWindowCommandClient: activityWindowCommandClient,
            settingsStore: settingsStore,
            agentTriggerStore: agentTriggerStore,
            agentTriggerRuntime: agentTriggerRuntime,
            appearanceThemeService: appearanceThemeService,
            appearanceChangeObserver: appearanceChangeObserver ?? NopAppearanceChangeObserver(),
            actionManifestStore: actionManifestStore,
            dynamicToolServerURL: URL(string: "ws://127.0.0.1:0/noop-dynamic-tools")!,
            threadServerURL: URL(string: "ws://127.0.0.1:0/noop-thread")!,
            swiftThreadClient: swiftThreadClient,
            hotkeyRegistrar: NopHotkeyRegistrar(),
            settingsWindowPresenter: settingsWindowPresenter,
            fatalAlertPresenter: NopFatalAlertPresenter(),
            setActivationPolicy: setActivationPolicy,
            terminateApplication: {},
            showsFatalAlert: false,
            promptPanelPresentationMode: .hiddenForTesting
        )
    }

    static func defaultRuntime(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        initialTheme: HostThemePayload? = nil,
        dynamicToolServerURL: URL = URL(string: "ws://127.0.0.1:4317/api/dynamic-tools")!,
        threadServerURL: URL = URL(string: "ws://127.0.0.1:4317/api/thread")!
    ) -> AppServicesRuntime {
        let pluginManager = PluginDynamicToolManager()
        pluginManager.reload()
        let providerService = DynamicToolProviderService(pluginManager: pluginManager)
        let dynamicToolClient = DynamicToolProviderConnectionClient(
            connection: AppServerConnection(serverURL: dynamicToolServerURL),
            providerService: providerService
        )
        let swiftThreadClient = SwiftThreadClient(
            connection: AppServerConnection(serverURL: threadServerURL),
            dynamicToolsProvider: { providerService.dynamicToolSpecs }
        )

        let configuration = defaultElectronShellLaunchConfiguration(
            environment: environment,
            initialTheme: initialTheme
        )
        let shell = ElectronShellProcess(
            launchPath: configuration.launchPath,
            arguments: configuration.arguments,
            environment: configuration.environment,
            currentDirectoryURL: configuration.currentDirectoryURL
        )
        let appServer = ElectronBackedAppServer(
            shell: shell,
            dynamicToolClient: dynamicToolClient,
            swiftThreadClient: swiftThreadClient
        )
        return AppServicesRuntime(
            appServer: appServer,
            swiftThreadClient: swiftThreadClient,
            threadWindowCommandClient: appServer,
            activityWindowCommandClient: appServer
        )
    }

    static func defaultElectronShellLaunchConfiguration(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        initialTheme: HostThemePayload? = nil,
        currentDirectoryURL: URL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true),
        bundleExecutableURL: URL? = Bundle.main.executableURL,
        bundleResourceURL: URL? = Bundle.main.resourceURL,
        bundleURL: URL? = Bundle.main.bundleURL,
        fileExists: @escaping (String) -> Bool = { FileManager.default.fileExists(atPath: $0) }
    ) -> ElectronShellLaunchConfiguration {
        let repoRoot = AgentServerRepositoryRootLocator(
            agentServerRelativePath: "apps/electron-shell/package.json",
            fileExists: fileExists
        ).locate(
            bundleExecutableURL: bundleExecutableURL,
            bundleResourceURL: bundleResourceURL,
            bundleURL: bundleURL,
            currentDirectoryURL: currentDirectoryURL
        )
        let bundledElectronMain = bundleResourceURL?
            .appendingPathComponent("ElectronShell/dist/main/main.js")
        let explicitElectronMain = environment["HANDAGENT_ELECTRON_MAIN"]
            .flatMap { $0.isEmpty ? nil : $0 }
            .map { resolveElectronMainPath($0, repoRoot: repoRoot) }
        let bundledElectronMainPath = bundledElectronMain.flatMap { fileExists($0.path) ? $0.path : nil }
        let defaultElectronMain = repoRoot?
            .appendingPathComponent("apps/electron-shell/dist/main/main.js")
            .path
            ?? "apps/electron-shell/dist/main/main.js"
        let electronMain = explicitElectronMain
            ?? bundledElectronMainPath
            ?? defaultElectronMain
        var launchEnvironment = environment
        launchEnvironment.removeValue(forKey: "HANDAGENT_DEFAULT_DYNAMIC_TOOLS")
        if let repoRoot {
            launchEnvironment["HANDAGENT_REPO_ROOT"] = repoRoot.path
        }
        AgentServerRuntimeMode.apply(to: &launchEnvironment, resourcesURL: bundleResourceURL)
        if let initialThemeData = initialTheme.flatMap({ try? JSONEncoder().encode($0) }),
           let initialThemeJSON = String(data: initialThemeData, encoding: .utf8) {
            launchEnvironment[initialThemeEnvironmentKey] = initialThemeJSON
        }

        if let electronBinary = environment["HANDAGENT_ELECTRON_BINARY"].flatMap({ $0.isEmpty ? nil : $0 }) {
            return ElectronShellLaunchConfiguration(
                launchPath: electronBinary,
                arguments: electronBinary == "/usr/bin/env" ? ["electron", electronMain] : [electronMain],
                environment: launchEnvironment,
                currentDirectoryURL: repoRoot
            )
        }

        if explicitElectronMain == nil && bundledElectronMainPath != nil {
            return ElectronShellLaunchConfiguration(
                launchPath: "/usr/bin/env",
                arguments: ["electron", electronMain],
                environment: launchEnvironment,
                currentDirectoryURL: nil
            )
        }

        return ElectronShellLaunchConfiguration(
            launchPath: "/usr/bin/env",
            arguments: [
                "pnpm",
                "--filter",
                "handagent-electron-shell",
                "exec",
                "electron",
                electronMain
            ],
            environment: launchEnvironment,
            currentDirectoryURL: repoRoot
        )
    }

    private static func resolveElectronMainPath(_ path: String, repoRoot: URL?) -> String {
        guard !path.hasPrefix("/"), let repoRoot else {
            return path
        }
        return repoRoot.appendingPathComponent(path).path
    }
}

@MainActor
final class NopAppServer: AppServerManaging {
    var isAvailable = true
    var startupErrorMessage: String?
    var onAvailabilityChange: ((Bool) -> Void)?
    var onFatalError: ((String) -> Void)?
    var onHostTerminationRequest: (() -> Void)?

    func start() {}
    func stop() {}
}

@MainActor
final class NopHotkeyRegistrar: HotkeyRegistering {
    func registerShowPromptPanel(handler: @escaping () -> Void) {}
    func registerCaptureSelection(handler: @escaping () -> Void) {}
    func registerCaptureRegion(handler: @escaping () -> Void) {}
    func registerActionShortcut(
        name: KeyboardShortcuts.Name,
        defaultShortcut: KeyboardShortcuts.Shortcut?,
        handler: @escaping () -> Void
    ) {}
    func unregisterActionShortcut(name: KeyboardShortcuts.Name) {}
}

@MainActor
final class NopThreadWindowCommandClient: ThreadWindowCommanding {
    var onThreadWindowClosed: (() -> Void)?
    var onCommandResult: ((ThreadWindowCommandResult) -> Void)?

    func openInitialPrompt(_ prompt: PromptSubmission) throws -> String {
        "noop-open-initial-prompt"
    }

    func openHistory() throws -> String {
        "noop-open-history"
    }

    func focus(threadId: String?) throws -> String {
        "noop-focus"
    }

    func sendThemeChanged(_ theme: HostThemePayload) throws -> String {
        "noop-theme-changed"
    }
}

@MainActor
final class NopAppearanceChangeObserver: AppearanceChangeObserving {
    var onSystemAppearanceChange: (() -> Void)?

    func start() {}
    func stop() {}
}

@MainActor
final class NopSettingsWindowPresenter: SettingsWindowPresenting {
    func present(
        settingsViewModel: AgentSettingsViewModel,
        appearanceViewModel: AppearanceSettingsViewModel,
        toolSettingsViewModel: ToolSettingsViewModel,
        agentTriggerSettingsViewModel: AgentTriggerSettingsViewModel,
        appendPromptSettingsViewModel: AppendPromptSettingsViewModel,
        mcpSettingsViewModel: MCPSettingsViewModel,
        permissionRulesViewModel: PermissionRulesViewModel,
        workspaceViewModel: WorkspaceSettingsViewModel,
        shortcutActions: [ActionDefinition],
        appTheme: AppTheme,
        onClose: @escaping () -> Void
    ) -> NSWindow? {
        _ = settingsViewModel
        _ = appearanceViewModel
        _ = toolSettingsViewModel
        _ = agentTriggerSettingsViewModel
        _ = appendPromptSettingsViewModel
        _ = mcpSettingsViewModel
        _ = permissionRulesViewModel
        _ = workspaceViewModel
        _ = shortcutActions
        _ = appTheme
        _ = onClose
        let window: NSWindow? = nil
        return window
    }

    func updateTheme(_ appTheme: AppTheme, for window: NSWindow?) {}
}

@MainActor
final class NopFatalAlertPresenter: FatalAlertPresenting {
    func showFatal(title: String, message: String, primaryButtonTitle: String, secondaryButtonTitle: String?, onSecondary: (() -> Void)?) {}
}
