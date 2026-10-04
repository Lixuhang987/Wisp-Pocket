import Foundation

@MainActor
final class ElectronBackedAppServer: AppServerManaging, ThreadWindowCommanding, ActivityWindowCommanding, SettingsWindowCommanding {
    private let shell: any ElectronShellProcessing
    private let dynamicToolClient: DynamicToolProviderConnectionClient?
    private let swiftThreadClient: (any SwiftThreadSubmitting)?
    private var hasAgentServerHealth = false
    private var lastPublishedAvailability = false
    private var isRunning = false
    private var agentServerErrorMessage: String?
    private var pendingSettingsCommands = Set<String>()
    var onSettingsCommandFailure: ((String) -> Void)?
    private var pendingCommandKinds: [String: ThreadWindowCommandKind] = [:]
    private var pendingActivityCommandKinds: [String: ActivityWindowCommandKind] = [:]

    var startupErrorMessage: String? {
        agentServerErrorMessage
    }

    var onAvailabilityChange: ((Bool) -> Void)?
    var onFatalError: ((String) -> Void)?
    var onHostTerminationRequest: (() -> Void)?
    var onThreadWindowClosed: (() -> Void)?
    var onCommandResult: ((ThreadWindowCommandResult) -> Void)?
    var onActivityWindowCommandResult: ((ActivityWindowCommandResult) -> Void)?

    var isAvailable: Bool {
        hasAgentServerHealth && agentServerErrorMessage == nil
    }

    init(
        shell: any ElectronShellProcessing,
        dynamicToolClient: DynamicToolProviderConnectionClient? = nil,
        swiftThreadClient: (any SwiftThreadSubmitting)? = nil
    ) {
        self.shell = shell
        self.dynamicToolClient = dynamicToolClient
        self.swiftThreadClient = swiftThreadClient
    }

    func start() {
        resetGate()
        isRunning = true
        shell.onEvent = { [weak self] event in
            self?.handle(event)
        }
        shell.onTermination = { [weak self] message in
            self?.handleTermination(message)
        }

        do {
            try shell.start()
        } catch {
            isRunning = false
            shell.onEvent = nil
            shell.onTermination = nil
            agentServerErrorMessage = error.localizedDescription
            publishAvailability(force: true)
        }
    }

    func stop() {
        try? shell.send(.shutdown(commandId: UUID().uuidString))
        isRunning = false
        shell.onEvent = nil
        shell.onTermination = nil
        onHostTerminationRequest = nil
        onThreadWindowClosed = nil
        onCommandResult = nil
        onSettingsCommandFailure = nil
        onActivityWindowCommandResult = nil
        pendingSettingsCommands.removeAll()
        pendingCommandKinds.removeAll()
        pendingActivityCommandKinds.removeAll()
        dynamicToolClient?.disconnect()
        swiftThreadClient?.disconnect()
        shell.stop()
        hasAgentServerHealth = false
        agentServerErrorMessage = nil
        publishAvailability(force: lastPublishedAvailability)
    }

    @discardableResult
    func openInitialPrompt(_ prompt: PromptSubmission) throws -> String {
        try sendThreadWindowCommand(.openInitialPrompt) {
            .openInitialPrompt(
                commandId: $0,
                payload: ElectronInitialPromptPayload(prompt: prompt)
            )
        }
    }

    @discardableResult
    func openSettingsWindow() throws -> String {
        let id = UUID().uuidString
        pendingSettingsCommands.insert(id)
        do { try shell.send(.openSettings(commandId: id)) }
        catch { pendingSettingsCommands.remove(id); throw error }
        return id
    }

    @discardableResult
    func openHistory() throws -> String {
        try sendThreadWindowCommand(.openHistory) { .openHistory(commandId: $0) }
    }

    @discardableResult
    func focus(threadId: String?) throws -> String {
        try sendThreadWindowCommand(.focus) { .focus(commandId: $0, threadId: threadId) }
    }

    @discardableResult
    func sendThemeChanged(_ theme: HostThemePayload) throws -> String {
        let commandId = UUID().uuidString
        try shell.send(.themeChanged(commandId: commandId, theme: theme))
        return commandId
    }

    @discardableResult
    func setPetVisible(petId: String, visible: Bool) throws -> String {
        let commandId = UUID().uuidString
        pendingActivityCommandKinds[commandId] = .petVisibility(petId: petId, visible: visible)
        do { try shell.send(.petVisibility(commandId: commandId, petId: petId, visible: visible)) }
        catch { pendingActivityCommandKinds.removeValue(forKey: commandId); throw error }
        return commandId
    }

