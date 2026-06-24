import Foundation
import HandAgentPluginSupport

let directory = ProcessInfo.processInfo.environment["HANDAGENT_AUTOMATION_DIR"]
    .map { URL(fileURLWithPath: $0, isDirectory: true) }
    ?? FileManager.default
    .homeDirectoryForCurrentUser
    .appendingPathComponent(".spotAgent/automation", isDirectory: true)

final class PolicyPatchAutomationRepairer: AutomationRepairing {
    private let requestStore: AutomationRepairRequestStore

    init(requestStore: AutomationRepairRequestStore) {
        self.requestStore = requestStore
    }

    func repair(request: AutomationRepairRequest) async throws -> AutomationRepairResult {
        var evidence = try requestStore.saveRepairRequest(request)
        evidence["fallback"] = "policy-branch"
        return AutomationRepairResult(
            branch: AutomationBranch(
                id: "\(request.policy.id):repair:\(UUID().uuidString)",
                steps: [request.failedStep],
                assertions: []
            ),
            evidence: evidence
        )
    }
}

let store = AutomationStore(directoryURL: directory)
let capabilityClient = LocalManifestPluginPeerClient()
let runtime = AutomationRuntime(
    store: store,
    capabilityClient: capabilityClient,
    repairer: PolicyPatchAutomationRepairer(requestStore: AutomationRepairRequestStore(store: store))
)
let router = AutomationToolRouter(
    store: store,
    runtime: runtime,
    recorder: AutomationRecordingService(capabilityClient: capabilityClient)
)

runLineDelimitedPluginServer { namespace, tool, arguments in
    await router.handle(namespace: namespace, tool: tool, arguments: arguments)
}
