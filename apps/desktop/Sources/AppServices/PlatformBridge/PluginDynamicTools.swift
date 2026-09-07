import Foundation

enum PluginLifecycle: String {
    case alwaysOn
    case onDemand
    case toolsOnly
}

enum PluginKind: String {
    case dynamicTool
    case automation
    case atomicCapability
}

struct PluginToolDefinition {
    let namespace: String
    let name: String
    let description: String
    let inputSchema: [String: Any]
}

struct PluginManifestDefinition {
    let version: Int
    let id: String
    let title: String
    let description: String?
    let lifecycle: PluginLifecycle
    let kind: PluginKind
    let enabled: Bool
    let command: String
    let args: [String]
    let tools: [PluginToolDefinition]
    let provides: [String]
    let requires: [String]
    let dataDirectoryName: String?
    let directoryURL: URL

    var dynamicToolSpecs: [[String: Any]] {
        guard enabled else { return [] }
        return tools.map { tool in
            [
                "clientId": MacHostDynamicTools.clientId,
                "namespace": tool.namespace,
                "name": tool.name,
                "description": tool.description,
                "inputSchema": tool.inputSchema,
            ]
        }
    }
}

struct PluginManifestLoadResult {
    let plugins: [PluginManifestDefinition]
    let disabled: [String]
}

struct BuiltinPluginDefinition {
    let id: String
    let manifest: [String: Any]
}

struct BuiltinPluginInstaller {
    let pluginsDirectoryURL: URL
    let definitions: [BuiltinPluginDefinition]
    let fileManager: FileManager
    let executableDirectoryURL: URL?

    init(
        pluginsDirectoryURL: URL = FileManager.default
            .homeDirectoryForCurrentUser
            .appendingPathComponent(".spotAgent/plugins", isDirectory: true),
        definitions: [BuiltinPluginDefinition] = Self.defaultDefinitions(),
        fileManager: FileManager = .default,
        executableDirectoryURL: URL? = Bundle.main.executableURL?.deletingLastPathComponent()
    ) {
        self.pluginsDirectoryURL = pluginsDirectoryURL
        self.definitions = definitions
        self.fileManager = fileManager
        self.executableDirectoryURL = executableDirectoryURL
    }

    func ensureInstalled() {
        for definition in definitions {
            let directoryURL = pluginsDirectoryURL.appendingPathComponent(definition.id, isDirectory: true)
            let manifestURL = directoryURL.appendingPathComponent(PluginManifestStore.manifestFileName)
            do {
                try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
                var manifest = definition.manifest
                if let enabled = existingEnabledValue(at: manifestURL) {
                    manifest["enabled"] = enabled
                }
                manifest["command"] = resolvedCommand(for: manifest["command"] as? String)
                let data = try JSONSerialization.data(
                    withJSONObject: manifest,
                    options: [.prettyPrinted, .sortedKeys]
                )
                try data.write(to: manifestURL, options: .atomic)
            } catch {
                continue
            }
        }
    }

    private func existingEnabledValue(at manifestURL: URL) -> Bool? {
        guard let data = try? Data(contentsOf: manifestURL),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let enabled = object["enabled"] as? Bool else {
            return nil
        }
        return enabled
    }

    private func resolvedCommand(for command: String?) -> String? {
        guard let command, !command.hasPrefix("/") else { return command }
        guard let executableDirectoryURL else { return command }
        return executableDirectoryURL.appendingPathComponent(command).path
    }

    static func defaultDefinitions() -> [BuiltinPluginDefinition] {
        [
            atomicAppWindowDefinition(),
            atomicScreenshotDefinition(),
            atomicAXDefinition(),
            contextHistoryDefinition(),
            automationDefinition(),
        ]
    }

