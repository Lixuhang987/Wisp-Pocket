import Foundation
import Network

struct ChromeBookmarksExtensionEvent: Codable, Equatable {
    let type: String
    let protocolVersion: Int
    let eventId: String?
    let bookmarkId: String?
    let parentId: String?
    let title: String?
    let url: String?
    let profileId: String?
    let occurredAt: String?
    let extensionVersion: String?
    let extensionInstanceId: String?
    let sentAt: String?
    let folders: [ChromeBookmarksFolderTreeNode]?
    let updatedAt: String?

    init(
        type: String,
        protocolVersion: Int,
        eventId: String? = nil,
        bookmarkId: String? = nil,
        parentId: String? = nil,
        title: String? = nil,
        url: String? = nil,
        profileId: String? = nil,
        occurredAt: String? = nil,
        extensionVersion: String? = nil,
        extensionInstanceId: String? = nil,
        sentAt: String? = nil,
        folders: [ChromeBookmarksFolderTreeNode]? = nil,
        updatedAt: String? = nil
    ) {
        self.type = type
        self.protocolVersion = protocolVersion
        self.eventId = eventId
        self.bookmarkId = bookmarkId
        self.parentId = parentId
        self.title = title
        self.url = url
        self.profileId = profileId
        self.occurredAt = occurredAt
        self.extensionVersion = extensionVersion
        self.extensionInstanceId = extensionInstanceId
        self.sentAt = sentAt
        self.folders = folders
        self.updatedAt = updatedAt
    }
}

struct ChromeBookmarksFolderTreeNode: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let childCount: Int
    let children: [ChromeBookmarksFolderTreeNode]
}

struct ChromeBookmarksFolderTreeSnapshot: Codable, Equatable {
    let protocolVersion: Int
    let profileId: String
    let folders: [ChromeBookmarksFolderTreeNode]
    let updatedAt: String
}

struct ChromeBookmarksFolderTreeStore {
    private let homeDirectoryURL: URL
    private let fileManager: FileManager

    init(
        homeDirectoryURL: URL = FileManager.default.homeDirectoryForCurrentUser,
        fileManager: FileManager = .default
    ) {
        self.homeDirectoryURL = homeDirectoryURL
        self.fileManager = fileManager
    }

    func load() -> ChromeBookmarksFolderTreeSnapshot? {
        let url = Self.snapshotURL(homeDirectoryURL: homeDirectoryURL)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(ChromeBookmarksFolderTreeSnapshot.self, from: data)
    }

    func save(_ snapshot: ChromeBookmarksFolderTreeSnapshot) throws {
        let url = Self.snapshotURL(homeDirectoryURL: homeDirectoryURL)
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(snapshot).write(to: url, options: .atomic)
    }

    static func snapshotURL(homeDirectoryURL: URL) -> URL {
        homeDirectoryURL
            .appendingPathComponent(".spotAgent", isDirectory: true)
            .appendingPathComponent("agent-triggers", isDirectory: true)
            .appendingPathComponent("chrome-bookmarks-extension", isDirectory: true)
            .appendingPathComponent("folders.json")
    }
}

protocol ChromeBookmarksExtensionEventSource: AnyObject {
    func start(_ handler: @escaping (ChromeBookmarksExtensionEvent) -> Void) throws
    func stop() throws
}

struct ChromeBookmarksBridgeEndpoint: Codable, Equatable {
    let protocolVersion: Int
    let host: String
    let port: Int
    let token: String
    let updatedAt: String
}

final class ChromeBookmarksExtensionBridgeServer: ChromeBookmarksExtensionEventSource, @unchecked Sendable {
    private let homeDirectoryURL: URL
    private let fileManager: FileManager
    private let folderTreeStore: ChromeBookmarksFolderTreeStore
    private let queue = DispatchQueue(label: "handagent.chrome-bookmarks-extension.bridge")
    private var listener: NWListener?
    private var token: String?
    private var handler: ((ChromeBookmarksExtensionEvent) -> Void)?

    init(
        homeDirectoryURL: URL = FileManager.default.homeDirectoryForCurrentUser,
        fileManager: FileManager = .default
    ) {
        self.homeDirectoryURL = homeDirectoryURL
        self.fileManager = fileManager
        self.folderTreeStore = ChromeBookmarksFolderTreeStore(
            homeDirectoryURL: homeDirectoryURL,
            fileManager: fileManager
        )
    }

    deinit {
        try? stop()
    }

