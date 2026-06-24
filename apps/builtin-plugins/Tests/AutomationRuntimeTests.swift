import XCTest
@testable import HandAgentPluginSupport

final class AutomationRuntimeTests: XCTestCase {
    func testRuntimeExecutesPolicyWithAXActionsAndAssertions() async throws {
        let directory = makeDirectory()
        let store = AutomationStore(directoryURL: directory)
        let capabilityClient = RecordingAutomationCapabilityClient()
        let repairer = RecordingAutomationRepairer()
        let runtime = AutomationRuntime(store: store, capabilityClient: capabilityClient, repairer: repairer)
        let policy = AutomationPolicy(
            id: "policy-1",
            title: "Save Form",
            targetBundleId: "com.example.app",
            branches: [
                AutomationBranch(
                    id: "main",
                    steps: [
                        AutomationStep(kind: .activateApp, bundleId: "com.example.app"),
                        AutomationStep(kind: .click, selector: AXSelector(role: "AXButton", title: "Save")),
                        AutomationStep(kind: .setValue, selector: AXSelector(role: "AXTextField"), value: "hello"),
                        AutomationStep(kind: .typeText, selector: AXSelector(role: "AXTextField"), value: "hello"),
                        AutomationStep(kind: .hotkey, value: "command+s"),
                        AutomationStep(
                            kind: .waitFor,
                            condition: AutomationCondition(selector: AXSelector(role: "AXStaticText", title: "Saved")),
                            timeoutMs: 100
                        ),
                    ],
                    assertions: [AutomationAssertion(selector: AXSelector(role: "AXStaticText", title: "Saved"))]
                ),
            ]
        )
        try store.savePolicy(policy)

        let run = try await runtime.run(policyId: "policy-1")

        XCTAssertEqual(run.status, "completed")
        XCTAssertEqual(run.steps.map(\.kind), [.activateApp, .click, .setValue, .typeText, .hotkey, .waitFor])
        XCTAssertEqual(repairer.requests.count, 0)
        XCTAssertEqual(capabilityClient.calls.map { "\($0.namespace).\($0.tool)" }, [
            "app_window.activate",
            "ax.action",
            "ax.action",
            "ax.action",
            "ax.action",
            "ax.snapshot",
            "ax.snapshot",
        ])
        let typeTextArguments = capabilityClient.calls[3].arguments
        XCTAssertEqual(typeTextArguments["action"] as? String, "type_text")
        XCTAssertEqual(typeTextArguments["text"] as? String, "hello")
        let typeTextSelector = try XCTUnwrap(typeTextArguments["selector"] as? [String: Any])
        XCTAssertEqual(typeTextSelector["role"] as? String, "AXTextField")
    }

    func testRuntimeRepairsFailureAndAutomaticallyMergesPolicyPatch() async throws {
        let directory = makeDirectory()
        let store = AutomationStore(directoryURL: directory)
        let capabilityClient = RecordingAutomationCapabilityClient(failAXAction: true)
        let repairer = RecordingAutomationRepairer()
        let runtime = AutomationRuntime(store: store, capabilityClient: capabilityClient, repairer: repairer)
        let policy = AutomationPolicy(
            id: "policy-2",
            title: "Submit Form",
            targetBundleId: "com.example.app",
            branches: [
                AutomationBranch(
                    id: "main",
                    steps: [
                        AutomationStep(kind: .click, selector: AXSelector(role: "AXButton", title: "Submit")),
                    ],
                    assertions: []
                ),
            ]
        )
        try store.savePolicy(policy)

        let run = try await runtime.run(policyId: "policy-2")
        let updatedPolicy = try store.loadPolicy(id: "policy-2")
        let patch = try XCTUnwrap(run.patchId.flatMap { try? store.loadPatch(id: $0) })

        XCTAssertEqual(run.status, "repaired")
        XCTAssertEqual(updatedPolicy.version, 2)
        XCTAssertEqual(updatedPolicy.branches.count, 2)
        XCTAssertEqual(patch.basePolicyVersion, 1)
        XCTAssertEqual(patch.evidence["repair"], "fake-success")
        XCTAssertEqual(repairer.requests.count, 1)
        XCTAssertEqual(repairer.requests[0].failedStep.kind, .click)
    }

