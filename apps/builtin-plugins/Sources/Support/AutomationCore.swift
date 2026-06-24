import Foundation

public struct AXSelector: Codable, Equatable {
    public var role: String?
    public var title: String?

    public init(role: String? = nil, title: String? = nil) {
        self.role = role
        self.title = title
    }
}

public enum AutomationStepKind: String, Codable {
    case activateApp
    case click
    case setValue
    case typeText
    case hotkey
    case waitFor
}

public struct AutomationCondition: Codable, Equatable {
    public var selector: AXSelector

    public init(selector: AXSelector) {
        self.selector = selector
    }
}

public struct AutomationStep: Codable, Equatable {
    public var kind: AutomationStepKind
    public var selector: AXSelector?
    public var value: String?
    public var bundleId: String?
    public var condition: AutomationCondition?
    public var timeoutMs: Int?

    public init(
        kind: AutomationStepKind,
        selector: AXSelector? = nil,
        value: String? = nil,
        bundleId: String? = nil,
        condition: AutomationCondition? = nil,
        timeoutMs: Int? = nil
    ) {
        self.kind = kind
        self.selector = selector
        self.value = value
        self.bundleId = bundleId
        self.condition = condition
        self.timeoutMs = timeoutMs
    }
}

public struct AutomationAssertion: Codable, Equatable {
    public var selector: AXSelector

    public init(selector: AXSelector) {
        self.selector = selector
    }
}

public struct AutomationBranch: Codable, Equatable {
    public var id: String
    public var steps: [AutomationStep]
    public var assertions: [AutomationAssertion]

    public init(id: String, steps: [AutomationStep], assertions: [AutomationAssertion]) {
        self.id = id
        self.steps = steps
        self.assertions = assertions
    }
}

public struct AutomationPolicy: Codable, Equatable {
    public var id: String
    public var version: Int
    public var title: String
    public var targetBundleId: String?
    public var branches: [AutomationBranch]

    public init(
        id: String,
        version: Int = 1,
        title: String,
        targetBundleId: String?,
        branches: [AutomationBranch]
    ) {
        self.id = id
        self.version = version
        self.title = title
        self.targetBundleId = targetBundleId
        self.branches = branches
    }
}

public struct AutomationStepRecord: Codable, Equatable {
    public var stepIndex: Int
    public var kind: AutomationStepKind
    public var status: String
}

public struct AutomationPolicyPatch: Codable, Equatable {
    public var id: String
    public var policyId: String
    public var sourceRunId: String
    public var basePolicyVersion: Int
    public var branch: AutomationBranch
    public var evidence: [String: String]
}

public struct AutomationRunRecord: Codable, Equatable {
    public var id: String
    public var policyId: String
    public var policyVersion: Int
    public var status: String
    public var steps: [AutomationStepRecord]
    public var failureReason: String?
    public var patchId: String?
}

public protocol AutomationCapabilityCalling {
    func call(namespace: String, tool: String, arguments: [String: Any]) async throws -> [String: Any]
}

public struct AutomationRepairRequest {
    public var policy: AutomationPolicy
    public var runId: String
    public var failedStep: AutomationStep
    public var failedStepIndex: Int
    public var completedSteps: [AutomationStepRecord]
    public var failureReason: String
    public var appWindow: [String: Any]
    public var axSnapshot: [String: Any]
    public var screenshot: [String: Any]
}

public struct AutomationRepairResult {
    public var branch: AutomationBranch
    public var evidence: [String: String]

    public init(branch: AutomationBranch, evidence: [String: String]) {
        self.branch = branch
        self.evidence = evidence
    }
}

public protocol AutomationRepairing {
    func repair(request: AutomationRepairRequest) async throws -> AutomationRepairResult
}

public protocol AutomationLiveEventRecording {
    func start(recordingId: String) throws
    func stop(recordingId: String) throws -> [[String: Any]]
}

public final class AutomationRepairRequestStore: @unchecked Sendable {
    private let store: AutomationStore

