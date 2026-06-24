import Foundation

@MainActor
protocol SwiftThreadSubmitting: AnyObject {
    func connect()
    func disconnect()
    func submitInitialPrompt(_ prompt: PromptSubmission) async throws -> String
}

enum SwiftThreadClientError: Error, LocalizedError {
    case startFailed(String)
    case invalidUserInput

    var errorDescription: String? {
        switch self {
        case .startFailed(let message):
            return message
        case .invalidUserInput:
            return "Failed to encode user input"
        }
    }
}

@MainActor
final class SwiftThreadClient: SwiftThreadSubmitting {
    private let connection: AppServerConnection
    private let dynamicToolsProvider: @MainActor () -> [[String: Any]]
    private var pendingStarts: [String: CheckedContinuation<String, Error>] = [:]

    init(
        connection: AppServerConnection,
        dynamicToolsProvider: @escaping @MainActor () -> [[String: Any]] = { MacHostDynamicTools.toolSpecs }
    ) {
        self.connection = connection
        self.dynamicToolsProvider = dynamicToolsProvider
        connection.onTextMessage = { [weak self] text in
            Task { @MainActor in
                self?.handleIncoming(raw: text)
            }
        }
    }

    func connect() {
        connection.connect()
    }

    func disconnect() {
        for (_, continuation) in pendingStarts {
            continuation.resume(throwing: SwiftThreadClientError.startFailed("Thread connection disconnected"))
        }
        pendingStarts.removeAll()
        connection.disconnect()
    }

    func submitInitialPrompt(_ prompt: PromptSubmission) async throws -> String {
        let commandId = UUID().uuidString
        let timestamp = Self.timestamp()
        let threadId = try await startThread(commandId: commandId, timestamp: timestamp)
        try submitUserInput(threadId: threadId, commandId: UUID().uuidString, opId: commandId, prompt: prompt)
        return threadId
    }

    private func startThread(commandId: String, timestamp: String) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            pendingStarts[commandId] = continuation
            connection.send(text: encodeJSON([
                "type": "thread.start",
                "commandId": commandId,
                "timestamp": timestamp,
                "payload": [
                    "workspaceId": NSNull(),
                    "dynamicTools": dynamicToolsProvider(),
                ],
            ]))
        }
    }

    private func submitUserInput(
        threadId: String,
        commandId: String,
        opId: String,
        prompt: PromptSubmission
    ) throws {
        let userInputObject = try jsonObject(prompt.userInput)
        connection.send(text: encodeJSON([
            "type": "op.submit",
            "threadId": threadId,
            "commandId": commandId,
            "timestamp": Self.timestamp(),
            "payload": [
                "op": [
                    "type": "user_input",
                    "opId": opId,
                    "timestamp": Self.timestamp(),
                    "payload": userInputObject,
                ],
            ],
        ]))
    }

    private func handleIncoming(raw: String) {
        guard let data = raw.data(using: .utf8),
              let envelope = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = envelope["type"] as? String else {
            return
        }

        switch type {
        case "thread.started":
            guard let commandId = envelope["commandId"] as? String,
                  let threadId = envelope["threadId"] as? String,
                  let continuation = pendingStarts.removeValue(forKey: commandId) else {
                return
            }
            continuation.resume(returning: threadId)
        case "thread.error":
            guard let commandId = envelope["commandId"] as? String,
                  let continuation = pendingStarts.removeValue(forKey: commandId) else {
                return
            }
            let payload = envelope["payload"] as? [String: Any]
            let message = payload?["message"] as? String ?? "Thread creation failed"
            continuation.resume(throwing: SwiftThreadClientError.startFailed(message))
        default:
            break
        }
    }

    private func jsonObject<T: Encodable>(_ value: T) throws -> Any {
        let data = try JSONEncoder().encode(value)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SwiftThreadClientError.invalidUserInput
        }
        return object
    }

    private func encodeJSON(_ object: [String: Any]) -> String {
        guard
            JSONSerialization.isValidJSONObject(object),
            let data = try? JSONSerialization.data(withJSONObject: object, options: []),
            let string = String(data: data, encoding: .utf8)
        else {
            return "{}"
        }
        return string
    }

    private static func timestamp() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}

@MainActor
final class NopSwiftThreadClient: SwiftThreadSubmitting {
    func connect() {}
    func disconnect() {}

    func submitInitialPrompt(_ prompt: PromptSubmission) async throws -> String {
        _ = prompt
        return "noop-thread"
    }
}
