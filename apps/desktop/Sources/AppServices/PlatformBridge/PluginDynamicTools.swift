import Foundation

enum PluginLifecycle: String {
    case alwaysOn
    case onDemand
    case toolsOnly
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
    let command: String
    let args: [String]
    let tools: [PluginToolDefinition]
    let directoryURL: URL

    var dynamicToolSpecs: [[String: Any]] {
        tools.map { tool in
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
        guard let command = nonEmptyString(object["command"]) else {
            throw PluginManifestError.invalidField("command")
        }
        let args = (object["args"] as? [Any] ?? []).compactMap { $0 as? String }
        guard args.count == (object["args"] as? [Any] ?? []).count else {
            throw PluginManifestError.invalidField("args")
        }
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
            command: command,
            args: args,
            tools: tools,
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

struct PluginToolInvocationResult {
    let success: Bool
    let contentItems: [[String: Any]]
}

@MainActor
protocol PluginLifecycleProcessManaging: AnyObject {
    func start(_ manifest: PluginManifestDefinition) throws
    func stop(pluginId: String)
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
        let previousIds = Set(manifests.map(\.id))
        let result = store.load()
        manifests = result.plugins
        rebuildToolIndex()

        let currentIds = Set(manifests.map(\.id))
        for removed in previousIds.subtracting(currentIds) {
            lifecycleManager.stop(pluginId: removed)
        }
        for manifest in manifests where manifest.lifecycle == .alwaysOn {
            try? lifecycleManager.start(manifest)
        }
    }

    func handleTool(namespace: String?, tool: String, callId: String, arguments: Any?) async -> PluginToolInvocationResult? {
        guard let namespace,
              let (manifest, definition) = toolsByKey[Self.key(namespace: namespace, tool: tool)] else {
            return nil
        }
        if manifest.lifecycle == .onDemand || manifest.lifecycle == .toolsOnly {
            do {
                try lifecycleManager.start(manifest)
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
        for manifest in manifests {
            for tool in manifest.tools {
                toolsByKey[Self.key(namespace: tool.namespace, tool: tool.name)] = (manifest, tool)
            }
        }
    }

    private static func key(namespace: String, tool: String) -> String {
        "\(namespace).\(tool)"
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
    private var processes: [String: Process] = [:]

    func start(_ manifest: PluginManifestDefinition) throws {
        if let process = processes[manifest.id], process.isRunning {
            return
        }
        let process = Process()
        process.currentDirectoryURL = manifest.directoryURL
        process.executableURL = resolveCommand(manifest.command, directoryURL: manifest.directoryURL)
        process.arguments = manifest.args
        process.standardInput = Pipe()
        process.standardOutput = Pipe()
        process.standardError = Pipe()
        try process.run()
        processes[manifest.id] = process
    }

    func stop(pluginId: String) {
        guard let process = processes.removeValue(forKey: pluginId) else { return }
        if process.isRunning {
            process.terminate()
        }
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

    private static func decodeResult(_ data: Data) -> PluginToolInvocationResult {
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