    public init(store: AutomationStore) {
        self.store = store
    }

    public func saveRepairRequest(_ request: AutomationRepairRequest) throws -> [String: String] {
        let id = UUID().uuidString
        var payload: [String: Any] = [
            "id": id,
            "status": "pending",
            "policyId": request.policy.id,
            "policyVersion": request.policy.version,
            "runId": request.runId,
            "failedStep": try encodeDictionary(request.failedStep),
            "failedStepIndex": request.failedStepIndex,
            "completedSteps": try request.completedSteps.map(encodeDictionary),
            "failureReason": request.failureReason,
            "appWindow": request.appWindow,
            "axSnapshot": request.axSnapshot,
            "screenshot": request.screenshot,
            "createdAt": iso8601(Date()),
            "route": "agent_computer_use",
        ]
        if let targetBundleId = request.policy.targetBundleId {
            payload["targetBundleId"] = targetBundleId
        }
        try store.saveRepairRequest(id: id, payload: payload)
        return [
            "repair": "agent-computer-use-request",
            "repairRequestId": id,
            "route": "agent_computer_use",
            "failureReason": request.failureReason,
        ]
    }

    public func listRepairRequests() throws -> [[String: Any]] {
        try store.listRepairRequests()
    }

    public func markApplied(id: String, patchId: String) throws -> [String: Any] {
        var request = try store.loadRepairRequest(id: id)
        request["status"] = "applied"
        request["patchId"] = patchId
        request["appliedAt"] = iso8601(Date())
        try store.saveRepairRequest(id: id, payload: request)
        return request
    }
}

public final class AutomationRecordingService: @unchecked Sendable {
    private let capabilityClient: AutomationCapabilityCalling
    private let liveRecorder: AutomationLiveEventRecording?
    private var sessions: [String: [String: Any]] = [:]

    public init(capabilityClient: AutomationCapabilityCalling, liveRecorder: AutomationLiveEventRecording? = nil) {
        self.capabilityClient = capabilityClient
        self.liveRecorder = liveRecorder
    }

    public func start(arguments: Any?) async -> [String: Any] {
        let object = dictionaryArgument(arguments)
        let recordingId = stringArgument(arguments, "recordingId", fallback: UUID().uuidString)
        let evidence = await captureEvidence()
        let targetBundleId = stringValue(object["targetBundleId"])
            ?? ((evidence["appWindow"] as? [String: Any])?["app"] as? [String: Any])?["bundleId"] as? String
        var session: [String: Any] = [
            "recordingId": recordingId,
            "startedAt": iso8601(Date()),
            "initialEvidence": evidence,
            "lastEvidence": evidence,
            "events": [],
        ]
        if let targetBundleId {
            session["targetBundleId"] = targetBundleId
        }
        if boolValue(object["captureUserEvents"]) {
            do {
                try liveRecorder?.start(recordingId: recordingId)
                session["liveRecording"] = liveRecorder == nil ? "unavailable" : "running"
            } catch {
                session["liveRecording"] = "unavailable"
                session["liveRecordingError"] = error.localizedDescription
            }
        }
        sessions[recordingId] = session
        var response: [String: Any] = [
            "recordingId": recordingId,
            "status": "recording",
            "initialEvidence": evidence,
        ]
        if let targetBundleId {
            response["targetBundleId"] = targetBundleId
        }
        if let liveRecording = session["liveRecording"] {
            response["liveRecording"] = liveRecording
        }
        if let liveRecordingError = session["liveRecordingError"] {
            response["liveRecordingError"] = liveRecordingError
        }
        return response
    }

