import Foundation
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

    func testRuntimeUsesJSONSerializableArgumentsForOptionalStepValues() async throws {
        let directory = makeDirectory()
        let store = AutomationStore(directoryURL: directory)
        let capabilityClient = RecordingAutomationCapabilityClient()
        let runtime = AutomationRuntime(
            store: store,
            capabilityClient: capabilityClient,
            repairer: RecordingAutomationRepairer()
        )
        let policy = AutomationPolicy(
            id: "policy-json-args",
            title: "Optional Values",
            targetBundleId: nil,
            branches: [
                AutomationBranch(
                    id: "main",
                    steps: [
                        AutomationStep(kind: .activateApp),
                        AutomationStep(kind: .setValue, selector: AXSelector(role: "AXTextField")),
                        AutomationStep(kind: .typeText, selector: AXSelector(role: "AXTextField")),
                        AutomationStep(kind: .hotkey),
                    ],
                    assertions: []
                ),
            ]
        )
        try store.savePolicy(policy)

        let run = try await runtime.run(policyId: "policy-json-args")

        XCTAssertEqual(run.status, "completed")
        for call in capabilityClient.calls {
            XCTAssertTrue(JSONSerialization.isValidJSONObject(["arguments": call.arguments]))
        }
    }

    func testRuntimeRepairsFailureAndAutomaticallyMergesPolicyPatch() async throws {
        let directory = makeDirectory()
        let store = AutomationStore(directoryURL: directory)
        let capabilityClient = RecordingAutomationCapabilityClient(failAXAction: true)
        let repairer = PersistingAutomationRepairer(store: store)
        let runtime = AutomationRuntime(store: store, capabilityClient: capabilityClient, repairer: repairer)
        let policy = AutomationPolicy(
            id: "policy-2",
            title: "Submit Form",
            targetBundleId: nil,
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
        XCTAssertEqual(patch.evidence["repair"], "agent-computer-use-request")
        XCTAssertEqual(patch.evidence["route"], "agent_computer_use")
        let repairRequestId = try XCTUnwrap(patch.evidence["repairRequestId"])
        let repairRequest = try store.loadRepairRequest(id: repairRequestId)
        XCTAssertEqual(repairRequest["policyId"] as? String, "policy-2")
        XCTAssertEqual(repairRequest["route"] as? String, "agent_computer_use")
        XCTAssertEqual(repairRequest["runId"] as? String, run.id)
        XCTAssertEqual(repairRequest["failedStepIndex"] as? Int, 0)
        XCTAssertNotNil(repairRequest["completedSteps"] as? [[String: Any]])
        XCTAssertNil(repairRequest["targetBundleId"])
        XCTAssertNotNil(repairRequest["appWindow"] as? [String: Any])
        XCTAssertNotNil(repairRequest["axSnapshot"] as? [String: Any])
        XCTAssertNotNil(repairRequest["screenshot"] as? [String: Any])
    }

    func testAutomationToolRouterRecordsTraceCreatesPolicyAndListsHistory() async throws {
        let directory = makeDirectory()
        let store = AutomationStore(directoryURL: directory)
        let runtime = AutomationRuntime(
            store: store,
            capabilityClient: RecordingAutomationCapabilityClient(),
            repairer: RecordingAutomationRepairer()
        )
        let router = AutomationToolRouter(
            store: store,
            runtime: runtime,
            recorder: AutomationRecordingService(capabilityClient: RecordingAutomationCapabilityClient())
        )

        let start = decodeToolJSON(await router.handle(
            namespace: "automation",
            tool: "record_start",
            arguments: ["recordingId": "recording-1", "targetBundleId": "com.example.app"]
        ))
        let recordingId = try XCTUnwrap(start["recordingId"] as? String)
        XCTAssertEqual(recordingId, "recording-1")
        XCTAssertNotNil(start["initialEvidence"] as? [String: Any])

        let event = decodeToolJSON(await router.handle(
            namespace: "automation",
            tool: "record_event",
            arguments: [
                "recordingId": "recording-1",
                "event": [
                    "kind": "click",
                    "selector": ["role": "AXButton", "title": "Save"],
                ],
            ]
        ))
        XCTAssertEqual(event["eventIndex"] as? Int, 0)
        let recordedEvent = try XCTUnwrap(event["event"] as? [String: Any])
        XCTAssertNotNil(recordedEvent["before"] as? [String: Any])
        XCTAssertNotNil(recordedEvent["after"] as? [String: Any])

        let stop = decodeToolJSON(await router.handle(
            namespace: "automation",
            tool: "record_stop",
            arguments: [
                "recordingId": "recording-1",
                "traceId": "trace-1",
                "events": [
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
        XCTAssertEqual(stop["eventCount"] as? Int, 6)
        let trace = try store.loadTrace(id: "trace-1")
        XCTAssertNotNil(trace["initialEvidence"] as? [String: Any])
        let traceEvents = try XCTUnwrap(trace["events"] as? [[String: Any]])
        for traceEvent in traceEvents {
            XCTAssertNotNil(traceEvent["before"] as? [String: Any])
            XCTAssertNotNil(traceEvent["after"] as? [String: Any])
        }

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

    func testRecordingWithoutTargetBundleIdStillReturnsJSONAndSavesTrace() async throws {
        let directory = makeDirectory()
        let store = AutomationStore(directoryURL: directory)
        let runtime = AutomationRuntime(
            store: store,
            capabilityClient: RecordingAutomationCapabilityClient(),
            repairer: RecordingAutomationRepairer()
        )
        let router = AutomationToolRouter(
            store: store,
            runtime: runtime,
            recorder: AutomationRecordingService(capabilityClient: RecordingAutomationCapabilityClient())
        )

        let start = decodeToolJSON(await router.handle(
            namespace: "automation",
            tool: "record_start",
            arguments: ["recordingId": "recording-without-target"]
        ))
        XCTAssertEqual(start["recordingId"] as? String, "recording-without-target")
        XCTAssertNil(start["targetBundleId"])

        let stop = decodeToolJSON(await router.handle(
            namespace: "automation",
            tool: "record_stop",
            arguments: ["recordingId": "recording-without-target", "traceId": "trace-without-target"]
        ))
        XCTAssertEqual(stop["traceId"] as? String, "trace-without-target")
        let trace = try store.loadTrace(id: "trace-without-target")
        XCTAssertNil(trace["targetBundleId"])
    }

    func testZRecordEventFailsForUnknownRecordingSession() async throws {
        let directory = makeDirectory()
        let store = AutomationStore(directoryURL: directory)
        let runtime = AutomationRuntime(
            store: store,
            capabilityClient: RecordingAutomationCapabilityClient(),
            repairer: RecordingAutomationRepairer()
        )
        let router = AutomationToolRouter(
            store: store,
            runtime: runtime,
            recorder: AutomationRecordingService(capabilityClient: RecordingAutomationCapabilityClient())
        )

        let result = await router.handle(
            namespace: "automation",
            tool: "record_event",
            arguments: ["recordingId": "missing", "event": ["kind": "click"]]
        )

        XCTAssertFalse(result.success)
        XCTAssertEqual(result.contentItems.first?["text"] as? String, "automation recording session was not found")
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

    private let callsQueue = DispatchQueue(label: "RecordingAutomationCapabilityClient.calls")
    private var recordedCalls: [Call] = []
    let failAXAction: Bool

    var calls: [Call] {
        callsQueue.sync { recordedCalls }
    }

    init(failAXAction: Bool = false) {
        self.failAXAction = failAXAction
    }

    func call(namespace: String, tool: String, arguments: [String: Any]) async throws -> [String: Any] {
        callsQueue.sync {
            recordedCalls.append(Call(namespace: namespace, tool: tool, arguments: arguments))
        }
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

private final class PersistingAutomationRepairer: AutomationRepairing {
    private let requestStore: AutomationRepairRequestStore

    init(store: AutomationStore) {
        self.requestStore = AutomationRepairRequestStore(store: store)
    }

    func repair(request: AutomationRepairRequest) async throws -> AutomationRepairResult {
        let evidence = try requestStore.saveRepairRequest(request)
        return AutomationRepairResult(
            branch: AutomationBranch(
                id: "\(request.policy.id):repair",
                steps: [
                    AutomationStep(kind: .click, selector: AXSelector(role: "AXButton", title: "Submit Now")),
                ],
                assertions: []
            ),
            evidence: evidence
        )
    }
}
