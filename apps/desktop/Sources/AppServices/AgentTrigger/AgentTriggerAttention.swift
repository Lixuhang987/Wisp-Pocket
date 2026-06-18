import Foundation

struct AgentTriggerAttention: Equatable {
    let threadId: String
    let triggerInstanceId: String
    let reason: AgentTriggerAttentionReason
    let message: String
}

enum AgentTriggerAttentionReason: String, Equatable {
    case permission
    case workspace
    case failure
}

@MainActor
protocol AgentTriggerAttentionSink: AnyObject {
    func handle(_ attention: AgentTriggerAttention)
}