    public func recordEvent(arguments: Any?) async throws -> [String: Any] {
        let object = dictionaryArgument(arguments)
        let recordingId = stringArgument(arguments, "recordingId")
        guard var session = sessions[recordingId] else {
            throw AutomationRuntimeError.recordingNotFound
        }
        let event = dictionaryArgument(object["event"]).merging(metadataArguments(from: object)) { current, _ in current }
        let (recorded, after) = await recordedEvent(from: event, previousEvidence: session["lastEvidence"] as? [String: Any] ?? [:])
        var events = session["events"] as? [[String: Any]] ?? []
        events.append(recorded)
        session["events"] = events
        session["lastEvidence"] = after
        sessions[recordingId] = session
        return [
            "recordingId": recordingId,
            "status": "recording",
            "eventIndex": events.count - 1,
            "event": recorded,
        ]
    }

    public func stop(arguments: Any?, store: AutomationStore) async throws -> [String: Any] {
        let object = dictionaryArgument(arguments)
        let recordingId = stringArgument(arguments, "recordingId")
        let traceId = stringArgument(arguments, "traceId", fallback: recordingId.isEmpty ? UUID().uuidString : recordingId)
        guard !recordingId.isEmpty, var session = sessions.removeValue(forKey: recordingId) else {
            try store.saveTrace(id: traceId, payload: object)
            return ["traceId": traceId, "status": "saved"]
        }
        var liveEventCount = 0
        if session["liveRecording"] as? String == "running" {
            do {
                let liveEvents = try liveRecorder?.stop(recordingId: recordingId) ?? []
                liveEventCount = liveEvents.count
                if !liveEvents.isEmpty {
                    var recordedEvents = session["events"] as? [[String: Any]] ?? []
                    var previousEvidence = session["lastEvidence"] as? [String: Any] ?? [:]
                    for event in liveEvents {
                        let (recorded, after) = await recordedEvent(from: event, previousEvidence: previousEvidence)
                        recordedEvents.append(recorded)
                        previousEvidence = after
                    }
                    session["events"] = recordedEvents
                    session["lastEvidence"] = previousEvidence
                }
            } catch {
                session["liveRecordingError"] = error.localizedDescription
            }
        }
        if let events = object["events"] as? [[String: Any]], !events.isEmpty {
            var recordedEvents = session["events"] as? [[String: Any]] ?? []
            var previousEvidence = session["lastEvidence"] as? [String: Any] ?? [:]
            for event in events {
                let (recorded, after) = await recordedEvent(from: event, previousEvidence: previousEvidence)
                recordedEvents.append(recorded)
                previousEvidence = after
            }
            session["events"] = recordedEvents
            session["lastEvidence"] = previousEvidence
        }
        session["traceId"] = traceId
        session["completedAt"] = iso8601(Date())
        session["finalEvidence"] = await captureEvidence()
        try store.saveTrace(id: traceId, payload: session)
        return [
            "traceId": traceId,
            "recordingId": recordingId,
            "status": "saved",
            "eventCount": (session["events"] as? [[String: Any]])?.count ?? 0,
            "liveEventCount": liveEventCount,
        ]
    }

    private func captureEvidence() async -> [String: Any] {
        async let appWindow = optionalCall(namespace: "app_window", tool: "frontmost", arguments: [:])
        async let axSnapshot = optionalCall(namespace: "ax", tool: "snapshot", arguments: [:])
        async let screenshot = optionalCall(namespace: "screenshot", tool: "capture", arguments: [:])
        return [
            "appWindow": await appWindow,
            "axSnapshot": await axSnapshot,
            "screenshot": await screenshot,
        ]
    }

    private func optionalCall(namespace: String, tool: String, arguments: [String: Any]) async -> [String: Any] {
        (try? await capabilityClient.call(namespace: namespace, tool: tool, arguments: arguments)) ?? [:]
    }

    private func recordedEvent(
        from event: [String: Any],
        previousEvidence: [String: Any]
    ) async -> (recorded: [String: Any], after: [String: Any]) {
        let after = await captureEvidence()
        var recorded = event
        recorded["timestamp"] = iso8601(Date())
        recorded["before"] = previousEvidence
        recorded["after"] = after
        return (recorded, after)
    }
}