    func showActivityWindow() throws -> String {
        let commandId = UUID().uuidString
        pendingActivityCommandKinds[commandId] = .show
        do {
            try shell.send(.showActivityWindow(commandId: commandId))
            return commandId
        } catch {
            pendingActivityCommandKinds.removeValue(forKey: commandId)
            throw error
        }
    }

    private func handle(_ event: ElectronShellEvent) {
        guard isRunning else { return }

        switch event {
        case .agentServerHealth(let available, let message):
            hasAgentServerHealth = available
            if available {
                agentServerErrorMessage = nil
                dynamicToolClient?.connect()
                swiftThreadClient?.connect()
                publishAvailability()
            } else {
                agentServerErrorMessage = message ?? "Electron agent-server 不可用"
                dynamicToolClient?.disconnect()
                swiftThreadClient?.disconnect()
                publishAvailability(force: true)
            }

        case .threadWindowPrepared:
            publishAvailability()

        case .threadWindowPrepareFailed:
            publishAvailability()

        case .threadWindowClosed(_, let wasVisible):
            ThreadWindowDiagnostics.emit("electron.thread_window_closed wasVisible=\(wasVisible)")
            if wasVisible {
                onThreadWindowClosed?()
            }
            publishAvailability()

        case .rendererCrashed(.activity, _):
            break

        case .rendererCrashed(.thread, _):
            publishAvailability()

        case .commandAck(let commandId, let ok, let error):
            handleCommandAck(commandId: commandId, ok: ok, error: error)

        case .electronReady:
            break
        }
    }

    private func handleTermination(_ message: String) {
        guard isRunning else { return }

        if message == "Electron shell exited with status 0" {
            isRunning = false
            hasAgentServerHealth = false
            dynamicToolClient?.disconnect()
            swiftThreadClient?.disconnect()
            pendingSettingsCommands.removeAll()
        pendingCommandKinds.removeAll()
            pendingActivityCommandKinds.removeAll()
            publishAvailability(force: lastPublishedAvailability)
            onHostTerminationRequest?()
            return
        }

        agentServerErrorMessage = message
        hasAgentServerHealth = false
        dynamicToolClient?.disconnect()
        swiftThreadClient?.disconnect()
        pendingSettingsCommands.removeAll()
        pendingCommandKinds.removeAll()
        pendingActivityCommandKinds.removeAll()
        onFatalError?(message)
        publishAvailability(force: true)
    }

    private func resetGate() {
        hasAgentServerHealth = false
        agentServerErrorMessage = nil
        lastPublishedAvailability = false
        isRunning = false
        pendingSettingsCommands.removeAll()
        pendingCommandKinds.removeAll()
        pendingActivityCommandKinds.removeAll()
    }

    private func publishAvailability(force: Bool = false) {
        let available = isAvailable
        guard force || available != lastPublishedAvailability else { return }
        lastPublishedAvailability = available
        onAvailabilityChange?(available)
    }

    @discardableResult
    private func sendThreadWindowCommand(
        _ kind: ThreadWindowCommandKind,
        build: (String) -> ElectronShellCommand
    ) throws -> String {
        let commandId = UUID().uuidString
        pendingCommandKinds[commandId] = kind
        do {
            try shell.send(build(commandId))
            return commandId
        } catch {
            pendingCommandKinds.removeValue(forKey: commandId)
            throw error
        }
    }

    private func handleCommandAck(commandId: String, ok: Bool, error: String?) {
        if pendingSettingsCommands.remove(commandId) != nil {
            if !ok { onSettingsCommandFailure?(error ?? "设置窗口打开失败") }
            return
        }
        if let kind = pendingCommandKinds.removeValue(forKey: commandId) {
            ThreadWindowDiagnostics.emit(
                "electron.command_ack kind=\(String(describing: kind)) ok=\(ok) error=\(error ?? "nil")"
            )
            onCommandResult?(
                ThreadWindowCommandResult(
                    commandId: commandId,
                    kind: kind,
                    ok: ok,
                    error: error
                )
            )
            return
        }

        if let kind = pendingActivityCommandKinds.removeValue(forKey: commandId) {
            onActivityWindowCommandResult?(
                ActivityWindowCommandResult(
                    commandId: commandId,
                    kind: kind,
                    ok: ok,
                    error: error
                )
            )
            return
        }

        return
    }
}
