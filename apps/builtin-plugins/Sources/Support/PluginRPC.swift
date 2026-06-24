import Foundation

public struct PluginToolResult: @unchecked Sendable {
    public let success: Bool
    public let contentItems: [[String: Any]]

    public init(success: Bool = true, contentItems: [[String: Any]]) {
        self.success = success
        self.contentItems = contentItems
    }

    public static func json(_ value: Any) -> PluginToolResult {
        PluginToolResult(contentItems: [[
            "type": "inputText",
            "text": encodeJSONValue(value),
        ]])
    }

    public static func text(_ value: String, success: Bool = true) -> PluginToolResult {
        PluginToolResult(success: success, contentItems: [[
            "type": "inputText",
            "text": value,
        ]])
    }

    var dictionary: [String: Any] {
        [
            "success": success,
            "contentItems": contentItems,
        ]
    }
}

public typealias PluginToolHandler = @Sendable (_ namespace: String, _ tool: String, _ arguments: Any?) async -> PluginToolResult

public func runLineDelimitedPluginServer(handler: @escaping PluginToolHandler) {
    while let line = readLine() {
        guard let data = line.data(using: .utf8),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              payload["type"] as? String == "tool_call",
              let namespace = payload["namespace"] as? String,
              let tool = payload["tool"] as? String else {
            printEncoded(PluginToolResult.text("invalid plugin RPC payload", success: false))
            continue
        }

        let arguments = UnsafeSendableValue(payload["arguments"])
        let result = runAsync {
            await handler(namespace, tool, arguments.value)
        }
        printEncoded(result)
    }
}

public func encodeJSONValue(_ value: Any) -> String {
    guard JSONSerialization.isValidJSONObject(value),
          let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
          let text = String(data: data, encoding: .utf8) else {
        return String(describing: value)
    }
    return text
}

private func printEncoded(_ result: PluginToolResult) {
    print(encodeJSONValue(result.dictionary))
    fflush(stdout)
}

private func runAsync<T: Sendable>(_ operation: @escaping @Sendable () async -> T) -> T {
    let semaphore = DispatchSemaphore(value: 0)
    let box = AsyncBox<T>()
    Task {
        box.value = await operation()
        semaphore.signal()
    }
    semaphore.wait()
    return box.value!
}

private final class AsyncBox<Value>: @unchecked Sendable {
    var value: Value?
}

private struct UnsafeSendableValue: @unchecked Sendable {
    let value: Any?

    init(_ value: Any?) {
        self.value = value
    }
}
