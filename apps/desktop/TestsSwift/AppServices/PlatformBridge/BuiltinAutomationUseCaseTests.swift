import XCTest
import HandAgentHostAutomation
@testable import HandAgentDesktop

@MainActor
final class BuiltinAutomationUseCaseTests: XCTestCase {
    func testRecordingSurvivesToolCallsAndSavedPolicyRunsAfterRebuildingModules() async throws {
        let fixture = try AutomationUseCaseFixture()
        defer { fixture.cleanup() }
        XCTAssertFalse(fixture.settings.settings.automationEnabled)
        XCTAssertFalse(fixture.toolNames.contains("automation.record_start"))
        fixture.settings.update { $0.automationEnabled = true }
        XCTAssertTrue(fixture.toolNames.contains("automation.record_start"))

        let started = try await fixture.call("record_start", ["targetBundleId": "test.editor"])
        let recordingId = try XCTUnwrap(started.value["recordingId"] as? String)
        fixture.host.value = "recorded text"
        _ = try await fixture.call("record_event", [
            "recordingId": recordingId,
            "event": [
                "kind": "setValue",
                "selector": ["role": "AXTextField"],
                "value": "recorded text",
            ],
        ])
        _ = try await fixture.call("record_event", [
            "recordingId": recordingId,
            "event": ["kind": "assertion", "selector": ["title": "Done"]],
        ])
        let stopped = try await fixture.call("record_stop", ["recordingId": recordingId])
        XCTAssertEqual(stopped.value["eventCount"] as? Int, 2)
        let traceId = try XCTUnwrap(stopped.value["traceId"] as? String)
        let trace = try fixture.store.loadTrace(id: traceId)
        XCTAssertEqual((trace["events"] as? [[String: Any]])?.count, 2)
        XCTAssertNotNil(trace["initialEvidence"])
        XCTAssertNotNil(trace["finalEvidence"])
        _ = try await fixture.call("policy_create", [
            "policyId": "recorded-policy", "title": "受控输入", "traceId": traceId,
        ])

        fixture.features.stop()
        fixture.host.value = ""
        let restored = fixture.rebuild()
        defer { restored.features.stop() }
        XCTAssertTrue(restored.settings.settings.automationEnabled)
        let result = try await restored.call("run", ["policyId": "recorded-policy"])
        XCTAssertTrue(result.success)
        let run = try XCTUnwrap(result.value["run"] as? [String: Any])
        XCTAssertEqual(run["status"] as? String, "completed")
        let evidence = try XCTUnwrap(run["evidence"] as? [String: Any])
        let screenshot = try XCTUnwrap(evidence["screenshot"] as? [String: Any])
        let imageIndex = try XCTUnwrap(screenshot["imageContentIndex"] as? Int)
        XCTAssertEqual(result.items[imageIndex]["type"] as? String, "inputImage")
        XCTAssertTrue((result.items[imageIndex]["imageUrl"] as? String)?.hasPrefix("data:image/png;base64,") == true)
        XCTAssertNil(screenshot["imageBase64"])
        XCTAssertEqual(fixture.host.value, "recorded text")
        XCTAssertEqual(fixture.host.activatedBundleIds.last, "test.editor")
        let history = try await restored.call("history")
        let runs = try XCTUnwrap(history.value["runs"] as? [[String: Any]])
        XCTAssertEqual(runs.count, 1)
        XCTAssertEqual(runs.first?["id"] as? String, run["id"] as? String)
        XCTAssertEqual(try restored.store.loadPolicy(id: "recorded-policy").version, 1)
    }

