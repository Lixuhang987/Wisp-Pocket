import XCTest
@testable import HandAgentDesktop

@MainActor
final class PluginDynamicToolsTests: XCTestCase {
    func testBuiltinInstallerWritesContextHistoryAndAtomicPluginsWithContextHistoryDisabledByDefault() throws {
        let root = try makePluginsDirectory()

        BuiltinPluginInstaller(pluginsDirectoryURL: root).ensureInstalled()
        let result = PluginManifestStore(pluginsDirectoryURL: root).load()

        XCTAssertEqual(result.disabled, [])
        XCTAssertTrue(Set(result.plugins.map(\.id)).isSuperset(of: [
            "handagent-atomic-app-window",
            "handagent-atomic-screenshot",
            "handagent-atomic-ax",
            "handagent-context-history",
        ]))
        let contextHistory = try XCTUnwrap(result.plugins.first { $0.id == "handagent-context-history" })
        XCTAssertEqual(contextHistory.lifecycle, .alwaysOn)
        XCTAssertEqual(contextHistory.kind, .dynamicTool)
        XCTAssertEqual(contextHistory.enabled, false)
        XCTAssertEqual(contextHistory.requires, ["app_window", "screenshot", "ax"])
        XCTAssertEqual(Set(contextHistory.tools.map(\.namespace)), ["context_history"])

        let atomicPlugins = result.plugins.filter { $0.kind == .atomicCapability }
        XCTAssertEqual(atomicPlugins.count, 3)
        XCTAssertTrue(atomicPlugins.allSatisfy(\.enabled))
        let appWindow = try XCTUnwrap(result.plugins.first { $0.id == "handagent-atomic-app-window" })
        XCTAssertEqual(Set(appWindow.tools.map(\.name)), ["frontmost", "list_windows", "activate"])
    }

    func testBuiltinInstallerWritesAutomationRuntimeDisabledByDefault() throws {
        let root = try makePluginsDirectory()

        BuiltinPluginInstaller(pluginsDirectoryURL: root).ensureInstalled()
        let result = PluginManifestStore(pluginsDirectoryURL: root).load()
        let automation = try XCTUnwrap(result.plugins.first { $0.id == "handagent-automation-runtime" })

        XCTAssertEqual(automation.lifecycle, .alwaysOn)
        XCTAssertEqual(automation.kind, .automation)
        XCTAssertEqual(automation.enabled, false)
        XCTAssertEqual(automation.requires, ["app_window", "screenshot", "ax"])
        XCTAssertEqual(Set(automation.tools.map(\.namespace)), ["automation"])
        XCTAssertEqual(Set(automation.tools.map(\.name)), [
            "record_start",
            "record_event",
            "record_stop",
            "policy_create",
            "run",
            "history",
            "apply_patch",
        ])
    }

    func testBuiltinInstallerRepairsManifestWithoutOverwritingEnabledChoice() throws {
        let root = try makePluginsDirectory()
        try writePluginManifest(
            root: root,
            id: "handagent-context-history",
            lifecycle: "alwaysOn",
            enabled: true,
            tools: [
                [
                    "namespace": "broken",
                    "name": "old",
                    "description": "Old tool.",
                    "inputSchema": ["type": "object"],
                ],
            ]
        )

        BuiltinPluginInstaller(pluginsDirectoryURL: root).ensureInstalled()
        let result = PluginManifestStore(pluginsDirectoryURL: root).load()
        let contextHistory = try XCTUnwrap(result.plugins.first { $0.id == "handagent-context-history" })

        XCTAssertEqual(contextHistory.enabled, true)
        XCTAssertEqual(Set(contextHistory.tools.map(\.name)), [
            "activity_index",
            "sample_details",
            "thumbnails",
            "screenshot_original",
        ])
    }

    func testManifestStoreLoadsPluginToolsAsSwiftProviderDynamicTools() throws {
        let root = try makePluginsDirectory()
        try writePluginManifest(
            root: root,
            id: "screen-reader",
            lifecycle: "alwaysOn",
            tools: [
                [
                    "namespace": "screen_reader",
                    "name": "snapshot",
                    "description": "Read the current screen.",
                    "inputSchema": ["type": "object"],
                ],
            ]
        )

        let result = PluginManifestStore(pluginsDirectoryURL: root).load()

        XCTAssertEqual(result.disabled, [])
        XCTAssertEqual(result.plugins.count, 1)
        XCTAssertEqual(result.plugins[0].id, "screen-reader")
        XCTAssertEqual(result.plugins[0].lifecycle, .alwaysOn)
        XCTAssertEqual(result.plugins[0].dynamicToolSpecs.count, 1)
        XCTAssertEqual(result.plugins[0].dynamicToolSpecs[0]["clientId"] as? String, "swift-host")
        XCTAssertEqual(result.plugins[0].dynamicToolSpecs[0]["namespace"] as? String, "screen_reader")
    }

