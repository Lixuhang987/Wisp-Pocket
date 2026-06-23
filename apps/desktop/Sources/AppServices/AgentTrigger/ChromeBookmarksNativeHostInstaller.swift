import Foundation

struct ChromeBookmarksNativeHostInstallationStatus: Equatable {
    let isAvailable: Bool
    let message: String
}

struct ChromeBookmarksNativeHostInstaller {
    let homeDirectoryURL: URL
    let fileManager: FileManager
    let extensionId: String?
    let nativeHostName: String
    let nativeHostExecutableURL: URL

    init(
        homeDirectoryURL: URL = FileManager.default.homeDirectoryForCurrentUser,
        fileManager: FileManager = .default,
        extensionId: String? = nil,
        nativeHostName: String = "com.handagent.chrome_bookmarks",
        nativeHostExecutableURL: URL? = nil
    ) {
        self.homeDirectoryURL = homeDirectoryURL
        self.fileManager = fileManager
        self.extensionId = extensionId
        self.nativeHostName = nativeHostName
        self.nativeHostExecutableURL = nativeHostExecutableURL ?? Self.defaultNativeHostExecutableURL()
    }

    func ensureInstalled() {
        guard let normalizedExtensionId else {
            return
        }
        let manifest = NativeHostManifest(
            name: nativeHostName,
            description: "HandAgent Chrome bookmarks native messaging host",
            path: nativeHostExecutableURL.path,
            type: "stdio",
            allowedOrigins: [expectedAllowedOrigin(extensionId: normalizedExtensionId)]
        )
        do {
            try fileManager.createDirectory(at: manifestURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(manifest).write(to: manifestURL, options: .atomic)
        } catch {
            // Trigger setup should not prevent the desktop app from launching.
        }
    }

    func installationStatus() -> ChromeBookmarksNativeHostInstallationStatus {
        guard let normalizedExtensionId else {
            return ChromeBookmarksNativeHostInstallationStatus(
                isAvailable: false,
                message: "扩展连接不可用：未配置 HandAgent Chrome 扩展 ID。"
            )
        }
        guard fileManager.fileExists(atPath: manifestURL.path) else {
            return ChromeBookmarksNativeHostInstallationStatus(
                isAvailable: false,
                message: "扩展连接不可用：Native Messaging Host manifest 未安装。"
            )
        }
        guard fileManager.fileExists(atPath: nativeHostExecutableURL.path) else {
            return ChromeBookmarksNativeHostInstallationStatus(
                isAvailable: false,
                message: "扩展连接不可用：Native Messaging Host helper 不存在。"
            )
        }

        do {
            let data = try Data(contentsOf: manifestURL)
            let manifest = try JSONDecoder().decode(NativeHostManifest.self, from: data)
            guard manifest.name == nativeHostName,
                  manifest.type == "stdio",
                  manifest.path == nativeHostExecutableURL.path,
                  manifest.allowedOrigins.contains(expectedAllowedOrigin(extensionId: normalizedExtensionId)) else {
                return ChromeBookmarksNativeHostInstallationStatus(
                    isAvailable: false,
                    message: "扩展连接不可用：Native Messaging Host manifest 与当前扩展 ID 不匹配。"
                )
            }
        } catch {
            return ChromeBookmarksNativeHostInstallationStatus(
                isAvailable: false,
                message: "扩展连接不可用：Native Messaging Host manifest 无法读取。"
            )
        }
        let currentBridgeUpdatedAt: String
        do {
            let data = try Data(contentsOf: bridgeEndpointURL)
            currentBridgeUpdatedAt = try JSONDecoder().decode(NativeHostBridgeEndpoint.self, from: data).updatedAt
        } catch {
            return ChromeBookmarksNativeHostInstallationStatus(
                isAvailable: false,
                message: "扩展连接不可用：Swift bridge 未启动。"
            )
        }

        guard fileManager.fileExists(atPath: connectionStatusURL.path) else {
            return ChromeBookmarksNativeHostInstallationStatus(
                isAvailable: false,
                message: "扩展连接不可用：尚未收到 Chrome 扩展连接。"
            )
        }

        do {
            let data = try Data(contentsOf: connectionStatusURL)
            let status = try JSONDecoder().decode(NativeHostConnectionStatus.self, from: data)
            guard status.protocolVersion == 1 else {
                return ChromeBookmarksNativeHostInstallationStatus(
                    isAvailable: false,
                    message: "扩展连接不可用：扩展连接状态版本不兼容。"
                )
            }
            guard isStatus(status.updatedAt, notOlderThan: currentBridgeUpdatedAt) else {
                return ChromeBookmarksNativeHostInstallationStatus(
                    isAvailable: false,
                    message: "扩展连接不可用：尚未连接当前 Swift bridge。"
                )
            }
            guard status.state == "connected" else {
                let suffix = status.error.map { "（\($0)）" } ?? ""
                return ChromeBookmarksNativeHostInstallationStatus(
                    isAvailable: false,
                    message: "扩展连接不可用：Chrome 扩展未连接\(suffix)。"
                )
            }
        } catch {
            return ChromeBookmarksNativeHostInstallationStatus(
                isAvailable: false,
                message: "扩展连接不可用：扩展连接状态无法读取。"
            )
        }

        return ChromeBookmarksNativeHostInstallationStatus(
            isAvailable: true,
            message: "Chrome 扩展已连接，正在监听收藏事件。"
        )
    }

    static func fromEnvironment(
        _ environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> ChromeBookmarksNativeHostInstaller {
        ChromeBookmarksNativeHostInstaller(
            extensionId: environment["HANDAGENT_CHROME_BOOKMARKS_EXTENSION_ID"],
            nativeHostExecutableURL: environment["HANDAGENT_CHROME_BOOKMARKS_NATIVE_HOST_PATH"].map(URL.init(fileURLWithPath:))
        )
    }

    private var normalizedExtensionId: String? {
        let trimmed = extensionId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }

    private var manifestURL: URL {
        homeDirectoryURL
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("Application Support", isDirectory: true)
            .appendingPathComponent("Google", isDirectory: true)
            .appendingPathComponent("Chrome", isDirectory: true)
            .appendingPathComponent("NativeMessagingHosts", isDirectory: true)
            .appendingPathComponent("\(nativeHostName).json")
    }

    private var connectionStatusURL: URL {
        homeDirectoryURL
            .appendingPathComponent(".spotAgent", isDirectory: true)
            .appendingPathComponent("agent-triggers", isDirectory: true)
            .appendingPathComponent("chrome-bookmarks-extension", isDirectory: true)
            .appendingPathComponent("status.json")
    }

    private var bridgeEndpointURL: URL {
        homeDirectoryURL
            .appendingPathComponent(".spotAgent", isDirectory: true)
            .appendingPathComponent("agent-triggers", isDirectory: true)
            .appendingPathComponent("chrome-bookmarks-extension", isDirectory: true)
            .appendingPathComponent("bridge.json")
    }

    private func expectedAllowedOrigin(extensionId: String) -> String {
        "chrome-extension://\(extensionId)/"
    }

    private func isStatus(_ statusUpdatedAt: String, notOlderThan bridgeUpdatedAt: String) -> Bool {
        guard let statusDate = parseISO8601Date(statusUpdatedAt),
              let bridgeDate = parseISO8601Date(bridgeUpdatedAt) else {
            return false
        }
        return statusDate >= bridgeDate
    }

    private func parseISO8601Date(_ value: String) -> Date? {
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractionalFormatter.date(from: value) {
            return date
        }
        return ISO8601DateFormatter().date(from: value)
    }

    private static func defaultNativeHostExecutableURL() -> URL {
        if let resourceURL = Bundle.main.resourceURL {
            return resourceURL.appendingPathComponent("HandAgentChromeBookmarksNativeHost")
        }
        return URL(fileURLWithPath: "HandAgentChromeBookmarksNativeHost")
    }
}

private struct NativeHostManifest: Codable {
    let name: String
    let description: String
    let path: String
    let type: String
    let allowedOrigins: [String]

    enum CodingKeys: String, CodingKey {
        case name, description, path, type
        case allowedOrigins = "allowed_origins"
    }
}

private struct NativeHostConnectionStatus: Decodable {
    let protocolVersion: Int
    let state: String
    let updatedAt: String
    let error: String?
}

private struct NativeHostBridgeEndpoint: Decodable {
    let updatedAt: String
}
