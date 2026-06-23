import Foundation

public struct ChromeBookmarksBridgeEndpoint: Codable, Equatable {
    public let protocolVersion: Int
    public let host: String
    public let port: Int
    public let token: String
    public let updatedAt: String

    public init(protocolVersion: Int, host: String, port: Int, token: String, updatedAt: String) {
        self.protocolVersion = protocolVersion
        self.host = host
        self.port = port
        self.token = token
        self.updatedAt = updatedAt
    }
}

public enum ChromeBookmarksBridgeEndpointLoader {
    public static func defaultEndpointURL(homeDirectoryURL: URL = FileManager.default.homeDirectoryForCurrentUser) -> URL {
        homeDirectoryURL
            .appendingPathComponent(".spotAgent", isDirectory: true)
            .appendingPathComponent("agent-triggers", isDirectory: true)
            .appendingPathComponent("chrome-bookmarks-extension", isDirectory: true)
            .appendingPathComponent("bridge.json")
    }

    public static func load(from url: URL = defaultEndpointURL()) throws -> ChromeBookmarksBridgeEndpoint {
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(ChromeBookmarksBridgeEndpoint.self, from: data)
    }
}

public struct ChromeBookmarksBridgeForwarder {
    public init() {}

    public func forward(_ message: ChromeBookmarksNativeMessage, endpoint: ChromeBookmarksBridgeEndpoint) async throws {
        var request = URLRequest(url: URL(string: "http://\(endpoint.host):\(endpoint.port)/events")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(endpoint.token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(message)
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
}

public struct ChromeBookmarksExtensionConnectionStatus: Codable, Equatable {
    public let protocolVersion: Int
    public let state: String
    public let extensionVersion: String?
    public let extensionInstanceId: String?
    public let profileId: String?
    public let updatedAt: String
    public let error: String?

    public init(
        protocolVersion: Int,
        state: String,
        extensionVersion: String?,
        extensionInstanceId: String?,
        profileId: String?,
        updatedAt: String,
        error: String? = nil
    ) {
        self.protocolVersion = protocolVersion
        self.state = state
        self.extensionVersion = extensionVersion
        self.extensionInstanceId = extensionInstanceId
        self.profileId = profileId
        self.updatedAt = updatedAt
        self.error = error
    }
}

public struct ChromeBookmarksExtensionConnectionStatusStore {
    private let statusURL: URL
    private let fileManager: FileManager
    private let now: () -> String

    public init(
        statusURL: URL = Self.defaultStatusURL(),
        fileManager: FileManager = .default,
        now: @escaping () -> String = { ISO8601DateFormatter().string(from: Date()) }
    ) {
        self.statusURL = statusURL
        self.fileManager = fileManager
        self.now = now
    }

    public static func defaultStatusURL(homeDirectoryURL: URL = FileManager.default.homeDirectoryForCurrentUser) -> URL {
        homeDirectoryURL
            .appendingPathComponent(".spotAgent", isDirectory: true)
            .appendingPathComponent("agent-triggers", isDirectory: true)
            .appendingPathComponent("chrome-bookmarks-extension", isDirectory: true)
            .appendingPathComponent("status.json")
    }

    public func writeConnected(from message: ChromeBookmarksNativeMessage) throws {
        try write(ChromeBookmarksExtensionConnectionStatus(
            protocolVersion: 1,
            state: "connected",
            extensionVersion: message.extensionVersion,
            extensionInstanceId: message.extensionInstanceId,
            profileId: message.profileId,
            updatedAt: now()
        ))
    }

    public func writeDisconnected(from message: ChromeBookmarksNativeMessage?, error: String? = nil) throws {
        try write(ChromeBookmarksExtensionConnectionStatus(
            protocolVersion: 1,
            state: "disconnected",
            extensionVersion: message?.extensionVersion,
            extensionInstanceId: message?.extensionInstanceId,
            profileId: message?.profileId,
            updatedAt: now(),
            error: error
        ))
    }

    private func write(_ status: ChromeBookmarksExtensionConnectionStatus) throws {
        try fileManager.createDirectory(at: statusURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(status).write(to: statusURL, options: .atomic)
    }
}