    func testAutomationToolRouterRecordsTraceCreatesPolicyAndListsHistory() async throws {
        let directory = makeDirectory()
        let store = AutomationStore(directoryURL: directory)
        let runtime = AutomationRuntime(
            store: store,
            capabilityClient: RecordingAutomationCapabilityClient(),
            repairer: RecordingAutomationRepairer()
        )
        let router = AutomationToolRouter(store: store, runtime: runtime)

        let start = decodeToolJSON(await router.handle(namespace: "automation", tool: "record_start", arguments: [:]))
        let recordingId = try XCTUnwrap(start["recordingId"] as? String)
        XCTAssertFalse(recordingId.isEmpty)

        let stop = decodeToolJSON(await router.handle(
            namespace: "automation",
            tool: "record_stop",
            arguments: [
                "traceId": "trace-1",
                "targetBundleId": "com.example.app",
                "events": [
                    [
                        "kind": "click",
                        "selector": ["role": "AXButton", "title": "Save"],
                    ],
                    [
                        "kind": "setValue",
                        "selector": ["role": "AXTextField"],
                        "value": "hello",
                    ],
                    [
                        "kind": "typeText",
                        "selector": ["role": "AXTextField"],
                        "text": "typed",
                    ],
                    [
                        "kind": "hotkey",
                        "keys": ["command", "s"],
                    ],
                    [
                        "kind": "waitFor",
                        "selector": ["role": "AXStaticText", "title": "Saved"],
                        "timeoutMs": 500,
                    ],
                    [
                        "kind": "assertion",
                        "selector": ["role": "AXStaticText", "title": "Saved"],
                    ],
                ],
            ]
        ))
        XCTAssertEqual(stop["traceId"] as? String, "trace-1")

        let create = decodeToolJSON(await router.handle(
            namespace: "automation",
            tool: "policy_create",
            arguments: ["traceId": "trace-1", "policyId": "policy-from-trace", "title": "Recorded"]
        ))
        let policy = try XCTUnwrap(create["policy"] as? [String: Any])
        XCTAssertEqual(policy["id"] as? String, "policy-from-trace")
        XCTAssertEqual(policy["targetBundleId"] as? String, "com.example.app")
        let branches = try XCTUnwrap(policy["branches"] as? [[String: Any]])
        let steps = try XCTUnwrap(branches[0]["steps"] as? [[String: Any]])
        let assertions = try XCTUnwrap(branches[0]["assertions"] as? [[String: Any]])
        XCTAssertEqual(steps.map { $0["kind"] as? String }, [
            "activateApp",
            "click",
            "setValue",
            "typeText",
            "hotkey",
            "waitFor",
        ])
        XCTAssertEqual(steps[3]["value"] as? String, "typed")
        XCTAssertEqual(steps[4]["value"] as? String, "command+s")
        XCTAssertEqual(steps[5]["timeoutMs"] as? Int, 500)
        XCTAssertEqual(assertions.count, 1)

        let history = decodeToolJSON(await router.handle(namespace: "automation", tool: "history", arguments: [:]))
        XCTAssertNotNil(history["runs"] as? [[String: Any]])
        XCTAssertNotNil(history["patches"] as? [[String: Any]])
    }

    private func makeDirectory() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("automation-runtime-tests-\(UUID().uuidString)", isDirectory: true)
    }

    private func decodeToolJSON(_ result: PluginToolResult) -> [String: Any] {
        guard let text = result.contentItems.first?["text"] as? String,
              let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            XCTFail("Expected JSON tool result")
            return [:]
        }
        return object
    }
}

private final class RecordingAutomationCapabilityClient: AutomationCapabilityCalling {
    struct Call {
        let namespace: String
        let tool: String
        let arguments: [String: Any]
    }

    private(set) var calls: [Call] = []
    let failAXAction: Bool

    init(failAXAction: Bool = false) {
        self.failAXAction = failAXAction
    }

    func call(namespace: String, tool: String, arguments: [String: Any]) async throws -> [String: Any] {
        calls.append(Call(namespace: namespace, tool: tool, arguments: arguments))
        if namespace == "ax", tool == "action", failAXAction {
            throw NSError(domain: "RecordingAutomationCapabilityClient", code: 1)
        }
        if namespace == "ax", tool == "snapshot" {
            return [
                "root": [
                    "role": "AXWindow",
                    "children": [
                        ["role": "AXStaticText", "title": "Saved"],
                    ],
                ],
            ]
        }
        if namespace == "screenshot", tool == "capture" {
            return ["imageBase64": "repair-shot"]
        }
        return ["ok": true]
    }
}

private final class RecordingAutomationRepairer: AutomationRepairing {
    private(set) var requests: [AutomationRepairRequest] = []

    func repair(request: AutomationRepairRequest) async throws -> AutomationRepairResult {
        requests.append(request)
        return AutomationRepairResult(
            branch: AutomationBranch(
                id: "\(request.policy.id):repair",
                steps: [
                    AutomationStep(kind: .click, selector: AXSelector(role: "AXButton", title: "Submit Now")),
                ],
                assertions: []
            ),
            evidence: ["repair": "fake-success"]
        )
    }
}