    static func atomicAppWindowDefinition() -> BuiltinPluginDefinition {
        BuiltinPluginDefinition(
            id: "handagent-atomic-app-window",
            manifest: [
                "version": 1,
                "id": "handagent-atomic-app-window",
                "title": "Wisp Pocket App/Window Atomic Plugin",
                "description": "Provides frontmost app and window metadata.",
                "lifecycle": "alwaysOn",
                "kind": "atomicCapability",
                "enabled": true,
                "command": "HandAgentAtomicAppWindowPlugin",
                "args": [],
                "provides": ["app_window"],
                "requires": [],
                "tools": [
                    tool("app_window", "frontmost", "Read the frontmost macOS app and window."),
                    tool("app_window", "list_windows", "List visible macOS windows."),
                    tool("app_window", "activate", "Activate a running macOS app by bundle id."),
                ],
            ]
        )
    }

    static func atomicScreenshotDefinition() -> BuiltinPluginDefinition {
        BuiltinPluginDefinition(
            id: "handagent-atomic-screenshot",
            manifest: [
                "version": 1,
                "id": "handagent-atomic-screenshot",
                "title": "Wisp Pocket Screenshot Atomic Plugin",
                "description": "Provides screenshot and thumbnail capture.",
                "lifecycle": "alwaysOn",
                "kind": "atomicCapability",
                "enabled": true,
                "command": "HandAgentAtomicScreenshotPlugin",
                "args": [],
                "provides": ["screenshot"],
                "requires": [],
                "tools": [
                    tool("screenshot", "capture", "Capture a screenshot."),
                    tool("screenshot", "thumbnail", "Create a screenshot thumbnail."),
                ],
            ]
        )
    }

    static func atomicAXDefinition() -> BuiltinPluginDefinition {
        BuiltinPluginDefinition(
            id: "handagent-atomic-ax",
            manifest: [
                "version": 1,
                "id": "handagent-atomic-ax",
                "title": "Wisp Pocket Accessibility Atomic Plugin",
                "description": "Provides Accessibility snapshots and actions.",
                "lifecycle": "alwaysOn",
                "kind": "atomicCapability",
                "enabled": true,
                "command": "HandAgentAtomicAXPlugin",
                "args": [],
                "provides": ["ax"],
                "requires": [],
                "tools": [
                    tool("ax", "snapshot", "Read an Accessibility tree snapshot."),
                    tool("ax", "action", "Perform an Accessibility action."),
                ],
            ]
        )
    }

    static func contextHistoryDefinition() -> BuiltinPluginDefinition {
        BuiltinPluginDefinition(
            id: "handagent-context-history",
            manifest: [
                "version": 1,
                "id": "handagent-context-history",
                "title": "Wisp Pocket Context History",
                "description": "Collects and serves recent desktop context history.",
                "lifecycle": "alwaysOn",
                "kind": "dynamicTool",
                "enabled": false,
                "command": "HandAgentContextHistoryPlugin",
                "args": [],
                "provides": ["context_history"],
                "requires": ["app_window", "screenshot", "ax"],
                "dataDirectoryName": "context-history",
                "tools": [
                    tool("context_history", "activity_index", "List recent app/window activity samples."),
                    tool("context_history", "sample_details", "Read activity sample details by id."),
                    tool("context_history", "thumbnails", "Read screenshot thumbnails by time range."),
                    tool("context_history", "screenshot_original", "Read a single original screenshot by id."),
                ],
            ]
        )
    }

    static func automationDefinition() -> BuiltinPluginDefinition {
        BuiltinPluginDefinition(
            id: "handagent-automation-runtime",
            manifest: [
                "version": 1,
                "id": "handagent-automation-runtime",
                "title": "Wisp Pocket Automation Runtime",
                "description": "Runs and evolves auditable Automation Policy files.",
                "lifecycle": "alwaysOn",
                "kind": "automation",
                "enabled": false,
                "command": "HandAgentAutomationPlugin",
                "args": [],
                "provides": ["automation"],
                "requires": ["app_window", "screenshot", "ax"],
                "dataDirectoryName": "automation",
                "tools": [
                    tool("automation", "record_start", "Start recording an automation trace."),
                    tool("automation", "record_event", "Record a single automation user event with context evidence."),
                    tool("automation", "record_stop", "Stop recording and save the trace."),
                    tool("automation", "policy_create", "Create an Automation Policy from a trace."),
                    tool("automation", "run", "Run an Automation Policy."),
                    tool("automation", "history", "Read automation run, patch, and repair request history."),
                    tool("automation", "apply_patch", "Apply an Automation Policy patch."),
                    tool("automation", "repair_apply", "Apply an agent repair branch to an Automation Policy."),
                ],
            ]
        )
    }

