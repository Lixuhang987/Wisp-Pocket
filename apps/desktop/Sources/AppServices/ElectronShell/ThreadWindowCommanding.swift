import Foundation

enum ThreadWindowCommandKind: Equatable {
    case openInitialPrompt
    case openHistory
    case focus
}

enum AgentTriggerCommandKind: Equatable {
    case fire
}

struct AgentTriggerAttentionResult: Equatable {
    let threadId: String
    let triggerInstanceId: String
    let reason: AgentTriggerAttentionReason
    let message: String
}

struct ThreadWindowCommandResult: Equatable {
    let commandId: String
    let kind: ThreadWindowCommandKind
    let ok: Bool
    let error: String?
}

@MainActor
protocol ThreadWindowCommanding: AnyObject {
    var onThreadWindowClosed: (() -> Void)? { get set }
    var onCommandResult: ((ThreadWindowCommandResult) -> Void)? { get set }

    @discardableResult
    func openInitialPrompt(_ prompt: PromptSubmission) throws -> String

    @discardableResult
    func openHistory() throws -> String

    @discardableResult
    func focus(threadId: String?) throws -> String

    @discardableResult
    func sendThemeChanged(_ theme: HostThemePayload) throws -> String
}

@MainActor
protocol AgentTriggerCommanding: AnyObject {
    var onAgentTriggerCommandResult: ((AgentTriggerCommandResult) -> Void)? { get set }
    var onAgentTriggerAttention: ((AgentTriggerAttentionResult) -> Void)? { get set }

    @discardableResult
    func fireAgentTrigger(_ payload: ElectronAgentTriggerFirePayload) throws -> String
}

struct AgentTriggerCommandResult: Equatable {
    let commandId: String
    let kind: AgentTriggerCommandKind
    let ok: Bool
    let error: String?
}
