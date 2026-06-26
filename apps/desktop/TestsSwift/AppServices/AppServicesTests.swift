import XCTest
@testable import HandAgentDesktop

final class AppServicesTests: XCTestCase {
    @MainActor
    func testDefaultRuntimeProvidesElectronWindowCommandClientsWithoutFeatureFlag() throws {
        let runtime = AppServices.defaultRuntime(
            environment: [
                "HANDAGENT_ELECTRON_MAIN": "apps/electron-shell/dist/main/main.js",
            ],
            initialTheme: HostThemePayload(preference: .system, resolved: .dark)
        )

        XCTAssertTrue(runtime.appServer is ElectronBackedAppServer)
        XCTAssertTrue(runtime.threadWindowCommandClient is ElectronBackedAppServer)
        XCTAssertTrue(runtime.activityWindowCommandClient is ElectronBackedAppServer)
        XCTAssertTrue((runtime.appServer as AnyObject) === (runtime.threadWindowCommandClient as AnyObject))
        XCTAssertTrue((runtime.appServer as AnyObject) === (runtime.activityWindowCommandClient as AnyObject))
    }

    @MainActor
    func testDefaultServicesProvideElectronActivityWindowClient() {
        let services = AppServices(
            environment: [
                "HANDAGENT_ELECTRON_MAIN": "apps/electron-shell/dist/main/main.js",
            ]
        )

        XCTAssertNotNil(services.threadWindowCommandClient)
        XCTAssertNotNil(services.activityWindowCommandClient)
        XCTAssertTrue(services.showsFatalAlert)
    }

    @MainActor
    func testConstructingServicesDoesNotReloadAgentTriggerRuntime() {
        let runtime = RecordingAgentTriggerRuntime()
        let services = AppServices(
            appServer: NopAppServer(),
            threadWindowCommandClient: NopThreadWindowCommandClient(),
            agentTriggerRuntime: runtime,
            hotkeyRegistrar: NopHotkeyRegistrar(),
            settingsWindowPresenter: NopSettingsWindowPresenter(),
            fatalAlertPresenter: NopFatalAlertPresenter(),
            setActivationPolicy: { _ in },
            showsFatalAlert: false
        )

        XCTAssertEqual(runtime.reloadCount, 0)
        _ = services
    }

    @MainActor
    func testAgentTriggerRuntimeSubmitsThroughSwiftThreadClient() async throws {
        let threadClient = RecordingSwiftThreadClient(threadId: "trigger-thread")
        let services = AppServices.testing(swiftThreadClient: threadClient)
        let prompt = try XCTUnwrap(PromptSubmission.compose(draft: "from trigger", attachments: []))

        services.agentTriggerRuntime.submit(prompt)
        await Task.yield()

        XCTAssertEqual(threadClient.submittedPrompts.map(\.summary), ["from trigger"])
    }

    @MainActor
    func testDefaultElectronShellLaunchUsesPnpmWorkspaceElectron() throws {
        let repoRoot = URL(fileURLWithPath: "/repo/worktree", isDirectory: true)
        let electronMain = repoRoot.appendingPathComponent("apps/electron-shell/dist/main/main.js").path
        let configuration = AppServices.defaultElectronShellLaunchConfiguration(
            environment: [:],
            currentDirectoryURL: repoRoot,
            bundleExecutableURL: nil,
            bundleResourceURL: nil,
            bundleURL: nil,
            fileExists: { path in
                path == repoRoot.appendingPathComponent("Package.swift").path ||
                    path == repoRoot.appendingPathComponent("apps/electron-shell/package.json").path
            }
        )

        XCTAssertEqual(configuration.launchPath, "/usr/bin/env")
        XCTAssertEqual(configuration.arguments, [
                "pnpm",
                "--filter",
                "handagent-electron-shell",
                "exec",
                "electron",
                electronMain,
            ])
        XCTAssertEqual(configuration.currentDirectoryURL?.path, repoRoot.path)
        XCTAssertEqual(configuration.environment["HANDAGENT_REPO_ROOT"], repoRoot.path)
    }