    func testFailedRunKeepsProgressAndRepairOnlySucceedsAfterAnActualRerun() async throws {
        let fixture = try AutomationUseCaseFixture()
        defer { fixture.cleanup() }
        fixture.settings.update { $0.automationEnabled = true }
        _ = try await fixture.call("policy_create", ["policy": [
            "id": "repair-policy", "version": 1, "title": "需要修复的流程",
            "targetBundleId": "test.editor",
            "branches": [[
                "id": "original",
                "conditions": [["selector": ["role": "AXTextField"]]],
                "steps": [
                    ["kind": "activateApp", "bundleId": "test.editor"],
                    ["kind": "setValue", "selector": ["role": "AXTextField"], "value": "reject"],
                ],
                "assertions": [["selector": ["title": "Done"]]],
            ]],
        ]])
        fixture.host.rejectedValue = "reject"
        let failed = try await fixture.call("run", ["policyId": "repair-policy"], expectSuccess: false)
        let failedRun = try XCTUnwrap(failed.value["run"] as? [String: Any])
        XCTAssertEqual(failedRun["status"] as? String, "failed")
        XCTAssertEqual((failedRun["steps"] as? [[String: Any]])?.filter { $0["status"] as? String == "completed" }.count, 1)
        XCTAssertTrue((failedRun["failureReason"] as? String)?.contains("controlled action failure") == true)
        XCTAssertNotNil(failedRun["evidence"])
        XCTAssertEqual(failed.items.filter { $0["type"] as? String == "inputImage" }.count, 1)
        XCTAssertEqual(try fixture.store.loadPolicy(id: "repair-policy").version, 1)

        let failedHistory = try await fixture.call("history")
        let requests = try XCTUnwrap(failedHistory.value["repairRequests"] as? [[String: Any]])
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request["status"] as? String, "pending")
        let repairId = try XCTUnwrap(request["id"] as? String)
        let fixedBranch: [String: Any] = [
            "id": "corrected", "conditions": [],
            "steps": [["kind": "setValue", "selector": ["role": "AXTextField"], "value": "recovered"]],
            "assertions": [["selector": ["title": "Done"]]],
        ]
        _ = try await fixture.call("repair_apply", [
            "repairRequestId": repairId, "branch": fixedBranch, "evidence": ["source": "controlled repair"],
        ])
        XCTAssertEqual(fixture.host.value, "")
        let beforeRerun = try await fixture.call("history")
        let existingRuns = try XCTUnwrap(beforeRerun.value["runs"] as? [[String: Any]])
        XCTAssertEqual(existingRuns.count, 1)
        XCTAssertEqual(existingRuns.first?["status"] as? String, "failed")
        XCTAssertEqual(try fixture.store.loadPolicy(id: "repair-policy").version, 2)