public final class AutomationStore: @unchecked Sendable {
    private let directoryURL: URL
    private let fileManager: FileManager
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init(directoryURL: URL, fileManager: FileManager = .default) {
        self.directoryURL = directoryURL
        self.fileManager = fileManager
        self.encoder = JSONEncoder()
        self.encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        self.decoder = JSONDecoder()
    }

    public func savePolicy(_ policy: AutomationPolicy) throws {
        try write(policy, to: policiesURL.appendingPathComponent("\(policy.id).json"))
    }

    public func loadPolicy(id: String) throws -> AutomationPolicy {
        try read(AutomationPolicy.self, from: policiesURL.appendingPathComponent("\(id).json"))
    }

    public func saveRun(_ run: AutomationRunRecord) throws {
        try write(run, to: runsURL.appendingPathComponent("\(run.id).json"))
    }

    public func savePatch(_ patch: AutomationPolicyPatch) throws {
        try write(patch, to: patchesURL.appendingPathComponent("\(patch.id).json"))
    }

    public func loadPatch(id: String) throws -> AutomationPolicyPatch {
        try read(AutomationPolicyPatch.self, from: patchesURL.appendingPathComponent("\(id).json"))
    }

    public func applyPatch(_ patch: AutomationPolicyPatch) throws -> AutomationPolicy {
        var policy = try loadPolicy(id: patch.policyId)
        policy.branches.append(patch.branch)
        policy.version += 1
        try savePolicy(policy)
        try savePatch(patch)
        return policy
    }

    public func listRuns() throws -> [AutomationRunRecord] {
        try list(AutomationRunRecord.self, in: runsURL)
    }

    public func listPatches() throws -> [AutomationPolicyPatch] {
        try list(AutomationPolicyPatch.self, in: patchesURL)
    }

    public func saveTrace(id: String, payload: [String: Any]) throws {
        let url = tracesURL.appendingPathComponent(id, isDirectory: true).appendingPathComponent("trace.json")
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let data = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: url, options: .atomic)
    }

    public func loadTrace(id: String) throws -> [String: Any] {
        let url = tracesURL.appendingPathComponent(id, isDirectory: true).appendingPathComponent("trace.json")
        let data = try Data(contentsOf: url)
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }

    public func saveRepairRequest(id: String, payload: [String: Any]) throws {
        let url = repairRequestsURL.appendingPathComponent("\(id).json")
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let data = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: url, options: .atomic)
    }

    public func loadRepairRequest(id: String) throws -> [String: Any] {
        let url = repairRequestsURL.appendingPathComponent("\(id).json")
        let data = try Data(contentsOf: url)
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }

    public func listRepairRequests() throws -> [[String: Any]] {
        guard let urls = try? fileManager.contentsOfDirectory(at: repairRequestsURL, includingPropertiesForKeys: nil) else {
            return []
        }
        return try urls
            .filter { $0.pathExtension == "json" }
            .sorted(by: { $0.lastPathComponent < $1.lastPathComponent })
            .map { url in
                let data = try Data(contentsOf: url)
                return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
            }
    }

    private func write<T: Encodable>(_ value: T, to url: URL) throws {
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try encoder.encode(value).write(to: url, options: .atomic)
    }

    private func read<T: Decodable>(_ type: T.Type, from url: URL) throws -> T {
        try decoder.decode(type, from: Data(contentsOf: url))
    }

    private func list<T: Decodable>(_ type: T.Type, in directory: URL) throws -> [T] {
        guard let urls = try? fileManager.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) else {
            return []
        }
        return try urls.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }).map {
            try read(type, from: $0)
        }
    }

    private var policiesURL: URL { directoryURL.appendingPathComponent("policies", isDirectory: true) }
    private var runsURL: URL { directoryURL.appendingPathComponent("runs", isDirectory: true) }
    private var patchesURL: URL { directoryURL.appendingPathComponent("patches", isDirectory: true) }
    private var tracesURL: URL { directoryURL.appendingPathComponent("traces", isDirectory: true) }
    private var repairRequestsURL: URL { directoryURL.appendingPathComponent("repair-requests", isDirectory: true) }
}