    @MainActor
    func testDefaultElectronShellLaunchPassesInitialDarkThemeThroughEnvironment() throws {
        let repoRoot = URL(fileURLWithPath: "/repo/worktree", isDirectory: true)
        let configuration = AppServices.defaultElectronShellLaunchConfiguration(
            environment: [:],
            initialTheme: HostThemePayload(preference: .dark, resolved: .dark),
            currentDirectoryURL: repoRoot,
            bundleExecutableURL: nil,
            bundleResourceURL: nil,
            bundleURL: nil,
            fileExists: { path in
                path == repoRoot.appendingPathComponent("Package.swift").path ||
                    path == repoRoot.appendingPathComponent("apps/electron-shell/package.json").path
            }
        )

        XCTAssertEqual(
            try decodeInitialTheme(from: configuration),
            HostThemePayload(preference: .dark, resolved: .dark)
        )
    }

    @MainActor
    func testDefaultElectronShellLaunchPassesInitialSystemDarkThemeWithoutFlatteningPreference() throws {
        let repoRoot = URL(fileURLWithPath: "/repo/worktree", isDirectory: true)
        let configuration = AppServices.defaultElectronShellLaunchConfiguration(
            environment: [:],
            initialTheme: HostThemePayload(preference: .system, resolved: .dark),
            currentDirectoryURL: repoRoot,
            bundleExecutableURL: nil,
            bundleResourceURL: nil,
            bundleURL: nil,
            fileExists: { path in
                path == repoRoot.appendingPathComponent("Package.swift").path ||
                    path == repoRoot.appendingPathComponent("apps/electron-shell/package.json").path
            }
        )

        XCTAssertEqual(
            try decodeInitialTheme(from: configuration),
            HostThemePayload(preference: .system, resolved: .dark)
        )
    }

    @MainActor
    func testDefaultElectronShellLaunchPassesInitialLightThemeInsteadOfFixedDark() throws {
        let repoRoot = URL(fileURLWithPath: "/repo/worktree", isDirectory: true)
        let configuration = AppServices.defaultElectronShellLaunchConfiguration(
            environment: [:],
            initialTheme: HostThemePayload(preference: .light, resolved: .light),
            currentDirectoryURL: repoRoot,
            bundleExecutableURL: nil,
            bundleResourceURL: nil,
            bundleURL: nil,
            fileExists: { path in
                path == repoRoot.appendingPathComponent("Package.swift").path ||
                    path == repoRoot.appendingPathComponent("apps/electron-shell/package.json").path
            }
        )

        XCTAssertEqual(
            try decodeInitialTheme(from: configuration),
            HostThemePayload(preference: .light, resolved: .light)
        )
    }

    @MainActor
    func testDefaultElectronShellLaunchDoesNotPassDefaultDynamicToolsThroughEnvironment() throws {
        let repoRoot = URL(fileURLWithPath: "/repo/worktree", isDirectory: true)
        let configuration = AppServices.defaultElectronShellLaunchConfiguration(
            environment: ["HANDAGENT_DEFAULT_DYNAMIC_TOOLS": "[{\"name\":\"legacy\"}]"],
            currentDirectoryURL: repoRoot,
            bundleExecutableURL: nil,
            bundleResourceURL: nil,
            bundleURL: nil,
            fileExists: { path in
                path == repoRoot.appendingPathComponent("Package.swift").path ||
                    path == repoRoot.appendingPathComponent("apps/electron-shell/package.json").path
            }
        )

        XCTAssertNil(configuration.environment["HANDAGENT_DEFAULT_DYNAMIC_TOOLS"])
    }