        let rerun = try await fixture.call("run", ["policyId": "repair-policy"])
        XCTAssertTrue(rerun.success)
        XCTAssertEqual((rerun.value["run"] as? [String: Any])?["status"] as? String, "completed")
        XCTAssertEqual((rerun.value["run"] as? [String: Any])?["branchId"] as? String, "corrected")
        XCTAssertEqual(fixture.host.value, "recovered")
        XCTAssertEqual(try fixture.store.listRuns().count, 2)
    }

    func testAssertionFailureIsRecordedAndUnavailableLiveRecordingIsAnError() async throws {
        let fixture = try AutomationUseCaseFixture()
        defer { fixture.cleanup() }
        fixture.settings.update { $0.automationEnabled = true }
        _ = try await fixture.call("policy_create", [
            "policyId": "assertion-policy", "title": "断言校验",
            "branch": [
                "id": "assertion",
                "steps": [["kind": "activateApp", "bundleId": "test.editor"]],
                "assertions": [["selector": ["title": "Done"]]],
            ],
        ])
        let result = try await fixture.call("run", ["policyId": "assertion-policy"], expectSuccess: false)
        XCTAssertEqual((result.value["run"] as? [String: Any])?["status"] as? String, "failed")
        XCTAssertTrue(((result.value["run"] as? [String: Any])?["failureReason"] as? String)?.contains("assertion") == true)
        fixture.liveRecorder.startError = AutomationUseCaseError.permissionDenied
        let denied = try await fixture.call("record_start", ["captureUserEvents": true], expectSuccess: false)
        XCTAssertTrue(denied.text.contains("permission"))
        XCTAssertTrue(fixture.liveRecorder.recordingIds.isEmpty)
    }

    func testDisableCancelsTheCurrentRunAndRestartWaitsForItsSystemActionToFinish() async throws {
        let fixture = try AutomationUseCaseFixture()
        defer { fixture.cleanup() }
        fixture.settings.update { $0.automationEnabled = true }
        _ = try await fixture.call("policy_create", [
            "policyId": "cancel-policy",
            "branch": ["id": "main", "steps": [["kind": "typeText", "value": "controlled"]], "assertions": []],
        ])
        let entered = expectation(description: "system action started")
        fixture.host.onActionStarted = { entered.fulfill() }
        fixture.host.suspendAction = true
        let pending = Task { @MainActor in
            let result = try await fixture.call("run", ["policyId": "cancel-policy"], expectSuccess: false)
            return (result.value["run"] as? [String: Any])?["status"] as? String
        }
        await fulfillment(of: [entered], timeout: 2)
        fixture.settings.update { $0.automationEnabled = false }
        fixture.settings.update { $0.automationEnabled = true }
        let busy = try await fixture.call("history", expectSuccess: false)
        XCTAssertTrue(busy.text.contains("busy"))
        fixture.host.releaseAction()
        let cancelled = try await pending.value
        XCTAssertEqual(cancelled, "cancelled")
        XCTAssertEqual(try fixture.store.listRuns().first?.status, "cancelled")
        XCTAssertTrue(try fixture.store.listRepairRequests().isEmpty)
        _ = try await fixture.call("history")
    }

    func testFailedSettingsWriteRetainsDisabledFeatureAndCanBeRetried() throws {
        let fixture = try AutomationUseCaseFixture()
        defer { fixture.cleanup() }
        let dataDirectory = fixture.home.appendingPathComponent(".spotAgent")
        try Data("blocks directory creation".utf8).write(to: dataDirectory)
        fixture.settings.update { $0.automationEnabled = true }
        XCTAssertFalse(fixture.settings.settings.automationEnabled)
        XCTAssertNotNil(fixture.settings.errorMessage)
        XCTAssertFalse(fixture.toolNames.contains("automation.run"))
        try FileManager.default.removeItem(at: dataDirectory)
        fixture.settings.update { $0.automationEnabled = true }
        XCTAssertTrue(fixture.settings.settings.automationEnabled)
        XCTAssertNil(fixture.settings.errorMessage)
        XCTAssertTrue(fixture.toolNames.contains("automation.run"))
        XCTAssertTrue(BuiltinFeatureSettingsStore(homeDirectoryURL: fixture.home).settings.automationEnabled)
    }

    func testDisablingAutomationStopsTheSameLiveRecordingAndPersistsTheChoice() async throws {
        let fixture = try AutomationUseCaseFixture()
        defer { fixture.cleanup() }
        fixture.settings.update { $0.automationEnabled = true }
        let recording = try await fixture.call("record_start", ["captureUserEvents": true])
        let id = try XCTUnwrap(recording.value["recordingId"] as? String)
        XCTAssertEqual(fixture.liveRecorder.recordingIds, [id])
        fixture.settings.update { $0.automationEnabled = false }
        XCTAssertTrue(fixture.liveRecorder.recordingIds.isEmpty)
        XCTAssertEqual(fixture.liveRecorder.stoppedIds, [id])
        XCTAssertFalse(fixture.toolNames.contains("automation.record_start"))
        let restoredSettings = BuiltinFeatureSettingsStore(homeDirectoryURL: fixture.home)
        XCTAssertFalse(restoredSettings.settings.automationEnabled)
    }

    func testRecordedWaitParametersFailClearlyAndValidBoundariesRemainUsable() async throws {
        let fixture = try AutomationUseCaseFixture()
        defer { fixture.cleanup() }
        fixture.settings.update { $0.automationEnabled = true }
        let invalidTimeouts: [Any] = [1e100, -1, 300_001, 1.5, true, "25", NSNull()]
        for timeout in invalidTimeouts {
            let result = try await fixture.call("record_stop", [
                "traceId": "invalid-wait",
                "events": [["kind": "waitFor", "selector": ["role": "AXButton"], "timeoutMs": timeout, "timeout": 20]],
            ], expectSuccess: false)
            XCTAssertTrue(result.text.contains("timeout"), result.text)
        }
        for timeout in [0, 300_000] {
            let traceId = "valid-wait-\(timeout)"
            _ = try await fixture.call("record_stop", [
                "traceId": traceId,
                "events": [["kind": "waitFor", "selector": ["role": "AXButton"], "timeoutMs": timeout]],
            ])
            _ = try await fixture.call("policy_create", ["policyId": traceId, "traceId": traceId])
            XCTAssertEqual(try fixture.store.loadPolicy(id: traceId).branches.first?.steps.first?.timeoutMs, timeout)
        }
    }

    func testRepairRejectsVersionOverflowBeforeChangingSavedPolicyOrRepairState() async throws {
        let fixture = try AutomationUseCaseFixture()
        defer { fixture.cleanup() }
        fixture.settings.update { $0.automationEnabled = true }
        _ = try await fixture.call("policy_create", ["policy": [
            "id": "maximum-version", "version": Int.max, "title": "版本上界",
            "branches": [["id": "main", "steps": [], "assertions": [["selector": ["title": "Missing"]]]]],
        ]])
        _ = try await fixture.call("run", ["policyId": "maximum-version"], expectSuccess: false)
        let request = try XCTUnwrap(fixture.store.listRepairRequests().first)
        let requestId = try XCTUnwrap(request["id"] as? String)
        let result = try await fixture.call("repair_apply", [
            "repairRequestId": requestId, "patchId": "overflow-patch",
            "branch": ["id": "main", "steps": [["kind": "typeText", "value": "fixed"]], "assertions": []],
        ], expectSuccess: false)
        XCTAssertTrue(result.text.contains("version"), result.text)
        XCTAssertEqual(try fixture.store.loadPolicy(id: "maximum-version").version, Int.max)
        XCTAssertTrue(try fixture.store.listPatches().isEmpty)
        XCTAssertEqual(try fixture.store.loadRepairRequest(id: requestId)["status"] as? String, "pending")
        XCTAssertEqual(try fixture.store.listRuns().first?.status, "failed")
        XCTAssertEqual(fixture.host.value, "")
    }

    func testLiveTraceSharesOneStopEvidenceAcrossAllEvents() async throws {
        let fixture = try AutomationUseCaseFixture()
        defer { fixture.cleanup() }
        fixture.settings.update { $0.automationEnabled = true }
        fixture.liveRecorder.events = (0..<250).map { index in
            ["kind": "typeText", "text": "a", "source": "macos_event_tap", "timestamp": "event-\(index)"]
        }
        _ = try await fixture.call("record_start", ["recordingId": "shared-evidence", "captureUserEvents": true])
        _ = try await fixture.call("record_stop", ["recordingId": "shared-evidence"])
        let trace = try fixture.store.loadTrace(id: "shared-evidence")
        let events = try XCTUnwrap(trace["events"] as? [[String: Any]])
        XCTAssertEqual(events.count, 250)
        XCTAssertEqual(fixture.host.screenshotCaptureCount, 2)
        for (index, event) in events.enumerated() {
            XCTAssertEqual(event["timestamp"] as? String, "event-\(index)")
            XCTAssertEqual(event["evidenceTiming"] as? String, "recording_stop")
            let reference = try XCTUnwrap(event["evidenceRef"] as? String)
            let evidence = try XCTUnwrap(trace[reference] as? [String: Any])
            XCTAssertEqual(event["evidenceCapturedAt"] as? String, evidence["capturedAt"] as? String)
            XCTAssertNotNil((evidence["screenshot"] as? [String: Any])?["imageBase64"])
            XCTAssertNotNil(evidence["axSnapshot"])
        }
        let traceFile = fixture.home.appendingPathComponent(".spotAgent/automation/traces/shared-evidence/trace.json")
        let persisted = try String(contentsOf: traceFile, encoding: .utf8)
        XCTAssertEqual(persisted.components(separatedBy: "\"imageBase64\"").count - 1, 2)
    }
}

