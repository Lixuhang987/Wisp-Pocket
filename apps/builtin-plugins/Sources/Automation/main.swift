import Foundation
import HandAgentPluginSupport

let directory = ProcessInfo.processInfo.environment["HANDAGENT_AUTOMATION_DIR"]
    .map { URL(fileURLWithPath: $0, isDirectory: true) }
    ?? FileManager.default
    .homeDirectoryForCurrentUser
    .appendingPathComponent(".spotAgent/automation", isDirectory: true)

final class PolicyPatchAutomationRepairer: AutomationRepairing {
    func repair(request: AutomationRepairRequest) async throws -> AutomationRepairResult {
        AutomationRepairResult(
            branch: AutomationBranch(
                id: "\(request.policy.id):repair:\(UUID().uuidString)",
                steps: [request.failedStep],
                assertions: []
            ),
            evidence: [
                "repair": "fallback-policy-branch",
                "failureReason": request.failureReason,
            ]
        )
    }
}

let store = AutomationStore(directoryURL: directory)
let runtime = AutomationRuntime(
    store: store,
    capabilityClient: LocalManifestPluginPeerClient(),
    repairer: PolicyPatchAutomationRepairer()
)
let router = AutomationToolRouter(store: store, runtime: runtime)

runLineDelimitedPluginServer { namespace, tool, arguments in
    await router.handle(namespace: namespace, tool: tool, arguments: arguments)
}