public final class AutomationRuntime: @unchecked Sendable {
    private let store: AutomationStore
    private let capabilityClient: AutomationCapabilityCalling
    private let repairer: AutomationRepairing

    public init(store: AutomationStore, capabilityClient: AutomationCapabilityCalling, repairer: AutomationRepairing) {
        self.store = store
        self.capabilityClient = capabilityClient
        self.repairer = repairer
    }

    public func run(policyId: String) async throws -> AutomationRunRecord {
        var policy = try store.loadPolicy(id: policyId)
        let runId = UUID().uuidString
        var records: [AutomationStepRecord] = []
        guard let branch = policy.branches.first else {
            throw AutomationRuntimeError.emptyPolicy
        }

        do {
            for (index, step) in branch.steps.enumerated() {
                try await execute(step: step)
                records.append(AutomationStepRecord(stepIndex: index, kind: step.kind, status: "completed"))
            }
            try await assert(branch.assertions)
            let run = AutomationRunRecord(
                id: runId,
                policyId: policy.id,
                policyVersion: policy.version,
                status: "completed",
                steps: records,
                failureReason: nil,
                patchId: nil
            )
            try store.saveRun(run)
            return run
        } catch {
            let failedStep = branch.steps[min(records.count, max(branch.steps.count - 1, 0))]
            let failedStepIndex = min(records.count, max(branch.steps.count - 1, 0))
            let request = AutomationRepairRequest(
                policy: policy,
                runId: runId,
                failedStep: failedStep,
                failedStepIndex: failedStepIndex,
                completedSteps: records,
                failureReason: error.localizedDescription,
                appWindow: (try? await capabilityClient.call(namespace: "app_window", tool: "frontmost", arguments: [:])) ?? [:],
                axSnapshot: (try? await capabilityClient.call(namespace: "ax", tool: "snapshot", arguments: [:])) ?? [:],
                screenshot: (try? await capabilityClient.call(namespace: "screenshot", tool: "capture", arguments: [:])) ?? [:]
            )
            let repair = try await repairer.repair(request: request)
            let patch = AutomationPolicyPatch(
                id: UUID().uuidString,
                policyId: policy.id,
                sourceRunId: runId,
                basePolicyVersion: policy.version,
                branch: repair.branch,
                evidence: repair.evidence
            )
            policy.branches.append(repair.branch)
            policy.version += 1
            try store.savePolicy(policy)
            try store.savePatch(patch)
            let run = AutomationRunRecord(
                id: runId,
                policyId: policy.id,
                policyVersion: patch.basePolicyVersion,
                status: "repaired",
                steps: records,
                failureReason: error.localizedDescription,
                patchId: patch.id
            )
            try store.saveRun(run)
            return run
        }
    }

    private func execute(step: AutomationStep) async throws {
        switch step.kind {
        case .activateApp:
            _ = try await capabilityClient.call(
                namespace: "app_window",
                tool: "activate",
                arguments: optionalStringArgument("bundleId", step.bundleId)
            )
        case .click:
            _ = try await capabilityClient.call(
                namespace: "ax",
                tool: "action",
                arguments: ["action": "click", "selector": selectorDictionary(step.selector)]
            )
        case .setValue:
            _ = try await capabilityClient.call(
                namespace: "ax",
                tool: "action",
                arguments: [
                    "action": "set_value",
                    "selector": selectorDictionary(step.selector),
                    "value": step.value ?? "",
                ]
            )
        case .typeText:
            _ = try await capabilityClient.call(
                namespace: "ax",
                tool: "action",
                arguments: [
                    "action": "type_text",
                    "selector": selectorDictionary(step.selector),
                    "text": step.value ?? "",
                ]
            )
        case .hotkey:
            _ = try await capabilityClient.call(
                namespace: "ax",
                tool: "action",
                arguments: ["action": "hotkey", "keys": step.value ?? ""]
            )
        case .waitFor:
            try await waitFor(condition: step.condition, timeoutMs: step.timeoutMs ?? 2_000)
        }
    }