    func testPluginManagerStartsAlwaysOnPluginsAndDispatchesToolCalls() async throws {
        let root = try makePluginsDirectory()
        try writePluginManifest(
            root: root,
            id: "screen-reader",
            lifecycle: "alwaysOn",
            tools: [
                [
                    "namespace": "screen_reader",
                    "name": "snapshot",
                    "description": "Read the current screen.",
                    "inputSchema": ["type": "object"],
                ],
            ]
        )
        let lifecycle = RecordingPluginLifecycleManager(result: PluginToolInvocationResult(
            success: true,
            contentItems: [["type": "inputText", "text": "running plugin result"]]
        ))
        let executor = RecordingPluginToolExecutor(result: PluginToolInvocationResult(
            success: true,
            contentItems: [["type": "inputText", "text": "plugin result"]]
        ))
        let manager = PluginDynamicToolManager(
            store: PluginManifestStore(pluginsDirectoryURL: root),
            lifecycleManager: lifecycle,
            executor: executor
        )

        manager.reload()
        let result = await manager.handleTool(
            namespace: "screen_reader",
            tool: "snapshot",
            callId: "call-1",
            arguments: ["target": "frontmost"]
        )

        XCTAssertEqual(Set(lifecycle.started), ["screen-reader"])
        XCTAssertEqual(result?.success, true)
        XCTAssertEqual(lifecycle.runningInvocations.count, 1)
        XCTAssertEqual(lifecycle.runningInvocations[0].manifestId, "screen-reader")
        XCTAssertEqual(lifecycle.runningInvocations[0].payload["tool"] as? String, "snapshot")
        let contentItems = result?.contentItems
        XCTAssertEqual(contentItems?.first?["text"] as? String, "running plugin result")
        XCTAssertEqual(executor.invocations.count, 0)
    }

    func testEnabledContextHistoryPluginStartsAtomicPluginsAndRoutesQueriesThroughRunningRPC() async throws {
        let root = try makePluginsDirectory()
        BuiltinPluginInstaller(pluginsDirectoryURL: root).ensureInstalled()
        try setManifestEnabled(root: root, id: "handagent-context-history", enabled: true)
        let lifecycle = RecordingPluginLifecycleManager(result: PluginToolInvocationResult(
            success: true,
            contentItems: [["type": "inputText", "text": "{\"samples\":[]}"]]
        ))
        let executor = RecordingPluginToolExecutor(result: PluginToolInvocationResult(
            success: true,
            contentItems: [["type": "inputText", "text": "one-shot"]]
        ))
        let manager = PluginDynamicToolManager(
            store: PluginManifestStore(pluginsDirectoryURL: root),
            lifecycleManager: lifecycle,
            executor: executor
        )

        manager.reload()
        let result = await manager.handleTool(
            namespace: "context_history",
            tool: "activity_index",
            callId: "call-context",
            arguments: ["limit": 5]
        )

        XCTAssertEqual(Set(lifecycle.started), [
            "handagent-atomic-app-window",
            "handagent-atomic-screenshot",
            "handagent-atomic-ax",
            "handagent-context-history",
        ])
        XCTAssertEqual(result?.success, true)
        XCTAssertEqual(lifecycle.runningInvocations.count, 1)
        XCTAssertEqual(lifecycle.runningInvocations[0].manifestId, "handagent-context-history")
        XCTAssertEqual(lifecycle.runningInvocations[0].payload["namespace"] as? String, "context_history")
        XCTAssertEqual(lifecycle.runningInvocations[0].payload["tool"] as? String, "activity_index")
        XCTAssertEqual(executor.invocations.count, 0)
    }

    func testReloadStopsAlwaysOnPluginWhenManifestIsDisabled() throws {
        let root = try makePluginsDirectory()
        BuiltinPluginInstaller(pluginsDirectoryURL: root).ensureInstalled()
        try setManifestEnabled(root: root, id: "handagent-context-history", enabled: true)
        let lifecycle = RecordingPluginLifecycleManager()
        let manager = PluginDynamicToolManager(
            store: PluginManifestStore(pluginsDirectoryURL: root),
            lifecycleManager: lifecycle,
            executor: RecordingPluginToolExecutor(result: PluginToolInvocationResult(
                success: true,
                contentItems: [["type": "inputText", "text": "unused"]]
            ))
        )

        manager.reload()
        try setManifestEnabled(root: root, id: "handagent-context-history", enabled: false)
        manager.reload()

        XCTAssertTrue(lifecycle.stopped.contains("handagent-context-history"))
        XCTAssertFalse(manager.dynamicToolSpecs.contains { $0["namespace"] as? String == "context_history" })
    }

