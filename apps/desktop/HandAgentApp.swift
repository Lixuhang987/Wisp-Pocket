import AppKit
import KeyboardShortcuts
import SwiftUI

@main
struct WispPocketApp: App {
    @NSApplicationDelegateAdaptor(WispPocketApplicationDelegate.self) private var appDelegate
    @State private var coordinator: AppCoordinator

    init() {
        let coordinator = AppCoordinator()
        _coordinator = State(initialValue: coordinator)
        appDelegate.coordinator = coordinator
    }

    var body: some Scene {
        Settings {
            EmptyView()
        }
        .commands {
            CommandGroup(replacing: .appSettings) {
                Button("设置…") {
                    coordinator.send(.openSettings)
                }
            }
        }
    }
}

@MainActor
final class WispPocketApplicationDelegate: NSObject, NSApplicationDelegate {
    weak var coordinator: AppCoordinator?
    var replyToTermination: @MainActor (NSApplication, Bool) -> Void = { app, shouldTerminate in
        app.reply(toApplicationShouldTerminate: shouldTerminate)
    }
    private var hasShutDown = false
    private var shutdownTask: Task<Void, Never>?

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard !hasShutDown else { return .terminateNow }
        if shutdownTask == nil {
            shutdownTask = Task { @MainActor in
                await coordinator?.shutdown()
                hasShutDown = true
                shutdownTask = nil
                replyToTermination(sender, true)
            }
        }
        return .terminateLater
    }
}