    func start(_ handler: @escaping (ChromeBookmarksExtensionEvent) -> Void) throws {
        try stop()
        let token = UUID().uuidString
        let listener = try NWListener(using: .tcp, on: .any)
        self.token = token
        self.handler = handler
        listener.newConnectionHandler = { [weak self] connection in
            self?.handle(connection)
        }
        self.listener = listener

        let readyState = ChromeBookmarksListenerReadyState()
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready:
                if let port = listener.port?.rawValue, port > 0 {
                    readyState.complete(.success(port))
                } else {
                    readyState.complete(.failure(.missingPort))
                }
            case .failed:
                readyState.complete(.failure(.listenerFailed))
            default:
                return
            }
        }
        listener.start(queue: queue)

        guard readyState.wait(timeout: .now() + 2) else {
            try? stop()
            throw ChromeBookmarksExtensionBridgeError.listenerTimedOut
        }
        switch readyState.result {
        case .success(let port):
            try writeEndpoint(port: Int(port), token: token)
        case .failure(let error):
            try? stop()
            throw error
        case .none:
            try? stop()
            throw ChromeBookmarksExtensionBridgeError.listenerTimedOut
        }
    }

    func stop() throws {
        let ownedToken = token
        listener?.cancel()
        listener = nil
        token = nil
        handler = nil
        if let ownedToken {
            removeEndpointIfOwned(token: ownedToken)
        }
    }

    private func handle(_ connection: NWConnection) {
        connection.start(queue: queue)
        receive(on: connection, buffer: Data())
    }

    private func receive(on connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            var nextBuffer = buffer
            if let data {
                nextBuffer.append(data)
            }
            if let response = self.makeResponse(for: nextBuffer) {
                connection.send(content: response, completion: .contentProcessed { _ in
                    connection.cancel()
                })
                return
            }
            if isComplete || error != nil {
                connection.cancel()
                return
            }
            self.receive(on: connection, buffer: nextBuffer)
        }
    }

    private func makeResponse(for data: Data) -> Data? {
        guard let request = HTTPBookmarkEventRequest(data: data) else { return nil }
        guard request.path == "/events", request.method == "POST" else {
            return httpResponse(status: 404)
        }
        guard request.authorization == "Bearer \(token ?? "")" else {
            return httpResponse(status: 401)
        }
        do {
            let event = try JSONDecoder().decode(ChromeBookmarksExtensionEvent.self, from: request.body)
            guard event.protocolVersion == 1 else {
                return httpResponse(status: 400)
            }
            if event.type == "handagent.bookmarks.folderTreeSnapshot",
               let snapshot = event.folderTreeSnapshot {
                try folderTreeStore.save(snapshot)
            }
            handler?(event)
            return httpResponse(status: 204)
        } catch {
            return httpResponse(status: 400)
        }
    }

    private func writeEndpoint(port: Int, token: String) throws {
        let endpoint = ChromeBookmarksBridgeEndpoint(
            protocolVersion: 1,
            host: "127.0.0.1",
            port: port,
            token: token,
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        let url = Self.endpointURL(homeDirectoryURL: homeDirectoryURL)
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(endpoint).write(to: url, options: .atomic)
    }

    private func removeEndpointIfOwned(token ownedToken: String) {
        let url = Self.endpointURL(homeDirectoryURL: homeDirectoryURL)
        guard fileManager.fileExists(atPath: url.path) else { return }
        guard let data = try? Data(contentsOf: url),
              let endpoint = try? JSONDecoder().decode(ChromeBookmarksBridgeEndpoint.self, from: data) else {
            return
        }
        guard endpoint.token == ownedToken else { return }
        try? fileManager.removeItem(at: url)
    }

    static func endpointURL(homeDirectoryURL: URL) -> URL {
        homeDirectoryURL
            .appendingPathComponent(".spotAgent", isDirectory: true)
            .appendingPathComponent("agent-triggers", isDirectory: true)
            .appendingPathComponent("chrome-bookmarks-extension", isDirectory: true)
            .appendingPathComponent("bridge.json")
    }
}

private extension ChromeBookmarksExtensionEvent {
    var folderTreeSnapshot: ChromeBookmarksFolderTreeSnapshot? {
        guard let profileId,
              let folders,
              let updatedAt else {
            return nil
        }
        return ChromeBookmarksFolderTreeSnapshot(
            protocolVersion: protocolVersion,
            profileId: profileId,
            folders: folders,
            updatedAt: updatedAt
        )
    }
}

enum ChromeBookmarksExtensionBridgeError: Error, Equatable {
    case missingPort
    case listenerFailed
    case listenerTimedOut
}

private final class ChromeBookmarksListenerReadyState: @unchecked Sendable {
    private let semaphore = DispatchSemaphore(value: 0)
    private let lock = NSLock()
    private var storedResult: Result<UInt16, ChromeBookmarksExtensionBridgeError>?

    var result: Result<UInt16, ChromeBookmarksExtensionBridgeError>? {
        lock.lock()
        defer { lock.unlock() }
        return storedResult
    }

    func complete(_ result: Result<UInt16, ChromeBookmarksExtensionBridgeError>) {
        lock.lock()
        let shouldSignal = storedResult == nil
        if shouldSignal {
            storedResult = result
        }
        lock.unlock()
        if shouldSignal {
            semaphore.signal()
        }
    }

    func wait(timeout: DispatchTime) -> Bool {
        semaphore.wait(timeout: timeout) == .success
    }
}

private struct HTTPBookmarkEventRequest {
    let method: String
    let path: String
    let authorization: String?
    let body: Data

    init?(data: Data) {
        guard let headerRange = data.range(of: Data("\r\n\r\n".utf8)) else { return nil }
        let headerData = data.subdata(in: data.startIndex..<headerRange.lowerBound)
        guard let headerText = String(data: headerData, encoding: .utf8) else { return nil }
        let lines = headerText.split(separator: "\r\n", omittingEmptySubsequences: false)
        guard let requestLine = lines.first else { return nil }
        let requestParts = requestLine.split(separator: " ")
        guard requestParts.count >= 2 else { return nil }
        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            guard let separator = line.firstIndex(of: ":") else { continue }
            let key = line[..<separator].trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let value = line[line.index(after: separator)...].trimmingCharacters(in: .whitespacesAndNewlines)
            headers[key] = value
        }
        let bodyStart = headerRange.upperBound
        let contentLength = Int(headers["content-length"] ?? "0") ?? 0
        guard data.count >= bodyStart + contentLength else { return nil }
        method = String(requestParts[0])
        path = String(requestParts[1])
        authorization = headers["authorization"]
        body = data.subdata(in: bodyStart..<(bodyStart + contentLength))
    }
}

private func httpResponse(status: Int) -> Data {
    let reason: String
    switch status {
    case 204: reason = "No Content"
    case 400: reason = "Bad Request"
    case 401: reason = "Unauthorized"
    case 404: reason = "Not Found"
    default: reason = "Error"
    }
    return Data("HTTP/1.1 \(status) \(reason)\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".utf8)
}
