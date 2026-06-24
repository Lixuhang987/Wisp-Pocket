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
    public var failedStep: AutomationStep
    public var failureReason: String
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
            let request = AutomationRepairRequest(
                policy: policy,
                failedStep: failedStep,
                failureReason: error.localizedDescription,
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
                arguments: ["bundleId": step.bundleId as Any]
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
                    "value": step.value as Any,
                ]
            )
        case .typeText:
            _ = try await capabilityClient.call(
                namespace: "ax",
                tool: "action",
                arguments: [
                    "action": "type_text",
                    "selector": selectorDictionary(step.selector),
                    "text": step.value as Any,
                ]
            )
        case .hotkey:
            _ = try await capabilityClient.call(
                namespace: "ax",
                tool: "action",
                arguments: ["action": "hotkey", "keys": step.value as Any]
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

    public init(store: AutomationStore, runtime: AutomationRuntime) {
        self.store = store
        self.runtime = runtime
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
                ])
            case "record_start":
                return .json(["recordingId": UUID().uuidString, "status": "recording"])
            case "record_stop":
                let traceId = stringArgument(arguments, "traceId", fallback: UUID().uuidString)
                try store.saveTrace(id: traceId, payload: dictionaryArgument(arguments))
                return .json(["traceId": traceId, "status": "saved"])
            case "policy_create":
                let policyId = stringArgument(arguments, "policyId", fallback: UUID().uuidString)
                let traceId = stringArgument(arguments, "traceId", fallback: "")
                let trace = traceId.isEmpty ? [:] : (try? store.loadTrace(id: traceId)) ?? [:]
                let policy = AutomationPolicy(
                    id: policyId,
                    title: stringArgument(arguments, "title", fallback: "Recorded Automation"),
                    targetBundleId: trace["targetBundleId"] as? String,
                    branches: [
                        AutomationBranch(id: "main", steps: [], assertions: []),
                    ]
                )
                try store.savePolicy(policy)
                return .json(["policy": try encodeDictionary(policy)])
            case "apply_patch":
                let patchId = stringArgument(arguments, "patchId", fallback: "")
                let patch = try store.loadPatch(id: patchId)
                let policy = try store.applyPatch(patch)
                return .json(["policy": try encodeDictionary(policy), "patch": try encodeDictionary(patch)])
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

    public var errorDescription: String? {
        switch self {
        case .emptyPolicy:
            return "automation policy has no branches"
        case .conditionFailed:
            return "automation condition failed"
        case .assertionFailed:
            return "automation assertion failed"
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

private func stringArgument(_ arguments: Any?, _ key: String, fallback: String = "") -> String {
    let object = arguments as? [String: Any]
    return object?[key] as? String ?? fallback
}

private func dictionaryArgument(_ arguments: Any?) -> [String: Any] {
    arguments as? [String: Any] ?? [:]
}