    func testDynamicToolProviderHelloIncludesPluginToolsAndRoutesPluginRequests() async throws {
        let root = try makePluginsDirectory()
        try writePluginManifest(
            root: root,
            id: "screen-reader",
            lifecycle: "toolsOnly",
            tools: [
                [
                    "namespace": "screen_reader",
                    "name": "snapshot",
                    "description": "Read the current screen.",
                    "inputSchema": ["type": "object"],
                ],
            ]
        )
        let lifecycle = RecordingPluginLifecycleManager()
        let executor = RecordingPluginToolExecutor(result: PluginToolInvocationResult(
            success: true,
            contentItems: [["type": "inputText", "text": "screen text"]]
        ))
        let manager = PluginDynamicToolManager(
            store: PluginManifestStore(pluginsDirectoryURL: root),
            lifecycleManager: lifecycle,
            executor: executor
        )
        manager.reload()
        let service = DynamicToolProviderService(
            provider: RecordingPluginTestPlatformProvider(),
            pluginManager: manager
        )

        let hello = decodeObject(service.makeHelloMessage())
        let tools = hello["tools"] as? [[String: Any]]
        XCTAssertEqual(tools?.count, 9)
        XCTAssertTrue(tools?.contains { $0["namespace"] as? String == "screen_reader" } == true)

        var sentObjects: [[String: Any]] = []
        await service.handleIncoming(
            raw:
            """
            {
              "channel": "dynamic_tools",
              "type": "tool_call_request",
              "payload": {
                "clientId": "swift-host",
                "threadId": "thread-1",
                "turnId": "turn-1",
                "callId": "call-1",
                "namespace": "screen_reader",
                "tool": "snapshot",
                "arguments": {}
              }
            }
            """,
            send: { sentObjects.append(self.decodeObject($0)) }
        )

        XCTAssertEqual(lifecycle.started, ["screen-reader"])
        XCTAssertEqual(lifecycle.stopped, ["screen-reader"])
        XCTAssertEqual(executor.invocations.count, 1)
        let payload = sentObjects[0]["payload"] as? [String: Any]
        XCTAssertEqual(payload?["success"] as? Bool, true)
        let contentItems = payload?["contentItems"] as? [[String: Any]]
        XCTAssertEqual(contentItems?.first?["text"] as? String, "screen text")
    }

    private func makePluginsDirectory() throws -> URL {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("handagent-plugin-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }

    private func writePluginManifest(
        root: URL,
        id: String,
        lifecycle: String,
        enabled: Bool? = nil,
        tools: [[String: Any]]
    ) throws {
        let directory = root.appendingPathComponent(id, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var manifest: [String: Any] = [
            "version": 1,
            "id": id,
            "title": "Screen Reader",
            "description": "Read screen content.",
            "lifecycle": lifecycle,
            "command": "bin/screen-reader",
            "args": [],
            "tools": tools,
        ]
        if let enabled {
            manifest["enabled"] = enabled
        }
        let data = try JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: directory.appendingPathComponent("plugin.json"))
    }

    private func setManifestEnabled(root: URL, id: String, enabled: Bool) throws {
        let manifestURL = root
            .appendingPathComponent(id, isDirectory: true)
            .appendingPathComponent("plugin.json")
        let data = try Data(contentsOf: manifestURL)
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        object["enabled"] = enabled
        let nextData = try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys])
        try nextData.write(to: manifestURL)
    }

    private func decodeObject(_ text: String) -> [String: Any] {
        guard let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            XCTFail("Expected JSON object")
            return [:]
        }
        return object
    }
}

@MainActor
private final class RecordingPluginLifecycleManager: PluginLifecycleProcessManaging {
    struct RunningInvocation {
        let manifestId: String
        let payload: [String: Any]
    }

    private(set) var started: [String] = []
    private(set) var stopped: [String] = []
    private(set) var runningInvocations: [RunningInvocation] = []
    let result: PluginToolInvocationResult

    init(result: PluginToolInvocationResult = PluginToolInvocationResult(
        success: true,
        contentItems: [["type": "inputText", "text": "running"]]
    )) {
        self.result = result
    }

    func start(_ manifest: PluginManifestDefinition) throws {
        started.append(manifest.id)
    }

    func stop(pluginId: String) {
        stopped.append(pluginId)
    }

    func invokeRunningPlugin(
        manifest: PluginManifestDefinition,
        payload: [String: Any]
    ) async throws -> PluginToolInvocationResult {
        runningInvocations.append(RunningInvocation(manifestId: manifest.id, payload: payload))
        return result
    }
}

@MainActor
private final class RecordingPluginToolExecutor: PluginToolExecuting {
    struct Invocation {
        let manifestId: String
        let toolName: String
        let callId: String
        let arguments: Any?
    }

    private(set) var invocations: [Invocation] = []
    let result: PluginToolInvocationResult

    init(result: PluginToolInvocationResult) {
        self.result = result
    }

    func invoke(
        manifest: PluginManifestDefinition,
        tool: PluginToolDefinition,
        callId: String,
        arguments: Any?
    ) async throws -> PluginToolInvocationResult {
        invocations.append(Invocation(
            manifestId: manifest.id,
            toolName: tool.name,
            callId: callId,
            arguments: arguments
        ))
        return result
    }
}

private final class RecordingPluginTestPlatformProvider: PlatformProvider {
    func handle(method: String, args: Any?) async throws -> Any? {
        _ = method
        _ = args
        return [:] as [String: Any]
    }
}