    private static func tool(_ namespace: String, _ name: String, _ description: String) -> [String: Any] {
        [
            "namespace": namespace,
            "name": name,
            "description": description,
            "inputSchema": [
                "type": "object",
                "additionalProperties": true,
            ],
        ]
    }
}

struct PluginManifestStore {
    static let manifestFileName = "plugin.json"

    let pluginsDirectoryURL: URL
    let fileManager: FileManager

    init(
        pluginsDirectoryURL: URL = FileManager.default
            .homeDirectoryForCurrentUser
            .appendingPathComponent(".spotAgent/plugins", isDirectory: true),
        fileManager: FileManager = .default
    ) {
        self.pluginsDirectoryURL = pluginsDirectoryURL
        self.fileManager = fileManager
    }

    func load() -> PluginManifestLoadResult {
        guard let directories = try? fileManager.contentsOfDirectory(
            at: pluginsDirectoryURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return PluginManifestLoadResult(plugins: [], disabled: [])
        }

        var plugins: [PluginManifestDefinition] = []
        var disabled: [String] = []

        for directory in directories.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
            let values = try? directory.resourceValues(forKeys: [.isDirectoryKey])
            guard values?.isDirectory == true else { continue }
            let pluginId = directory.lastPathComponent
            let manifestURL = directory.appendingPathComponent(Self.manifestFileName)
            do {
                let manifest = try Self.decodeManifest(
                    data: try Data(contentsOf: manifestURL),
                    directoryURL: directory
                )
                guard manifest.id == pluginId else {
                    disabled.append("\(pluginId): plugin manifest id must match directory name")
                    continue
                }
                plugins.append(manifest)
            } catch {
                disabled.append("\(pluginId): \(error.localizedDescription)")
            }
        }