    private func waitFor(condition: AutomationCondition?, timeoutMs: Int) async throws {
        guard let condition else { throw AutomationRuntimeError.conditionFailed }
        let deadline = Date().addingTimeInterval(TimeInterval(max(timeoutMs, 0)) / 1_000)
        repeat {
            let snapshot = try await capabilityClient.call(namespace: "ax", tool: "snapshot", arguments: [:])
            if matches(selector: condition.selector, node: snapshotRoot(snapshot)) {
                return
            }
            try await Task.sleep(for: .milliseconds(100))
        } while Date() < deadline
        throw AutomationRuntimeError.conditionFailed
    }

    private func assert(_ assertions: [AutomationAssertion]) async throws {
        guard !assertions.isEmpty else { return }
        let snapshot = try await capabilityClient.call(namespace: "ax", tool: "snapshot", arguments: [:])
        let root = snapshotRoot(snapshot)
        for assertion in assertions where !matches(selector: assertion.selector, node: root) {
            throw AutomationRuntimeError.assertionFailed
        }
    }
}

public final class AutomationToolRouter: @unchecked Sendable {
    private let store: AutomationStore
    private let runtime: AutomationRuntime
    private let recorder: AutomationRecordingService?

    public init(store: AutomationStore, runtime: AutomationRuntime, recorder: AutomationRecordingService? = nil) {
        self.store = store
        self.runtime = runtime
        self.recorder = recorder
    }

    public func handle(namespace: String, tool: String, arguments: Any?) async -> PluginToolResult {
        guard namespace == "automation" else {
            return .text("unsupported namespace: \(namespace)", success: false)
        }
        do {
            switch tool {
            case "run":
                let run = try await runtime.run(policyId: stringArgument(arguments, "policyId"))
                return .json(["run": try encodeDictionary(run)])
            case "history":
                return .json([
                    "runs": try store.listRuns().map(encodeDictionary),
                    "patches": try store.listPatches().map(encodeDictionary),
                    "repairRequests": try AutomationRepairRequestStore(store: store).listRepairRequests(),
                ])
            case "record_start":
                if let recorder {
                    return .json(await recorder.start(arguments: arguments))
                }
                return .json(["recordingId": UUID().uuidString, "status": "recording"])
            case "record_event":
                guard let recorder else {
                    return .text("recording service is not available", success: false)
                }
                return .json(try await recorder.recordEvent(arguments: arguments))
            case "record_stop":
                if let recorder {
                    return .json(try await recorder.stop(arguments: arguments, store: store))
                }
                let traceId = stringArgument(arguments, "traceId", fallback: UUID().uuidString)
                try store.saveTrace(id: traceId, payload: dictionaryArgument(arguments))
                return .json(["traceId": traceId, "status": "saved"])
            case "policy_create":
                let object = dictionaryArgument(arguments)
                if object["policy"] != nil {
                    let policy = try decodeJSONObject(AutomationPolicy.self, from: object["policy"])
                    try store.savePolicy(policy)
                    return .json(["policy": try encodeDictionary(policy)])
                }
                let policyId = stringArgument(arguments, "policyId", fallback: UUID().uuidString)
                let traceId = stringArgument(arguments, "traceId", fallback: "")
                let trace = traceId.isEmpty ? [:] : (try? store.loadTrace(id: traceId)) ?? [:]
                let branch = object["branch"] != nil
                    ? try decodeJSONObject(AutomationBranch.self, from: object["branch"])
                    : automationBranch(from: trace)
                let policy = AutomationPolicy(
                    id: policyId,
                    title: stringArgument(arguments, "title", fallback: "Recorded Automation"),
                    targetBundleId: stringValue(object["targetBundleId"]) ?? trace["targetBundleId"] as? String,
                    branches: [branch]
                )
                try store.savePolicy(policy)
                return .json(["policy": try encodeDictionary(policy)])
            case "apply_patch":
                let patchId = stringArgument(arguments, "patchId", fallback: "")
                let patch = try store.loadPatch(id: patchId)
                let policy = try store.applyPatch(patch)
                return .json(["policy": try encodeDictionary(policy), "patch": try encodeDictionary(patch)])
            case "repair_apply":
                let object = dictionaryArgument(arguments)
                let repairRequestId = stringArgument(arguments, "repairRequestId", fallback: "")
                let repairStore = AutomationRepairRequestStore(store: store)
                let repairRequest = try store.loadRepairRequest(id: repairRequestId)
                guard stringValue(repairRequest["status"]) == "pending" else {
                    return .text("automation repair request is not pending", success: false)
                }
                let policyId = stringValue(repairRequest["policyId"]) ?? ""
                let runId = stringValue(repairRequest["runId"]) ?? UUID().uuidString
                let policy = try store.loadPolicy(id: policyId)
                let branch = try decodeJSONObject(AutomationBranch.self, from: object["branch"])
                var evidence = stringDictionaryArgument(object["evidence"])
                evidence["repair"] = "agent-computer-use-result"
                evidence["repairRequestId"] = repairRequestId
                evidence["route"] = "agent_computer_use"
                let patch = AutomationPolicyPatch(
                    id: stringArgument(arguments, "patchId", fallback: UUID().uuidString),
                    policyId: policy.id,
                    sourceRunId: runId,
                    basePolicyVersion: policy.version,
                    branch: branch,
                    evidence: evidence
                )
                let updatedPolicy = try store.applyPatch(patch)
                let updatedRepairRequest = try repairStore.markApplied(id: repairRequestId, patchId: patch.id)
                return .json([
                    "policy": try encodeDictionary(updatedPolicy),
                    "patch": try encodeDictionary(patch),
                    "repairRequest": updatedRepairRequest,
                ])
            default:
                return .text("unsupported automation tool: \(tool)", success: false)
            }
        } catch {
            return .text(error.localizedDescription, success: false)
        }
    }
}

