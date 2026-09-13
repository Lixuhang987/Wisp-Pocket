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
        let resourcesURL = URL(fileURLWithPath: "/Applications/Wisp Pocket.app/Contents/Resources", isDirectory: true)
        let bundledMain = resourcesURL.appendingPathComponent("ElectronShell/dist/main/main.js")
        let configuration = AppServices.defaultElectronShellLaunchConfiguration(
            environment: [:],
            currentDirectoryURL: URL(fileURLWithPath: "/tmp", isDirectory: true),
            bundleExecutableURL: URL(fileURLWithPath: "/Applications/Wisp Pocket.app/Contents/MacOS/HandAgentDesktop"),
            bundleResourceURL: resourcesURL,
            bundleURL: URL(fileURLWithPath: "/Applications/Wisp Pocket.app", isDirectory: true),
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
    func testPackagedLaunchUsesWorkspaceElectronWithoutGlobalElectron() async throws {
        let repoRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let packageURL = repoRoot.appendingPathComponent("apps/electron-shell", isDirectory: true)
        let bundleURL = repoRoot.appendingPathComponent("dist/Wisp Pocket.app", isDirectory: true)
        let resourcesURL = bundleURL.appendingPathComponent("Contents/Resources", isDirectory: true)
        let bundledMain = resourcesURL.appendingPathComponent("ElectronShell/dist/main/main.js")
        let binURL = repoRoot.appendingPathComponent("bin", isDirectory: true)
        let recordURL = repoRoot.appendingPathComponent("launch.txt")
        for directory in [packageURL, bundledMain.deletingLastPathComponent(), binURL] {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        defer { try? FileManager.default.removeItem(at: repoRoot) }
        for file in [repoRoot.appendingPathComponent("Package.swift"), packageURL.appendingPathComponent("package.json"), bundledMain] {
            try Data().write(to: file)
        }
        let pnpmURL = binURL.appendingPathComponent("pnpm")
        try """
        #!/bin/sh
        [ . -ef "$HANDAGENT_REPO_ROOT" ] || exit 64
        printf '%s\\n' "$HANDAGENT_REPO_ROOT" "$@" > "$HANDAGENT_TEST_LAUNCH_RECORD"
        printf '%s\\n' '{"channel":"electron_shell","type":"electron.ready","timestamp":"2026-09-14T00:00:00.000Z"}'
        /bin/sleep 1
        """.write(to: pnpmURL, atomically: true, encoding: .utf8)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: pnpmURL.path)

        let configuration = AppServices.defaultElectronShellLaunchConfiguration(
            environment: ["PATH": binURL.path, "HANDAGENT_TEST_LAUNCH_RECORD": recordURL.path],
            currentDirectoryURL: URL(fileURLWithPath: "/", isDirectory: true),
            bundleExecutableURL: bundleURL.appendingPathComponent("Contents/MacOS/HandAgentDesktop"),
            bundleResourceURL: resourcesURL,
            bundleURL: bundleURL
        )
        let shell = ElectronShellProcess(
            launchPath: configuration.launchPath,
            arguments: configuration.arguments,
            environment: configuration.environment,
            currentDirectoryURL: configuration.currentDirectoryURL
        )
        let ready = expectation(description: "packaged main starts with the workspace runtime")
        shell.onEvent = { event in
            if event == .electronReady(timestamp: "2026-09-14T00:00:00.000Z") { ready.fulfill() }
        }
        try shell.start()
        defer { shell.stop() }
        await fulfillment(of: [ready], timeout: 2)

        let launch = try String(contentsOf: recordURL, encoding: .utf8)
        XCTAssertEqual(launch.components(separatedBy: "\n"), [
            repoRoot.path, "--filter", "handagent-electron-shell", "exec", "electron", bundledMain.path, "",
        ])
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
            fileExists: { path in path == "/custom/electron" }
        )

        XCTAssertEqual(configuration.launchPath, "/custom/electron")
        XCTAssertEqual(configuration.arguments, ["/custom/main.js"])
    }

    @MainActor
    func testMissingElectronBinaryOverrideFallsBackToWorkspaceElectron() throws {
        let repoRoot = URL(fileURLWithPath: "/repo/worktree", isDirectory: true)
        let staleBinary = repoRoot
            .appendingPathComponent("node_modules/.pnpm/electron@42.3.3/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron")
            .path
        let electronMain = repoRoot.appendingPathComponent("apps/electron-shell/dist/main/main.js").path
        let configuration = AppServices.defaultElectronShellLaunchConfiguration(
            environment: [
                "HANDAGENT_ELECTRON_BINARY": staleBinary,
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

        XCTAssertEqual(configuration.launchPath, "/usr/bin/env")
        XCTAssertEqual(configuration.arguments, [
            "pnpm",
            "--filter",
            "handagent-electron-shell",
            "exec",
            "electron",
            electronMain,
        ])
        XCTAssertNil(configuration.environment["HANDAGENT_ELECTRON_BINARY"])
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
