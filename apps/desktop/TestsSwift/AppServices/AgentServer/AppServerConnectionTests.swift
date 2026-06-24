import XCTest
@testable import HandAgentDesktop

final class AppServerConnectionTests: XCTestCase {
    func testConnectOpensSocketAndEmitsConnectedState() {
        let transport = RecordingAppServerConnectionTransport()
        let connection = AppServerConnection(
            serverURL: URL(string: "ws://127.0.0.1:4317/api/dynamic-tools")!,
            transport: transport,
            reconnectDelay: 0
        )
        var states: [AppServerConnection.State] = []
        connection.onStateChange = { states.append($0) }

        connection.connect()

        XCTAssertEqual(transport.tasks.count, 1)
        XCTAssertEqual(states, [.connecting, .connected])
    }

    func testReceiveFailureReconnectsAndEmitsReconnectingThenConnected() {
        let transport = RecordingAppServerConnectionTransport()
        let connection = AppServerConnection(
            serverURL: URL(string: "ws://127.0.0.1:4317/api/dynamic-tools")!,
            transport: transport,
            reconnectDelay: 0
        )
        var states: [AppServerConnection.State] = []
        connection.onStateChange = { states.append($0) }

        connection.connect()
        transport.tasks[0].failReceive()

        XCTAssertEqual(transport.tasks.count, 2)
        XCTAssertEqual(states, [.connecting, .connected, .reconnecting, .connected])
    }

    func testManualDisconnectPreventsReconnectAfterReceiveFailure() {
        let transport = RecordingAppServerConnectionTransport()
        let connection = AppServerConnection(
            serverURL: URL(string: "ws://127.0.0.1:4317/api/dynamic-tools")!,
            transport: transport,
            reconnectDelay: 0
        )
        var states: [AppServerConnection.State] = []
        connection.onStateChange = { states.append($0) }

        connection.connect()
        connection.disconnect()
        transport.tasks[0].failReceive()

        XCTAssertEqual(transport.tasks.count, 1)
        XCTAssertEqual(states, [.connecting, .connected, .disconnected])
    }