public enum AutomationRuntimeError: LocalizedError {
    case emptyPolicy
    case conditionFailed
    case assertionFailed
    case recordingNotFound

    public var errorDescription: String? {
        switch self {
        case .emptyPolicy:
            return "automation policy has no branches"
        case .conditionFailed:
            return "automation condition failed"
        case .assertionFailed:
            return "automation assertion failed"
        case .recordingNotFound:
            return "automation recording session was not found"
        }
    }
}

private func selectorDictionary(_ selector: AXSelector?) -> [String: Any] {
    guard let selector else { return [:] }
    var result: [String: Any] = [:]
    if let role = selector.role { result["role"] = role }
    if let title = selector.title { result["title"] = title }
    return result
}

private func optionalStringArgument(_ key: String, _ value: String?) -> [String: Any] {
    guard let value else { return [:] }
    return [key: value]
}

private func snapshotRoot(_ snapshot: [String: Any]) -> [String: Any] {
    snapshot["root"] as? [String: Any] ?? snapshot
}

private func matches(selector: AXSelector, node: [String: Any]) -> Bool {
    let roleMatches = selector.role == nil || node["role"] as? String == selector.role
    let titleMatches = selector.title == nil || node["title"] as? String == selector.title
    if roleMatches && titleMatches { return true }
    let children = node["children"] as? [[String: Any]] ?? []
    return children.contains { matches(selector: selector, node: $0) }
}

private func encodeDictionary<T: Encodable>(_ value: T) throws -> [String: Any] {
    let data = try JSONEncoder().encode(value)
    return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
}

private func decodeJSONObject<T: Decodable>(_ type: T.Type, from value: Any?) throws -> T {
    let object = value ?? [:]
    let data = try JSONSerialization.data(withJSONObject: object)
    return try JSONDecoder().decode(type, from: data)
}