        return PluginManifestLoadResult(plugins: plugins, disabled: disabled)
    }

    static func decodeManifest(data: Data, directoryURL: URL) throws -> PluginManifestDefinition {
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw PluginManifestError.invalidRoot
        }
        guard let version = object["version"] as? Int, version == 1 else {
            throw PluginManifestError.invalidField("version")
        }
        guard let id = nonEmptyString(object["id"]) else {
            throw PluginManifestError.invalidField("id")
        }
        guard let title = nonEmptyString(object["title"]) else {
            throw PluginManifestError.invalidField("title")
        }
        guard let lifecycleValue = nonEmptyString(object["lifecycle"]),
              let lifecycle = PluginLifecycle(rawValue: lifecycleValue) else {
            throw PluginManifestError.invalidField("lifecycle")
        }
        let kind = (object["kind"] as? String)
            .flatMap(PluginKind.init(rawValue:)) ?? .dynamicTool
        let enabled = object["enabled"] as? Bool ?? true
        guard let command = nonEmptyString(object["command"]) else {
            throw PluginManifestError.invalidField("command")
        }
        let args = (object["args"] as? [Any] ?? []).compactMap { $0 as? String }
        guard args.count == (object["args"] as? [Any] ?? []).count else {
            throw PluginManifestError.invalidField("args")
        }
        let provides = try decodeStringArray(object["provides"], field: "provides")
        let requires = try decodeStringArray(object["requires"], field: "requires")
        guard let rawTools = object["tools"] as? [[String: Any]], !rawTools.isEmpty else {
            throw PluginManifestError.invalidField("tools")
        }
        let tools = try rawTools.map(decodeTool)
        let duplicateKeys = Dictionary(grouping: tools, by: { "\($0.namespace).\($0.name)" })
            .filter { $0.value.count > 1 }
        guard duplicateKeys.isEmpty else {
            throw PluginManifestError.invalidField("tools")
        }

        return PluginManifestDefinition(
            version: version,
            id: id,
            title: title,
            description: object["description"] as? String,
            lifecycle: lifecycle,
            kind: kind,
            enabled: enabled,
            command: command,
            args: args,
            tools: tools,
            provides: provides,
            requires: requires,
            dataDirectoryName: object["dataDirectoryName"] as? String,
            directoryURL: directoryURL
        )
    }

    private static func decodeTool(_ object: [String: Any]) throws -> PluginToolDefinition {
        guard let namespace = nonEmptyIdentifier(object["namespace"]) else {
            throw PluginManifestError.invalidField("tools.namespace")
        }
        guard namespace != MacHostDynamicTools.namespace else {
            throw PluginManifestError.invalidField("tools.namespace")
        }
        guard let name = nonEmptyIdentifier(object["name"]) else {
            throw PluginManifestError.invalidField("tools.name")
        }
        guard let description = nonEmptyString(object["description"]) else {
            throw PluginManifestError.invalidField("tools.description")
        }
        let inputSchema = object["inputSchema"] as? [String: Any] ?? [
            "type": "object",
            "additionalProperties": true,
        ]
        return PluginToolDefinition(
            namespace: namespace,
            name: name,
            description: description,
            inputSchema: inputSchema
        )
    }

    private static func nonEmptyString(_ value: Any?) -> String? {
        guard let string = value as? String else { return nil }
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func nonEmptyIdentifier(_ value: Any?) -> String? {
        guard let string = nonEmptyString(value) else { return nil }
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-")
        guard string.rangeOfCharacter(from: allowed.inverted) == nil else { return nil }
        return string
    }

    private static func decodeStringArray(_ value: Any?, field: String) throws -> [String] {
        guard let value else { return [] }
        guard let array = value as? [Any] else {
            throw PluginManifestError.invalidField(field)
        }
        let strings = array.compactMap { $0 as? String }
        guard strings.count == array.count else {
            throw PluginManifestError.invalidField(field)
        }
        return strings
    }
}

enum PluginManifestError: LocalizedError {
    case invalidRoot
    case invalidField(String)

    var errorDescription: String? {
        switch self {
        case .invalidRoot:
            return "plugin manifest root must be an object"
        case .invalidField(let field):
            return "invalid plugin manifest field: \(field)"
        }
    }
}

struct PluginToolInvocationResult: @unchecked Sendable {
    let success: Bool
    let contentItems: [[String: Any]]
}

@MainActor
protocol PluginLifecycleProcessManaging: AnyObject {
    func start(_ manifest: PluginManifestDefinition) throws
    func stop(pluginId: String)
    func invokeRunningPlugin(
        manifest: PluginManifestDefinition,
        payload: [String: Any]
    ) async throws -> PluginToolInvocationResult
}

@MainActor
protocol PluginToolExecuting: AnyObject {
    func invoke(
        manifest: PluginManifestDefinition,
        tool: PluginToolDefinition,
        callId: String,
        arguments: Any?
    ) async throws -> PluginToolInvocationResult
}

@MainActor
protocol PluginDynamicToolManaging: AnyObject {
    var dynamicToolSpecs: [[String: Any]] { get }
    func reload()
    func handleTool(namespace: String?, tool: String, callId: String, arguments: Any?) async -> PluginToolInvocationResult?
}

@MainActor
final class PluginDynamicToolManager: PluginDynamicToolManaging {
    private let store: PluginManifestStore
    private let lifecycleManager: PluginLifecycleProcessManaging
    private let executor: PluginToolExecuting
    private var manifests: [PluginManifestDefinition] = []
    private var toolsByKey: [String: (PluginManifestDefinition, PluginToolDefinition)] = [:]

    init(
        store: PluginManifestStore = PluginManifestStore(),
        lifecycleManager: PluginLifecycleProcessManaging = ProcessPluginLifecycleManager(),
        executor: PluginToolExecuting = ProcessPluginToolExecutor()
    ) {
        self.store = store
        self.lifecycleManager = lifecycleManager
        self.executor = executor
    }

