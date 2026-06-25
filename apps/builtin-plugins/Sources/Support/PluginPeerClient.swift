import Foundation

public final class LocalManifestPluginPeerClient: ContextHistoryCapabilityCalling, AutomationCapabilityCalling, @unchecked Sendable {
    private let pluginsDirectoryURL: URL
    private let fileManager: FileManager

    public init(
        pluginsDirectoryURL: URL = FileManager.default
            .homeDirectoryForCurrentUser
            .appendingPathComponent(".spotAgent/plugins", isDirectory: true),
        fileManager: FileManager = .default
    ) {
        self.pluginsDirectoryURL = pluginsDirectoryURL
        self.fileManager = fileManager
    }

    public func call(namespace: String, tool: String, arguments: [String: Any]) async throws -> [String: Any] {
        let manifest = try findManifest(namespace: namespace, tool: tool)
        let result = try invoke(manifest: manifest, namespace: namespace, tool: tool, arguments: arguments)
        guard result.success else {
            throw NSError(
                domain: "LocalManifestPluginPeerClient",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: firstText(result) ?? "plugin peer call failed"]
            )
        }
        guard let text = firstText(result),
              let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return ["text": firstText(result) ?? ""]
        }
        return object
    }

    private func findManifest(namespace: String, tool: String) throws -> PeerPluginManifest {
        let directories = try fileManager.contentsOfDirectory(
            at: pluginsDirectoryURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        )
        for directory in directories {
            let manifestURL = directory.appendingPathComponent("plugin.json")
            guard let data = try? Data(contentsOf: manifestURL),
                  let manifest = try? PeerPluginManifest(data: data, directoryURL: directory),
                  manifest.enabled,
                  manifest.tools.contains(where: { $0.namespace == namespace && $0.name == tool }) else {
                continue
            }
            return manifest
        }
        throw NSError(
            domain: "LocalManifestPluginPeerClient",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "No enabled plugin provides \(namespace).\(tool)"]
        )
    }

    private func invoke(
        manifest: PeerPluginManifest,
        namespace: String,
        tool: String,
        arguments: [String: Any]
    ) throws -> PluginToolResult {
        let process = Process()
        process.currentDirectoryURL = manifest.directoryURL
        process.executableURL = manifest.command.hasPrefix("/")
            ? URL(fileURLWithPath: manifest.command)
            : manifest.directoryURL.appendingPathComponent(manifest.command)
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
            "id": UUID().uuidString,
            "namespace": namespace,
            "tool": tool,
            "arguments": arguments,
        ]
        let data = try JSONSerialization.data(withJSONObject: payload)
        stdin.fileHandleForWriting.write(data)
        stdin.fileHandleForWriting.write(Data([0x0A]))
        try? stdin.fileHandleForWriting.close()
        process.waitUntilExit()
        if process.terminationStatus != 0 {
            let message = String(data: stderr.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            throw NSError(
                domain: "LocalManifestPluginPeerClient",
                code: Int(process.terminationStatus),
                userInfo: [NSLocalizedDescriptionKey: message]
            )
        }
        let output = stdout.fileHandleForReading.readDataToEndOfFile()
        guard let object = try? JSONSerialization.jsonObject(with: output) as? [String: Any],
              let contentItems = object["contentItems"] as? [[String: Any]] else {
            return .text(String(data: output, encoding: .utf8) ?? "")
        }
        return PluginToolResult(
            success: object["success"] as? Bool ?? true,
            contentItems: contentItems
        )
    }

    private func firstText(_ result: PluginToolResult) -> String? {
        result.contentItems.first?["text"] as? String
    }
}
private struct PeerPluginManifest {
    struct Tool {
        let namespace: String
        let name: String
    }

    let enabled: Bool
    let command: String
    let args: [String]
    let tools: [Tool]
    let directoryURL: URL

    init(data: Data, directoryURL: URL) throws {
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NSError(domain: "PeerPluginManifest", code: 1)
        }
        self.enabled = object["enabled"] as? Bool ?? true
        self.command = object["command"] as? String ?? ""
        self.args = object["args"] as? [String] ?? []
        self.tools = (object["tools"] as? [[String: Any]] ?? []).compactMap { tool in
            guard let namespace = tool["namespace"] as? String,
                  let name = tool["name"] as? String else {
                return nil
            }
            return Tool(namespace: namespace, name: name)
        }
        self.directoryURL = directoryURL
    }
}