private func stringArgument(_ arguments: Any?, _ key: String, fallback: String = "") -> String {
    let object = arguments as? [String: Any]
    return object?[key] as? String ?? fallback
}

private func dictionaryArgument(_ arguments: Any?) -> [String: Any] {
    arguments as? [String: Any] ?? [:]
}

private func stringDictionaryArgument(_ arguments: Any?) -> [String: String] {
    let object = dictionaryArgument(arguments)
    return object.reduce(into: [String: String]()) { result, pair in
        result[pair.key] = stringValue(pair.value) ?? ""
    }
}

private func metadataArguments(from object: [String: Any]) -> [String: Any] {
    object.filter { key, _ in
        key != "recordingId" && key != "traceId" && key != "event"
    }
}

private func automationBranch(from trace: [String: Any]) -> AutomationBranch {
    let events = (trace["events"] as? [[String: Any]]) ?? (trace["steps"] as? [[String: Any]]) ?? []
    var steps: [AutomationStep] = []
    var assertions: [AutomationAssertion] = []

    if let bundleId = trace["targetBundleId"] as? String, !bundleId.isEmpty {
        steps.append(AutomationStep(kind: .activateApp, bundleId: bundleId))
    }

    for event in events {
        let kind = (event["kind"] as? String ?? event["type"] as? String ?? "").lowercased()
        switch kind {
        case "activateapp", "activate_app", "activate":
            steps.append(AutomationStep(
                kind: .activateApp,
                bundleId: stringValue(event["bundleId"]) ?? stringValue(event["targetBundleId"])
            ))
        case "click", "press":
            steps.append(AutomationStep(kind: .click, selector: axSelector(event["selector"])))
        case "setvalue", "set_value":
            steps.append(AutomationStep(
                kind: .setValue,
                selector: axSelector(event["selector"]),
                value: stringValue(event["value"])
            ))
        case "typetext", "type_text", "type":
            steps.append(AutomationStep(
                kind: .typeText,
                selector: axSelector(event["selector"]),
                value: stringValue(event["value"]) ?? stringValue(event["text"])
            ))
        case "hotkey":
            steps.append(AutomationStep(kind: .hotkey, value: hotkeyValue(event["keys"] ?? event["value"])))
        case "waitfor", "wait_for", "wait":
            if let selector = axSelector(event["selector"]) {
                steps.append(AutomationStep(
                    kind: .waitFor,
                    condition: AutomationCondition(selector: selector),
                    timeoutMs: intValue(event["timeoutMs"]) ?? intValue(event["timeout"])
                ))
            }
        case "assert", "assertion":
            if let selector = axSelector(event["selector"]) {
                assertions.append(AutomationAssertion(selector: selector))
            }
        default:
            continue
        }
    }

    return AutomationBranch(id: "main", steps: steps, assertions: assertions)
}

private func axSelector(_ value: Any?) -> AXSelector? {
    guard let object = value as? [String: Any] else { return nil }
    return AXSelector(
        role: stringValue(object["role"]),
        title: stringValue(object["title"])
    )
}

private func stringValue(_ value: Any?) -> String? {
    if let string = value as? String { return string }
    guard let value else { return nil }
    return String(describing: value)
}

private func intValue(_ value: Any?) -> Int? {
    if let int = value as? Int { return int }
    if let double = value as? Double { return Int(double) }
    if let string = value as? String { return Int(string) }
    return nil
}

private func boolValue(_ value: Any?) -> Bool {
    if let bool = value as? Bool { return bool }
    if let string = value as? String {
        return ["1", "true", "yes", "on"].contains(string.lowercased())
    }
    if let int = value as? Int { return int != 0 }
    return false
}

private func hotkeyValue(_ value: Any?) -> String? {
    if let keys = value as? [String] {
        return keys.joined(separator: "+")
    }
    return stringValue(value)
}

private func iso8601(_ date: Date) -> String {
    ISO8601DateFormatter().string(from: date)
}