    var dynamicToolSpecs: [[String: Any]] {
        manifests.flatMap(\.dynamicToolSpecs)
    }

    func reload() {
        let previousRunningIds = Set(manifests.filter(Self.shouldRunAlwaysOn).map(\.id))
        let result = store.load()
        manifests = result.plugins
        rebuildToolIndex()

        let currentRunningIds = Set(manifests.filter(Self.shouldRunAlwaysOn).map(\.id))
        for stopped in previousRunningIds.subtracting(currentRunningIds) {
            lifecycleManager.stop(pluginId: stopped)
        }
        for manifest in manifests where Self.shouldRunAlwaysOn(manifest) {
            try? lifecycleManager.start(manifest)
        }
    }

    func handleTool(namespace: String?, tool: String, callId: String, arguments: Any?) async -> PluginToolInvocationResult? {
        guard let namespace,
              let (manifest, definition) = toolsByKey[Self.key(namespace: namespace, tool: tool)] else {
            return nil
        }
        do {
            try lifecycleManager.start(manifest)
        } catch {
            return failed(error.localizedDescription)
        }

        if manifest.lifecycle == .alwaysOn {
            do {
                return try await lifecycleManager.invokeRunningPlugin(
                    manifest: manifest,
                    payload: toolCallPayload(
                        manifest: manifest,
                        tool: definition,
                        callId: callId,
                        arguments: arguments
                    )
                )
            } catch {
                return failed(error.localizedDescription)
            }
        }

        defer {
            if manifest.lifecycle == .toolsOnly {
                lifecycleManager.stop(pluginId: manifest.id)
            }
        }
        do {
            return try await executor.invoke(
                manifest: manifest,
                tool: definition,
                callId: callId,
                arguments: arguments
            )
        } catch {
            return failed(error.localizedDescription)
        }
    }

    private func rebuildToolIndex() {
        toolsByKey = [:]
        for manifest in manifests where manifest.enabled {
            for tool in manifest.tools {
                toolsByKey[Self.key(namespace: tool.namespace, tool: tool.name)] = (manifest, tool)
            }
        }
    }

    private func toolCallPayload(
        manifest: PluginManifestDefinition,
        tool: PluginToolDefinition,
        callId: String,
        arguments: Any?
    ) -> [String: Any] {
        [
            "type": "tool_call",
            "id": callId,
            "pluginId": manifest.id,
            "namespace": tool.namespace,
            "tool": tool.name,
            "arguments": arguments ?? NSNull(),
        ]
    }

    private static func key(namespace: String, tool: String) -> String {
        "\(namespace).\(tool)"
    }

    private static func shouldRunAlwaysOn(_ manifest: PluginManifestDefinition) -> Bool {
        manifest.enabled && manifest.lifecycle == .alwaysOn
    }

    private func failed(_ message: String) -> PluginToolInvocationResult {
        PluginToolInvocationResult(
            success: false,
            contentItems: [[
                "type": "inputText",
                "text": message,
            ]]
        )
    }
}

@MainActor
final class ProcessPluginLifecycleManager: PluginLifecycleProcessManaging {
    private var processes: [String: RunningPluginProcess] = [:]

    func start(_ manifest: PluginManifestDefinition) throws {
        if let running = processes[manifest.id], running.process.isRunning {
            return
        }
        let process = Process()
        process.currentDirectoryURL = manifest.directoryURL
        process.executableURL = resolveCommand(manifest.command, directoryURL: manifest.directoryURL)
        process.arguments = manifest.args
        let stdin = Pipe()
        let stdout = Pipe()
        let stderr = Pipe()
        process.standardInput = stdin
        process.standardOutput = stdout
        process.standardError = stderr
        try process.run()
        processes[manifest.id] = RunningPluginProcess(
            process: process,
            stdin: stdin,
            stdout: stdout,
            stderr: stderr
        )
    }

