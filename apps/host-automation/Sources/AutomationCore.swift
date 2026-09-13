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
    public var position: [String: Double]?
    public var button: String?

    public init(
        kind: AutomationStepKind,
        selector: AXSelector? = nil,
        value: String? = nil,
        bundleId: String? = nil,
        condition: AutomationCondition? = nil,
        timeoutMs: Int? = nil,
        position: [String: Double]? = nil,
        button: String? = nil
    ) {
        self.kind = kind
        self.selector = selector
        self.value = value
        self.bundleId = bundleId
        self.condition = condition
        self.timeoutMs = timeoutMs
        self.position = position
        self.button = button
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
    public var conditions: [AutomationCondition]
    public var steps: [AutomationStep]
    public var assertions: [AutomationAssertion]

    public init(
        id: String,
        conditions: [AutomationCondition] = [],
        steps: [AutomationStep],
        assertions: [AutomationAssertion]
    ) {
        self.id = id
        self.conditions = conditions
        self.steps = steps
        self.assertions = assertions
    }

    enum CodingKeys: String, CodingKey {
        case id
        case conditions
        case steps
        case assertions
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(String.self, forKey: .id)
        self.conditions = try container.decodeIfPresent([AutomationCondition].self, forKey: .conditions) ?? []
        self.steps = try container.decode([AutomationStep].self, forKey: .steps)
        self.assertions = try container.decode([AutomationAssertion].self, forKey: .assertions)
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

public enum AutomationJSONValue: Codable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: AutomationJSONValue])
    case array([AutomationJSONValue])
    case null

    public init(any value: Any?) {
        switch value {
        case nil, is NSNull:
            self = .null
        case let value as String:
            self = .string(value)
        case let value as NSNumber:
            self = CFGetTypeID(value) == CFBooleanGetTypeID()
                ? .bool(value.boolValue) : .number(value.doubleValue)
        case let value as [String: Any]:
            self = .object(value.mapValues { AutomationJSONValue(any: $0) })
        case let value as [Any]:
            self = .array(value.map { AutomationJSONValue(any: $0) })
        default:
            self = .string(String(describing: value!))
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: AutomationJSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([AutomationJSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported automation JSON value")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }
}

public struct AutomationRunRecord: Codable, Equatable {
    public var id: String
    public var policyId: String
    public var policyVersion: Int
    public var targetBundleId: String?
    public var branchId: String?
    public var matchedConditions: [AutomationCondition]?
    public var startedAt: String?
    public var status: String
    public var steps: [AutomationStepRecord]
    public var evidence: [String: AutomationJSONValue]?
    public var failureReason: String?
    public var failedStepIndex: Int?
    public var failureStage: String?
    public var patchId: String?
    public var repairEvidence: [String: String]?
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

@MainActor
public protocol AutomationLiveEventRecording {
    func start(recordingId: String) throws
    func stop(recordingId: String) throws -> [[String: Any]]
}

@MainActor
public final class AutomationRepairRequestStore {
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

@MainActor
public final class AutomationRecordingService {
    private let host: any HostAutomationCapabilities
    private let liveRecorder: (any AutomationLiveEventRecording)?
    private var sessions: [String: [String: Any]] = [:]

    public init(host: any HostAutomationCapabilities, liveRecorder: (any AutomationLiveEventRecording)? = nil) {
        self.host = host
        self.liveRecorder = liveRecorder
    }

    public func start(arguments: Any?) async throws -> [String: Any] {
        let object = dictionaryArgument(arguments)
        let recordingId = stringArgument(arguments, "recordingId", fallback: UUID().uuidString)
        try validateAutomationID(recordingId)
        guard sessions[recordingId] == nil else {
            throw AutomationRuntimeError.invalidArgument("recordingId is already active")
        }
        let evidence = await captureAutomationEvidence(host: host)
        try Task.checkCancellation()
        let targetBundleId = stringValue(object["targetBundleId"])
            ?? ((evidence["appWindow"] as? [String: Any])?["app"] as? [String: Any])?["bundleId"] as? String
        var session: [String: Any] = [
            "recordingId": recordingId, "startedAt": iso8601(Date()),
            "initialEvidence": evidence, "lastEvidence": evidence, "events": [],
        ]
        if let targetBundleId { session["targetBundleId"] = targetBundleId }
        if boolValue(object["captureUserEvents"]) {
            guard let liveRecorder else {
                throw AutomationRuntimeError.invalidArgument("live user event recording is unavailable")
            }
            try liveRecorder.start(recordingId: recordingId)
            session["liveRecording"] = "running"
        }
        sessions[recordingId] = session
        var response = session
        response["status"] = "recording"
        response.removeValue(forKey: "lastEvidence")
        response.removeValue(forKey: "events")
        return response
    }

    public func recordEvent(arguments: Any?) async throws -> [String: Any] {
        let object = dictionaryArgument(arguments)
        let recordingId = stringArgument(arguments, "recordingId")
        guard var session = sessions[recordingId] else { throw AutomationRuntimeError.recordingNotFound }
        let event = dictionaryArgument(object["event"]).merging(metadataArguments(from: object)) { current, _ in current }
        guard !event.isEmpty else { throw AutomationRuntimeError.invalidArgument("event is required") }
        try validateAutomationBranch(automationBranch(from: ["events": [event]]))
        let (recorded, after) = await recordedEvent(from: event, previousEvidence: session["lastEvidence"] as? [String: Any] ?? [:])
        try Task.checkCancellation()
        var events = session["events"] as? [[String: Any]] ?? []
        events.append(recorded)
        session["events"] = events
        session["lastEvidence"] = after
        sessions[recordingId] = session
        return ["recordingId": recordingId, "status": "recording", "eventIndex": events.count - 1, "event": recorded]
    }

    public func stop(arguments: Any?, store: AutomationStore) async throws -> [String: Any] {
        let object = dictionaryArgument(arguments)
        let recordingId = stringArgument(arguments, "recordingId")
        let traceId = stringArgument(arguments, "traceId", fallback: recordingId.isEmpty ? UUID().uuidString : recordingId)
        try validateAutomationID(traceId)
        let suppliedEvents = object["events"] as? [[String: Any]] ?? []
        if object["events"] != nil, !(object["events"] is [[String: Any]]) {
            throw AutomationRuntimeError.invalidArgument("events must be an array of event objects")
        }
        for event in suppliedEvents { try validateAutomationBranch(automationBranch(from: ["events": [event]])) }
        if recordingId.isEmpty {
            guard !suppliedEvents.isEmpty else {
                throw AutomationRuntimeError.invalidArgument("recordingId or a nonempty events trace is required")
            }
            try store.saveTrace(id: traceId, payload: object)
            return ["traceId": traceId, "status": "saved", "eventCount": suppliedEvents.count]
        }
        guard var session = sessions[recordingId] else { throw AutomationRuntimeError.recordingNotFound }
        var liveEvents: [[String: Any]] = []
        if session["liveRecording"] as? String == "running" {
            liveEvents = try liveRecorder?.stop(recordingId: recordingId) ?? []
            session["liveRecording"] = "stopped"
            sessions[recordingId] = session
        }
        var events = session["events"] as? [[String: Any]] ?? []
        var previousEvidence = session["lastEvidence"] as? [String: Any] ?? [:]
        let stopEvidence = await captureAutomationEvidence(host: host)
        try Task.checkCancellation()
        // The event tap records actions and their times, not per-event screenshots.
        // Take one stop snapshot and identify that timing on every live event.
        for event in liveEvents {
            var recorded = event
            recorded["timestamp"] = event["timestamp"] ?? iso8601(Date())
            recorded["evidenceRef"] = "finalEvidence"
            recorded["evidenceCapturedAt"] = stopEvidence["capturedAt"]
            recorded["evidenceTiming"] = "recording_stop"
            events.append(recorded)
        }
        if !liveEvents.isEmpty { previousEvidence = stopEvidence }
        for event in suppliedEvents {
            let (recorded, after) = await recordedEvent(from: event, previousEvidence: previousEvidence)
            try Task.checkCancellation()
            events.append(recorded)
            previousEvidence = after
        }
        session["events"] = events
        session["lastEvidence"] = previousEvidence
        session["traceId"] = traceId
        session["completedAt"] = iso8601(Date())
        session["finalEvidence"] = stopEvidence
        try Task.checkCancellation()
        sessions[recordingId] = session
        var trace = session
        trace.removeValue(forKey: "lastEvidence")
        try store.saveTrace(id: traceId, payload: trace)
        sessions.removeValue(forKey: recordingId)
        return [
            "traceId": traceId, "recordingId": recordingId, "status": "saved",
            "eventCount": events.count, "liveEventCount": liveEvents.count,
            "finalEvidence": stopEvidence,
        ]
    }

    public func stopAll() {
        for (id, session) in sessions where session["liveRecording"] as? String == "running" {
            _ = try? liveRecorder?.stop(recordingId: id)
        }
        sessions.removeAll()
    }

    private func recordedEvent(from event: [String: Any], previousEvidence: [String: Any]) async -> (
        recorded: [String: Any], after: [String: Any]
    ) {
        let after = await captureAutomationEvidence(host: host)
        var recorded = event
        // Live events already carry the event time. Evidence collected at stop is
        // explicitly marked; it is not presented as a snapshot from that time.
        recorded["timestamp"] = event["timestamp"] ?? iso8601(Date())
        recorded["before"] = previousEvidence
        recorded["after"] = after
        if event["source"] as? String == "macos_event_tap" {
            recorded["evidenceCapturedAt"] = iso8601(Date())
            recorded["evidenceTiming"] = "recording_stop"
        }
        return (recorded, after)
    }
}

@MainActor
public final class AutomationStore {
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
        try validateAutomationPolicy(policy)
        try write(policy, to: policiesURL.appendingPathComponent("\(policy.id).json"))
    }

    public func loadPolicy(id: String) throws -> AutomationPolicy {
        try validateAutomationID(id)
        let policy = try read(AutomationPolicy.self, from: policiesURL.appendingPathComponent("\(id).json"))
        try validateAutomationPolicy(policy)
        guard policy.id == id else { throw AutomationRuntimeError.invalidArgument("stored policy identifier does not match its file") }
        return policy
    }

    public func saveRun(_ run: AutomationRunRecord) throws {
        try validateAutomationID(run.id)
        try write(run, to: runsURL.appendingPathComponent("\(run.id).json"))
    }

    public func loadRun(id: String) throws -> AutomationRunRecord {
        try validateAutomationID(id)
        return try read(AutomationRunRecord.self, from: runsURL.appendingPathComponent("\(id).json"))
    }

    public func savePatch(_ patch: AutomationPolicyPatch) throws {
        try validateAutomationID(patch.id)
        try write(patch, to: patchesURL.appendingPathComponent("\(patch.id).json"))
    }

    public func loadPatch(id: String) throws -> AutomationPolicyPatch {
        try validateAutomationID(id)
        return try read(AutomationPolicyPatch.self, from: patchesURL.appendingPathComponent("\(id).json"))
    }

    public func applyPatch(_ patch: AutomationPolicyPatch) throws -> AutomationPolicy {
        var policy = try loadPolicy(id: patch.policyId)
        guard policy.version == patch.basePolicyVersion else { throw AutomationRuntimeError.stalePatch }
        let (nextVersion, overflow) = policy.version.addingReportingOverflow(1)
        guard !overflow else {
            throw AutomationRuntimeError.invalidArgument("policy version cannot be incremented beyond the integer limit")
        }
        try validateAutomationBranch(patch.branch)
        let sourceRun = try loadRun(id: patch.sourceRunId)
        guard sourceRun.policyId == policy.id else {
            throw AutomationRuntimeError.invalidArgument("patch source run belongs to a different policy")
        }
        if let index = policy.branches.firstIndex(where: { $0.id == sourceRun.branchId }) {
            policy.branches[index] = patch.branch
        } else {
            policy.branches.insert(patch.branch, at: 0)
        }
        policy.version = nextVersion
        try savePatch(patch)
        try savePolicy(policy)
        return policy
    }

    public func listRuns() throws -> [AutomationRunRecord] {
        try list(AutomationRunRecord.self, in: runsURL)
    }

    public func listPatches() throws -> [AutomationPolicyPatch] {
        try list(AutomationPolicyPatch.self, in: patchesURL)
    }

    public func saveTrace(id: String, payload: [String: Any]) throws {
        try validateAutomationID(id)
        let url = tracesURL.appendingPathComponent(id, isDirectory: true).appendingPathComponent("trace.json")
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let data = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: url, options: .atomic)
    }

    public func loadTrace(id: String) throws -> [String: Any] {
        try validateAutomationID(id)
        let url = tracesURL.appendingPathComponent(id, isDirectory: true).appendingPathComponent("trace.json")
        let data = try Data(contentsOf: url)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any], !object.isEmpty else {
            throw AutomationRuntimeError.invalidArgument("stored data must be a nonempty JSON object")
        }
        return object
    }

    public func saveRepairRequest(id: String, payload: [String: Any]) throws {
        try validateAutomationID(id)
        let url = repairRequestsURL.appendingPathComponent("\(id).json")
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let data = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: url, options: .atomic)
    }

    public func loadRepairRequest(id: String) throws -> [String: Any] {
        try validateAutomationID(id)
        let url = repairRequestsURL.appendingPathComponent("\(id).json")
        let data = try Data(contentsOf: url)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any], !object.isEmpty else {
            throw AutomationRuntimeError.invalidArgument("stored data must be a nonempty JSON object")
        }
        return object
    }

    public func listRepairRequests() throws -> [[String: Any]] {
        try jsonFiles(in: repairRequestsURL).map { url in
            let request = try loadRepairRequest(id: url.deletingPathExtension().lastPathComponent)
            guard request["id"] is String, request["status"] is String,
                  request["policyId"] is String, request["runId"] is String else {
                throw AutomationRuntimeError.invalidArgument("stored repair request is missing required fields")
            }
            return request
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
        try jsonFiles(in: directory).map { try read(type, from: $0) }
    }

    private func jsonFiles(in directory: URL) throws -> [URL] {
        do {
            return try fileManager.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
                .filter { $0.pathExtension == "json" }
                .sorted { $0.lastPathComponent < $1.lastPathComponent }
        } catch CocoaError.fileReadNoSuchFile {
            return []
        }
    }

    private var policiesURL: URL { directoryURL.appendingPathComponent("policies", isDirectory: true) }
    private var runsURL: URL { directoryURL.appendingPathComponent("runs", isDirectory: true) }
    private var patchesURL: URL { directoryURL.appendingPathComponent("patches", isDirectory: true) }
    private var tracesURL: URL { directoryURL.appendingPathComponent("traces", isDirectory: true) }
    private var repairRequestsURL: URL { directoryURL.appendingPathComponent("repair-requests", isDirectory: true) }
}

@MainActor
public final class AutomationRuntime {
    private let store: AutomationStore
    private let host: any HostAutomationCapabilities

    public init(store: AutomationStore, host: any HostAutomationCapabilities) {
        self.store = store
        self.host = host
    }

    public func run(policyId: String) async throws -> AutomationRunRecord {
        let policy = try store.loadPolicy(id: policyId)
        guard !policy.branches.isEmpty else { throw AutomationRuntimeError.emptyPolicy }
        var run = AutomationRunRecord(
            id: UUID().uuidString, policyId: policy.id, policyVersion: policy.version,
            targetBundleId: policy.targetBundleId, branchId: nil, matchedConditions: [],
            startedAt: iso8601(Date()), status: "running", steps: [], evidence: nil,
            failureReason: nil, failedStepIndex: nil, failureStage: nil, patchId: nil, repairEvidence: nil
        )
        try store.saveRun(run)
        var branch: AutomationBranch?
        var stage = "conditions"
        do {
            try Task.checkCancellation()
            guard let matchedBranch = try await matchingBranch(in: policy) else {
                throw AutomationRuntimeError.conditionFailed
            }
            branch = matchedBranch
            run.branchId = matchedBranch.id
            run.matchedConditions = matchedBranch.conditions
            stage = "steps"
            for (index, step) in matchedBranch.steps.enumerated() {
                try Task.checkCancellation()
                try await execute(step: step)
                try Task.checkCancellation()
                run.steps.append(AutomationStepRecord(stepIndex: index, kind: step.kind, status: "completed"))
                try store.saveRun(run)
            }
            stage = "assertions"
            try await assert(matchedBranch.assertions)
            try Task.checkCancellation()
            run.evidence = automationJSONDictionary(await captureAutomationEvidence(host: host))
            try Task.checkCancellation()
            run.status = "completed"
            try store.saveRun(run)
            return run
        } catch {
            let cancelled = error is CancellationError || Task.isCancelled
            run.status = cancelled ? "cancelled" : "failed"
            run.failureReason = cancelled ? "automation run cancelled" : error.localizedDescription
            run.failedStepIndex = run.steps.count
            run.failureStage = stage
            let evidence = cancelled ? ["cancelled": true] : await captureAutomationEvidence(host: host)
            run.evidence = automationJSONDictionary(evidence)
            // Persist failure before creating repair data so a repair-store error
            // cannot erase the execution record or imply a successful run.
            try store.saveRun(run)
            if !cancelled {
                let steps = branch?.steps ?? []
                let failedStep = steps.indices.contains(run.steps.count)
                    ? steps[run.steps.count] : AutomationStep(kind: .waitFor)
                let request = AutomationRepairRequest(
                    policy: policy, runId: run.id, failedStep: failedStep,
                    failedStepIndex: run.steps.count, completedSteps: run.steps,
                    failureReason: run.failureReason ?? "automation failed",
                    appWindow: evidence["appWindow"] as? [String: Any] ?? [:],
                    axSnapshot: evidence["axSnapshot"] as? [String: Any] ?? [:],
                    screenshot: evidence["screenshot"] as? [String: Any] ?? [:]
                )
                do {
                    run.repairEvidence = try AutomationRepairRequestStore(store: store).saveRepairRequest(request)
                } catch {
                    run.repairEvidence = ["error": error.localizedDescription]
                }
                try store.saveRun(run)
            }
            return run
        }
    }

    private func execute(step: AutomationStep) async throws {
        switch step.kind {
        case .activateApp:
            try await host.activateApp(bundleId: step.bundleId)
        case .click:
            var arguments: [String: Any] = ["action": "click", "selector": selectorDictionary(step.selector)]
            if let position = step.position { arguments["position"] = position }
            if let button = step.button { arguments["button"] = button }
            try await host.performAction(arguments)
        case .setValue:
            try await host.performAction([
                "action": "set_value", "selector": selectorDictionary(step.selector), "value": step.value ?? "",
            ])
        case .typeText:
            try await host.performAction([
                "action": "type_text", "selector": selectorDictionary(step.selector), "text": step.value ?? "",
            ])
        case .hotkey:
            try await host.performAction(["action": "hotkey", "keys": step.value ?? ""])
        case .waitFor:
            try await waitFor(condition: step.condition, timeoutMs: step.timeoutMs ?? 2_000)
        }
    }

    private func matchingBranch(in policy: AutomationPolicy) async throws -> AutomationBranch? {
        for branch in policy.branches {
            try Task.checkCancellation()
            if try await matchesAll(branch.conditions) { return branch }
        }
        return nil
    }

    private func matchesAll(_ conditions: [AutomationCondition]) async throws -> Bool {
        guard !conditions.isEmpty else { return true }
        let root = snapshotRoot(try await host.accessibilitySnapshot())
        return conditions.allSatisfy { matches(selector: $0.selector, node: root) }
    }

    private func waitFor(condition: AutomationCondition?, timeoutMs: Int) async throws {
        guard let condition else { throw AutomationRuntimeError.conditionFailed }
        let deadline = Date().addingTimeInterval(TimeInterval(max(timeoutMs, 0)) / 1_000)
        repeat {
            try Task.checkCancellation()
            if matches(selector: condition.selector, node: snapshotRoot(try await host.accessibilitySnapshot())) { return }
            try await Task.sleep(for: .milliseconds(100))
        } while Date() < deadline
        throw AutomationRuntimeError.conditionFailed
    }

    private func assert(_ assertions: [AutomationAssertion]) async throws {
        guard !assertions.isEmpty else { return }
        let root = snapshotRoot(try await host.accessibilitySnapshot())
        for assertion in assertions where !matches(selector: assertion.selector, node: root) {
            throw AutomationRuntimeError.assertionFailed
        }
    }
}

@MainActor
private func captureAutomationEvidence(host: any HostAutomationCapabilities) async -> [String: Any] {
    var evidence: [String: Any] = ["capturedAt": iso8601(Date())]
    guard !Task.isCancelled else { return ["error": "cancelled"] }
    do { evidence["appWindow"] = try await host.frontmostAppWindow() }
    catch { evidence["appWindow"] = ["error": error.localizedDescription] }
    guard !Task.isCancelled else { return evidence }
    do { evidence["axSnapshot"] = try await host.accessibilitySnapshot() }
    catch { evidence["axSnapshot"] = ["error": error.localizedDescription] }
    guard !Task.isCancelled else { return evidence }
    do { evidence["screenshot"] = try await host.captureScreenshot() }
    catch { evidence["screenshot"] = ["error": error.localizedDescription] }
    return evidence
}

@MainActor
public final class AutomationToolRouter {
    private let store: AutomationStore
    private let runtime: AutomationRuntime
    private let recorder: AutomationRecordingService?

    public init(store: AutomationStore, runtime: AutomationRuntime, recorder: AutomationRecordingService? = nil) {
        self.store = store
        self.runtime = runtime
        self.recorder = recorder
    }

    public func handle(namespace: String, tool: String, arguments: Any?) async -> DynamicToolResult {
        guard namespace == "automation" else {
            return .text("unsupported namespace: \(namespace)", success: false)
        }
        do {
            switch tool {
            case "run":
                let run = try await runtime.run(policyId: stringArgument(arguments, "policyId"))
                return .jsonWithImages(["run": try encodeDictionary(run)], success: run.status == "completed")
            case "history":
                return .jsonWithImages([
                    "runs": try store.listRuns().map(encodeDictionary),
                    "patches": try store.listPatches().map(encodeDictionary),
                    "repairRequests": try AutomationRepairRequestStore(store: store).listRepairRequests(),
                ])
            case "record_start":
                if let recorder {
                    return .jsonWithImages(try await recorder.start(arguments: arguments))
                }
                return .text("recording service is not available", success: false)
            case "record_event":
                guard let recorder else {
                    return .text("recording service is not available", success: false)
                }
                return .jsonWithImages(try await recorder.recordEvent(arguments: arguments))
            case "record_stop":
                if let recorder {
                    return .jsonWithImages(try await recorder.stop(arguments: arguments, store: store))
                }
                return .text("recording service is not available", success: false)
            case "policy_create":
                let object = dictionaryArgument(arguments)
                if object["policy"] != nil {
                    let policy = try decodeJSONObject(AutomationPolicy.self, from: object["policy"])
                    try store.savePolicy(policy)
                    return .jsonWithImages(["policy": try encodeDictionary(policy)])
                }
                let policyId = stringArgument(arguments, "policyId", fallback: UUID().uuidString)
                let traceId = stringArgument(arguments, "traceId", fallback: "")
                let trace = traceId.isEmpty ? [:] : try store.loadTrace(id: traceId)
                let branch = object["branch"] != nil
                    ? try decodeJSONObject(AutomationBranch.self, from: object["branch"])
                    : try automationBranch(from: trace)
                let policy = AutomationPolicy(
                    id: policyId,
                    title: stringArgument(arguments, "title", fallback: "Recorded Automation"),
                    targetBundleId: stringValue(object["targetBundleId"]) ?? trace["targetBundleId"] as? String,
                    branches: [branch]
                )
                try store.savePolicy(policy)
                return .jsonWithImages(["policy": try encodeDictionary(policy)])
            case "apply_patch":
                let patchId = stringArgument(arguments, "patchId", fallback: "")
                let patch = try store.loadPatch(id: patchId)
                let policy = try store.applyPatch(patch)
                return .jsonWithImages(["policy": try encodeDictionary(policy), "patch": try encodeDictionary(patch)])
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
                guard (repairRequest["policyVersion"] as? Int) == policy.version else {
                    throw AutomationRuntimeError.stalePatch
                }
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
                return .jsonWithImages([
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
    case invalidArgument(String)
    case stalePatch

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
        case .invalidArgument(let message):
            return "invalid_argument: " + message
        case .stalePatch:
            return "automation patch does not match the current policy version"
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

private func automationJSONDictionary(_ value: [String: Any]) -> [String: AutomationJSONValue] {
    value.mapValues { AutomationJSONValue(any: $0) }
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

private func automationBranch(from trace: [String: Any]) throws -> AutomationBranch {
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
            steps.append(AutomationStep(
                kind: .click,
                selector: axSelector(event["selector"]),
                position: event["position"] as? [String: Double],
                button: event["button"] as? String
            ))
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
            guard let selector = axSelector(event["selector"]) else {
                throw AutomationRuntimeError.invalidArgument("waitFor event requires selector")
            }
            steps.append(AutomationStep(
                kind: .waitFor,
                condition: AutomationCondition(selector: selector),
                timeoutMs: try recordedTimeout(event)
            ))
        case "assert", "assertion":
            guard let selector = axSelector(event["selector"]) else {
                throw AutomationRuntimeError.invalidArgument("assertion event requires selector")
            }
            assertions.append(AutomationAssertion(selector: selector))
        default:
            throw AutomationRuntimeError.invalidArgument("unsupported recorded event: \(kind)")
        }
    }

    return AutomationBranch(id: "main", steps: steps, assertions: assertions)
}

private func validateAutomationID(_ id: String) throws {
    guard !id.isEmpty, id.count <= 200, id != ".", id != "..",
          id.range(of: #"^[A-Za-z0-9._:-]+$"#, options: .regularExpression) != nil else {
        throw AutomationRuntimeError.invalidArgument("identifier must contain 1...200 ASCII letters, digits, dot, underscore, colon or hyphen")
    }
}

private func validateAutomationPolicy(_ policy: AutomationPolicy) throws {
    try validateAutomationID(policy.id)
    guard policy.version > 0, !policy.branches.isEmpty else { throw AutomationRuntimeError.emptyPolicy }
    guard Set(policy.branches.map(\.id)).count == policy.branches.count else {
        throw AutomationRuntimeError.invalidArgument("policy branch identifiers must be unique")
    }
    for branch in policy.branches { try validateAutomationBranch(branch) }
}

private func validateAutomationBranch(_ branch: AutomationBranch) throws {
    try validateAutomationID(branch.id)
    guard !branch.steps.isEmpty || !branch.assertions.isEmpty else {
        throw AutomationRuntimeError.invalidArgument("branch requires steps or assertions")
    }
    for selector in branch.conditions.map(\.selector) + branch.assertions.map(\.selector) {
        guard selector.role?.isEmpty == false || selector.title?.isEmpty == false else {
            throw AutomationRuntimeError.invalidArgument("condition and assertion selectors require role or title")
        }
    }
    for step in branch.steps {
        if let timeout = step.timeoutMs, !(0...300_000).contains(timeout) {
            throw AutomationRuntimeError.invalidArgument("timeoutMs must be between 0 and 300000")
        }
        if step.kind == .waitFor {
            guard let selector = step.condition?.selector,
                  selector.role?.isEmpty == false || selector.title?.isEmpty == false else {
                throw AutomationRuntimeError.invalidArgument("waitFor requires a condition with role or title")
            }
        }
    }
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

private func recordedTimeout(_ event: [String: Any]) throws -> Int? {
    var timeout: Int?
    for key in ["timeoutMs", "timeout"] {
        guard let value = event[key] else { continue }
        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
              let milliseconds = Int(exactly: number.doubleValue), (0...300_000).contains(milliseconds) else {
            throw AutomationRuntimeError.invalidArgument("\(key) must be an integer between 0 and 300000")
        }
        if timeout == nil { timeout = milliseconds }
    }
    return timeout
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