    @MainActor
    func testRelativeElectronMainOverrideResolvesAgainstRepositoryRoot() throws {
        let repoRoot = URL(fileURLWithPath: "/repo/worktree", isDirectory: true)
        let configuration = AppServices.defaultElectronShellLaunchConfiguration(
            environment: [
                "HANDAGENT_ELECTRON_MAIN": "apps/electron-shell/dist/main/main.js",
            ],
            currentDirectoryURL: repoRoot,
            bundleExecutableURL: nil,
            bundleResourceURL: nil,
            bundleURL: nil,
            fileExists: { path in
                path == repoRoot.appendingPathComponent("Package.swift").path ||
                    path == repoRoot.appendingPathComponent("apps/electron-shell/package.json").path
            }
        )

        XCTAssertEqual(
            configuration.arguments,
            [
                "pnpm",
                "--filter",
                "handagent-electron-shell",
                "exec",
                "electron",
                repoRoot.appendingPathComponent("apps/electron-shell/dist/main/main.js").path,
            ]
        )
    }

    @MainActor
    func testDefaultElectronShellLaunchPrefersBundledMainWhenPackagedResourcesExist() throws {
        let resourcesURL = URL(fileURLWithPath: "/Applications/HandAgentDesktop.app/Contents/Resources", isDirectory: true)
        let bundledMain = resourcesURL.appendingPathComponent("ElectronShell/dist/main/main.js")
        let configuration = AppServices.defaultElectronShellLaunchConfiguration(
            environment: [:],
            currentDirectoryURL: URL(fileURLWithPath: "/tmp", isDirectory: true),
            bundleExecutableURL: URL(fileURLWithPath: "/Applications/HandAgentDesktop.app/Contents/MacOS/HandAgentDesktop"),
            bundleResourceURL: resourcesURL,
            bundleURL: URL(fileURLWithPath: "/Applications/HandAgentDesktop.app", isDirectory: true),
            fileExists: { path in
                path == bundledMain.path
            }
        )

        XCTAssertEqual(configuration.launchPath, "/usr/bin/env")
        XCTAssertEqual(configuration.arguments, [
            "electron",
            bundledMain.path,
        ])
        XCTAssertNil(configuration.currentDirectoryURL)
    }

    @MainActor
    func testExplicitElectronBinaryPreservesOverride() throws {
        let configuration = AppServices.defaultElectronShellLaunchConfiguration(
            environment: [
                "HANDAGENT_ELECTRON_BINARY": "/custom/electron",
                "HANDAGENT_ELECTRON_MAIN": "/custom/main.js",
            ],
            currentDirectoryURL: URL(fileURLWithPath: "/repo/worktree", isDirectory: true),
            bundleExecutableURL: nil,
            bundleResourceURL: nil,
            bundleURL: nil,
            fileExists: { _ in false }
        )

        XCTAssertEqual(configuration.launchPath, "/custom/electron")
        XCTAssertEqual(configuration.arguments, ["/custom/main.js"])
    }

    @MainActor
    private func decodeInitialTheme(from configuration: ElectronShellLaunchConfiguration) throws -> HostThemePayload {
        let initialThemeEnvironmentKey = AppServices.initialThemeEnvironmentKey
        let rawValue = configuration.environment[initialThemeEnvironmentKey]
        let raw = try XCTUnwrap(rawValue)
        let dataValue = raw.data(using: .utf8)
        let data = try XCTUnwrap(dataValue)
        return try JSONDecoder().decode(HostThemePayload.self, from: data)
    }
}

@MainActor
private final class RecordingSwiftThreadClient: SwiftThreadSubmitting {
    private let threadId: String
    private(set) var submittedPrompts: [PromptSubmission] = []

    init(threadId: String) {
        self.threadId = threadId
    }

    func connect() {}
    func disconnect() {}

    func submitInitialPrompt(_ prompt: PromptSubmission) async throws -> String {
        submittedPrompts.append(prompt)
        return threadId
    }
}

@MainActor
private final class RecordingAgentTriggerRuntime: AgentTriggerRuntimeReloading, AgentTriggerSubmitting {
    private(set) var reloadCount = 0
    private(set) var submittedPrompts: [PromptSubmission] = []

    func reload() throws {
        reloadCount += 1
    }

    func submit(_ prompt: PromptSubmission) {
        submittedPrompts.append(prompt)
    }
}