    func testSendForwardsRawTextToSocketTask() {
        let transport = RecordingAppServerConnectionTransport()
        let connection = AppServerConnection(
            serverURL: URL(string: "ws://127.0.0.1:4317/api/dynamic-tools")!,
            transport: transport,
            reconnectDelay: 0
        )

        connection.connect()
        connection.send(text: #"{"type":"ping"}"#)

        XCTAssertEqual(transport.tasks[0].sentTexts, [#"{"type":"ping"}"#])
    }
}

@MainActor
final class DynamicToolProviderConnectionClientTests: XCTestCase {
    func testConnectSendsProviderHelloToDynamicToolsConnection() async {
        let transport = RecordingAppServerConnectionTransport()
        let connection = AppServerConnection(
            serverURL: URL(string: "ws://127.0.0.1:4317/api/dynamic-tools")!,
            transport: transport,
            reconnectDelay: 0
        )
        let client = DynamicToolProviderConnectionClient(
            connection: connection,
            providerService: DynamicToolProviderService(
                provider: RecordingAppServerClientPlatformProvider()
            )
        )

        client.connect()
        await Task.yield()

        let sent = transport.tasks[0].sentObjects
        XCTAssertEqual(sent.count, 1)
        XCTAssertEqual(sent[0]["channel"] as? String, "dynamic_tools")
        XCTAssertEqual(sent[0]["type"] as? String, "provider_hello")
        XCTAssertEqual(sent[0]["clientId"] as? String, "swift-host")
    }

    func testConnectionHandlesDynamicToolRequest() async {
        let transport = RecordingAppServerConnectionTransport()
        let connection = AppServerConnection(
            serverURL: URL(string: "ws://127.0.0.1:4317/api/dynamic-tools")!,
            transport: transport,
            reconnectDelay: 0
        )
        let provider = RecordingAppServerClientPlatformProvider(result: ["text": "hello"])
        let client = DynamicToolProviderConnectionClient(
            connection: connection,
            providerService: DynamicToolProviderService(provider: provider)
        )

        client.connect()
        transport.tasks[0].succeedReceive(
            """
            {
              "channel": "dynamic_tools",
              "type": "tool_call_request",
              "payload": {
                "clientId": "swift-host",
                "threadId": "thread-1",
                "turnId": "turn-1",
                "callId": "call-1",
                "namespace": "host_macos",
                "tool": "clipboard_read",
                "arguments": {}
              }
            }
            """
        )
        await Task.yield()

        XCTAssertEqual(provider.calls.map(\.method), ["clipboard.read"])
        let response = transport.tasks[0].sentObjects[1]
        XCTAssertEqual(response["channel"] as? String, "dynamic_tools")
        XCTAssertEqual(response["type"] as? String, "tool_call_response")
        let payload = response["payload"] as? [String: Any]
        XCTAssertEqual(payload?["callId"] as? String, "call-1")
        XCTAssertEqual(payload?["success"] as? Bool, true)
    }
}

@MainActor
final class SwiftThreadClientTests: XCTestCase {
    func testSubmitInitialPromptFailsWhenThreadSocketIsNotConnected() async throws {
        let transport = RecordingAppServerConnectionTransport()
        let connection = AppServerConnection(
            serverURL: URL(string: "ws://127.0.0.1:4317/api/thread")!,
            transport: transport,
            reconnectDelay: 0
        )
        let client = SwiftThreadClient(connection: connection)

        do {
            _ = try await client.submitInitialPrompt(makePromptSubmission("hello"))
            XCTFail("Expected disconnected thread client to fail")
        } catch let error as SwiftThreadClientError {
            XCTAssertEqual(error.errorDescription, "Thread connection disconnected")
        }
        XCTAssertTrue(transport.tasks.isEmpty)
    }

    func testSubmitInitialPromptStartsThreadWithHostDynamicToolsThenSubmitsOp() async throws {
        let transport = RecordingAppServerConnectionTransport()
        let connection = AppServerConnection(
            serverURL: URL(string: "ws://127.0.0.1:4317/api/thread")!,
            transport: transport,
            reconnectDelay: 0
        )
        let client = SwiftThreadClient(connection: connection)
        client.connect()

        let task = Task { @MainActor in
            try await client.submitInitialPrompt(makePromptSubmission("hello"))
        }
        await Task.yield()

        let start = transport.tasks[0].sentObjects[0]
        XCTAssertEqual(start["type"] as? String, "thread.start")
        let startPayload = start["payload"] as? [String: Any]
        let dynamicTools = startPayload?["dynamicTools"] as? [[String: Any]]
        XCTAssertEqual(dynamicTools?.count, 8)
        XCTAssertTrue(dynamicTools?.contains { $0["name"] as? String == "screen_capture" } == true)

        transport.tasks[0].succeedReceive(
            """
            {
              "type": "thread.started",
              "threadId": "thread-1",
              "notificationId": "n1",
              "commandId": "\(start["commandId"] as? String ?? "")",
              "timestamp": "2026-06-24T00:00:00.000Z",
              "payload": { "preview": null }
            }
            """
        )

        let threadId = try await task.value
        XCTAssertEqual(threadId, "thread-1")
        let submit = transport.tasks[0].sentObjects[1]
        XCTAssertEqual(submit["type"] as? String, "op.submit")
        XCTAssertEqual(submit["threadId"] as? String, "thread-1")
        let submitPayload = submit["payload"] as? [String: Any]
        let op = submitPayload?["op"] as? [String: Any]
        XCTAssertEqual(op?["type"] as? String, "user_input")
    }

    func testSubmitInitialPromptIncludesPluginDynamicToolsFromProvider() async throws {
        let transport = RecordingAppServerConnectionTransport()
        let connection = AppServerConnection(
            serverURL: URL(string: "ws://127.0.0.1:4317/api/thread")!,
            transport: transport,
            reconnectDelay: 0
        )
        let client = SwiftThreadClient(
            connection: connection,
            dynamicToolsProvider: {
                MacHostDynamicTools.toolSpecs + [[
                    "clientId": "swift-host",
                    "namespace": "screen_reader",
                    "name": "snapshot",
                    "description": "Read the current screen.",
                    "inputSchema": ["type": "object"],
                ]]
            }
        )
        client.connect()

        let task = Task { @MainActor in
            try await client.submitInitialPrompt(makePromptSubmission("hello"))
        }
        await Task.yield()

        let start = transport.tasks[0].sentObjects[0]
        let startPayload = start["payload"] as? [String: Any]
        let dynamicTools = startPayload?["dynamicTools"] as? [[String: Any]]
        XCTAssertEqual(dynamicTools?.count, 9)
        XCTAssertTrue(dynamicTools?.contains {
            $0["namespace"] as? String == "screen_reader" && $0["name"] as? String == "snapshot"
        } == true)

        transport.tasks[0].succeedReceive(
            """
            {
              "type": "thread.started",
              "threadId": "thread-1",
              "notificationId": "n1",
              "commandId": "\(start["commandId"] as? String ?? "")",
              "timestamp": "2026-06-24T00:00:00.000Z",
              "payload": { "preview": null }
            }
            """
        )
        _ = try await task.value
    }
}

@MainActor
private func makePromptSubmission(_ text: String) -> PromptSubmission {
    PromptSubmission(
        userInput: PromptUserInput(items: [.text(id: "text-1", text: text)]),
        summary: text
    )
}

private final class RecordingAppServerConnectionTransport: AppServerConnectionTransport {
    private(set) var tasks: [RecordingAppServerConnectionTask] = []

    func makeWebSocketTask(with url: URL) -> any AppServerWebSocketTask {
        let task = RecordingAppServerConnectionTask()
        tasks.append(task)
        return task
    }
}

private final class RecordingAppServerConnectionTask: AppServerWebSocketTask {
    private var receiveHandler: ((Result<URLSessionWebSocketTask.Message, Error>) -> Void)?
    private(set) var sentTexts: [String] = []
    var sentObjects: [[String: Any]] {
        sentTexts.compactMap { text in
            guard let data = text.data(using: .utf8) else { return nil }
            return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        }
    }

    func resume() {}

    func cancel(with closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {}

    func send(
        _ message: URLSessionWebSocketTask.Message,
        completionHandler: @escaping @Sendable (Error?) -> Void
    ) {
        if case .string(let text) = message {
            sentTexts.append(text)
        }
        completionHandler(nil)
    }

    func receive(
        completionHandler: @escaping @Sendable (Result<URLSessionWebSocketTask.Message, Error>) -> Void
    ) {
        receiveHandler = completionHandler
    }

    func failReceive() {
        receiveHandler?(.failure(URLError(.cannotConnectToHost)))
    }

    func succeedReceive(_ text: String) {
        receiveHandler?(.success(.string(text)))
    }
}

@MainActor
private final class RecordingAppServerClientPlatformProvider: PlatformProvider {
    private(set) var calls: [(method: String, args: Any?)] = []
    let result: Any
    let error: Error?

    init(result: Any = [:] as [String: Any], error: Error? = nil) {
        self.result = result
        self.error = error
    }

    func handle(method: String, args: Any?) async throws -> Any? {
        calls.append((method: method, args: args))
        if let error {
            throw error
        }
        return result
    }
}