@MainActor
final class AutomationUseCaseFixture {
    let home: URL
    let host: AutomationUseCaseHost
    let liveRecorder: AutomationUseCaseLiveRecorder
    let settings: BuiltinFeatureSettingsStore
    let store: AutomationStore
    let features: BuiltinFeatures
    let service: DynamicToolProviderService

    init(home: URL? = nil, host: AutomationUseCaseHost? = nil) throws {
        self.home = home ?? FileManager.default.temporaryDirectory.appendingPathComponent("issue4-automation-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: self.home, withIntermediateDirectories: true)
        self.host = host ?? AutomationUseCaseHost()
        self.liveRecorder = AutomationUseCaseLiveRecorder()
        self.settings = BuiltinFeatureSettingsStore(homeDirectoryURL: self.home)
        self.store = AutomationStore(directoryURL: self.home.appendingPathComponent(".spotAgent/automation"))
        self.features = BuiltinFeatures(
            settingsStore: settings,
            contextHistory: ContextHistoryModule(
                store: ContextHistoryStore(directoryURL: self.home.appendingPathComponent(".spotAgent/context-history")),
                host: self.host
            ),
            automation: AutomationModule(store: store, host: self.host, liveRecorder: liveRecorder)
        )
        self.service = DynamicToolProviderService(provider: self.host, builtinFeatures: features)
        features.start()
    }

    var toolNames: Set<String> {
        Set(service.dynamicToolSpecs.map { "\($0["namespace"] as? String ?? "").\($0["name"] as? String ?? "")" })
    }

    func rebuild() -> AutomationUseCaseFixture {
        try! AutomationUseCaseFixture(home: home, host: host)
    }

    func cleanup() {
        features.stop()
        try? FileManager.default.removeItem(at: home)
    }

    func call(_ tool: String, _ arguments: [String: Any] = [:], expectSuccess: Bool = true) async throws -> (
        success: Bool, value: [String: Any], text: String, items: [[String: Any]]
    ) {
        let callId = UUID().uuidString
        let data = try JSONSerialization.data(withJSONObject: [
            "channel": "dynamic_tools", "type": "tool_call_request",
            "payload": [
                "clientId": "swift-host", "threadId": "test-thread", "turnId": "test-turn",
                "callId": callId, "namespace": "automation", "tool": tool, "arguments": arguments,
            ],
        ])
        var responses: [[String: Any]] = []
        await service.handleIncoming(raw: String(decoding: data, as: UTF8.self)) { raw in
            responses.append((try? JSONSerialization.jsonObject(with: Data(raw.utf8))) as? [String: Any] ?? [:])
        }
        XCTAssertEqual(responses.count, 1)
        let payload = try XCTUnwrap(responses.first?["payload"] as? [String: Any])
        XCTAssertEqual(payload["callId"] as? String, callId)
        let success = try XCTUnwrap(payload["success"] as? Bool)
        let items = try XCTUnwrap(payload["contentItems"] as? [[String: Any]])
        let text = items.compactMap { $0["text"] as? String }.joined(separator: "\n")
        XCTAssertEqual(success, expectSuccess, text)
        let value = (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String: Any] ?? [:]
        return (success, value, text, items)
    }
}

private enum AutomationUseCaseError: LocalizedError {
    case actionFailed
    case permissionDenied
    var errorDescription: String? {
        switch self {
        case .actionFailed: "controlled action failure"
        case .permissionDenied: "permission_denied: event recording permission is unavailable"
        }
    }
}

@MainActor
final class AutomationUseCaseHost: HostAutomationCapabilities, PlatformProvider {
    var value = ""
    var rejectedValue: String?
    var activatedBundleIds: [String] = []
    var screenshotCaptureCount = 0
    var suspendAction = false
    var onActionStarted: (() -> Void)?
    private var actionContinuation: CheckedContinuation<Void, Never>?
    func releaseAction() {
        suspendAction = false
        actionContinuation?.resume()
        actionContinuation = nil
    }
    func frontmostAppWindow() async throws -> [String: Any] {
        ["app": ["bundleId": "test.editor", "pid": 42], "window": ["id": 7, "title": "受控窗口"]]
    }
    func accessibilitySnapshot() async throws -> [String: Any] {
        ["root": ["role": "AXApplication", "children": [
            ["role": "AXTextField", "title": value.isEmpty ? "Input" : "Done", "value": value],
        ]]]
    }
    func captureScreenshot() async throws -> [String: Any] {
        screenshotCaptureCount += 1
        let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="
        return ["imageBase64": png, "thumbnailBase64": png, "mimeType": "image/png", "width": 1, "height": 1]
    }
    func activateApp(bundleId: String?) async throws {
        activatedBundleIds.append(bundleId ?? "")
    }
    func performAction(_ arguments: [String: Any]) async throws {
        if suspendAction {
            await withCheckedContinuation { continuation in
                actionContinuation = continuation
                onActionStarted?()
            }
        }
        try Task.checkCancellation()
        let nextValue = arguments["value"] as? String ?? arguments["text"] as? String ?? ""
        if nextValue == rejectedValue { throw AutomationUseCaseError.actionFailed }
        value = nextValue
    }
    func handle(method: String, args: Any?) async throws -> Any? { [:] as [String: Any] }
}

@MainActor
final class AutomationUseCaseLiveRecorder: AutomationLiveEventRecording {
    var recordingIds: Set<String> = []
    var stoppedIds: [String] = []
    var startError: Error?
    var events: [[String: Any]] = []
    var onStop: (() -> Void)?
    func start(recordingId: String) throws {
        if let startError { throw startError }
        recordingIds.insert(recordingId)
    }
    func stop(recordingId: String) throws -> [[String: Any]] {
        recordingIds.remove(recordingId)
        stoppedIds.append(recordingId)
        onStop?()
        return events
    }
}
