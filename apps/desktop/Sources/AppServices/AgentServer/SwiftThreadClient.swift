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
final class SwiftThreadClient: SwiftThreadSubmitting, PetManaging {
    private let connection: AppServerConnection
    private let dynamicToolsProvider: @MainActor () -> [[String: Any]]
    private var pendingPetCommands: [String: CheckedContinuation<Data, Error>] = [:]
    private var petTimeouts: [String: Task<Void, Never>] = [:]
    private var pendingStarts: [String: CheckedContinuation<String, Error>] = [:]

    init(
        connection: AppServerConnection,
        dynamicToolsProvider: @escaping @MainActor () -> [[String: Any]] = { MacHostDynamicTools.toolSpecs }
    ) {
        self.connection = connection
        self.dynamicToolsProvider = dynamicToolsProvider
        connection.onStateChange = { [weak self] state in
            guard state == .disconnected || state == .reconnecting else { return }
            Task { @MainActor in self?.failPendingRequests() }
        }
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
        failPendingRequests()
        connection.disconnect()
    }

    private func failPendingRequests() {
        for (_, continuation) in pendingStarts {
            continuation.resume(throwing: SwiftThreadClientError.startFailed("Thread connection disconnected"))
        }
        pendingStarts.removeAll()
        for continuation in pendingPetCommands.values {
            continuation.resume(throwing: SwiftThreadClientError.startFailed("桌宠连接已断开"))
        }
        pendingPetCommands.removeAll()
        petTimeouts.values.forEach { $0.cancel() }
        petTimeouts.removeAll()
    }

    func submitInitialPrompt(_ prompt: PromptSubmission) async throws -> String {
        let commandId = UUID().uuidString
        let timestamp = Self.timestamp()
        let petId: String
        if let target = prompt.targetPetId { petId = target }
        else {
            guard let defaultPet = try await listPets().first(where: \.isDefault) else {
                throw SwiftThreadClientError.startFailed("未找到默认桌宠")
            }
            petId = defaultPet.id
        }
        let threadId = try await startThread(commandId: commandId, timestamp: timestamp, petId: petId)
        try submitUserInput(threadId: threadId, commandId: UUID().uuidString, opId: commandId, prompt: prompt)
        return threadId
    }

    private func startThread(commandId: String, timestamp: String, petId: String) async throws -> String {
        guard connection.connectionState == .connected else {
            throw SwiftThreadClientError.startFailed("Thread connection disconnected")
        }
        return try await withCheckedThrowingContinuation { continuation in
            pendingStarts[commandId] = continuation
            connection.send(text: encodeJSON([
                "type": "thread.start",
                "commandId": commandId,
                "timestamp": timestamp,
                "payload": [
                    "petId": petId,
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

    func petCommand(_ type: String, payload: [String: Any]?) async throws -> [String: Any] {
        guard connection.connectionState == .connected else {
            throw SwiftThreadClientError.startFailed("桌宠服务未连接")
        }
        let id = UUID().uuidString
        let response: Data = try await withCheckedThrowingContinuation { continuation in
            pendingPetCommands[id] = continuation
            petTimeouts[id] = Task { @MainActor [weak self] in
                do { try await Task.sleep(for: .seconds(30)) } catch { return }
                self?.pendingPetCommands.removeValue(forKey: id)?.resume(throwing: SwiftThreadClientError.startFailed("桌宠操作超时，请刷新后核对结果"))
                self?.petTimeouts.removeValue(forKey: id)
            }
            var envelope: [String: Any] = ["type": type, "commandId": id, "timestamp": Self.timestamp()]
            if let payload { envelope["payload"] = payload }
            connection.send(text: encodeJSON(envelope))
        }
        return try JSONSerialization.jsonObject(with: response) as? [String: Any] ?? [:]
    }

    private func handleIncoming(raw: String) {
        guard let data = raw.data(using: .utf8),
              let envelope = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = envelope["type"] as? String else {
            return
        }

        if type.hasPrefix("pet."), let commandId = envelope["commandId"] as? String,
           let continuation = pendingPetCommands.removeValue(forKey: commandId) {
            petTimeouts.removeValue(forKey: commandId)?.cancel()
            let payload = envelope["payload"] as? [String: Any] ?? [:]
            if type == "pet.error" {
                continuation.resume(throwing: SwiftThreadClientError.startFailed(payload["message"] as? String ?? "桌宠操作失败"))
            } else {
                do { continuation.resume(returning: try JSONSerialization.data(withJSONObject: payload)) }
                catch { continuation.resume(throwing: error) }
            }
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