    func stop(pluginId: String) {
        guard let running = processes.removeValue(forKey: pluginId) else { return }
        if running.process.isRunning {
            running.process.terminate()
        }
    }

    func invokeRunningPlugin(
        manifest: PluginManifestDefinition,
        payload: [String: Any]
    ) async throws -> PluginToolInvocationResult {
        guard let running = processes[manifest.id], running.process.isRunning else {
            throw PluginToolExecutionError.failed("plugin is not running: \(manifest.id)")
        }
        return try await running.invoke(payload: payload)
    }
}

@MainActor
private final class RunningPluginProcess {
    let process: Process
    private let stdin: Pipe
    private let stdout: Pipe
    private let stderr: Pipe

    init(process: Process, stdin: Pipe, stdout: Pipe, stderr: Pipe) {
        self.process = process
        self.stdin = stdin
        self.stdout = stdout
        self.stderr = stderr
    }

    func invoke(payload: [String: Any]) async throws -> PluginToolInvocationResult {
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let newline = "\n".data(using: .utf8) else {
            throw PluginToolExecutionError.failed("invalid plugin RPC payload")
        }
        let input = data + newline
        try stdin.fileHandleForWriting.write(contentsOf: input)
        let output = readLineData(from: stdout.fileHandleForReading)
        return ProcessPluginToolExecutor.decodeResult(output)
    }
}

@MainActor
final class ProcessPluginToolExecutor: PluginToolExecuting {
    func invoke(
        manifest: PluginManifestDefinition,
        tool: PluginToolDefinition,
        callId: String,
        arguments: Any?
    ) async throws -> PluginToolInvocationResult {
        let process = Process()
        process.currentDirectoryURL = manifest.directoryURL
        process.executableURL = resolveCommand(manifest.command, directoryURL: manifest.directoryURL)
        process.arguments = manifest.args

        let stdin = Pipe()
        let stdout = Pipe()
        let stderr = Pipe()
        process.standardInput = stdin
        process.standardOutput = stdout
        process.standardError = stderr

        try process.run()
        let payload: [String: Any] = [
            "type": "tool_call",
            "id": callId,
            "namespace": tool.namespace,
            "tool": tool.name,
            "arguments": arguments ?? NSNull(),
        ]
        if JSONSerialization.isValidJSONObject(payload),
           let data = try? JSONSerialization.data(withJSONObject: payload),
           let newline = "\n".data(using: .utf8) {
            stdin.fileHandleForWriting.write(data)
            stdin.fileHandleForWriting.write(newline)
        }
        try? stdin.fileHandleForWriting.close()
        process.waitUntilExit()

        let outputData = stdout.fileHandleForReading.readDataToEndOfFile()
        let errorData = stderr.fileHandleForReading.readDataToEndOfFile()
        if process.terminationStatus != 0 {
            let stderrText = String(data: errorData, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            throw PluginToolExecutionError.failed(stderrText ?? "plugin exited with status \(process.terminationStatus)")
        }
        return Self.decodeResult(outputData)
    }

    nonisolated static func decodeResult(_ data: Data) -> PluginToolInvocationResult {
        if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let contentItems = object["contentItems"] as? [[String: Any]] {
            return PluginToolInvocationResult(
                success: object["success"] as? Bool ?? true,
                contentItems: contentItems
            )
        }
        let text = String(data: data, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return PluginToolInvocationResult(
            success: true,
            contentItems: [[
                "type": "inputText",
                "text": text,
            ]]
        )
    }
}

enum PluginToolExecutionError: LocalizedError {
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .failed(let message):
            return message
        }
    }
}

private func resolveCommand(_ command: String, directoryURL: URL) -> URL {
    if command.hasPrefix("/") {
        return URL(fileURLWithPath: command)
    }
    return directoryURL.appendingPathComponent(command)
}

private func readLineData(from handle: FileHandle) -> Data {
    var data = Data()
    while true {
        let next = handle.readData(ofLength: 1)
        if next.isEmpty { break }
        if next == Data([0x0A]) { break }
        data.append(next)
    }
    return data
}
