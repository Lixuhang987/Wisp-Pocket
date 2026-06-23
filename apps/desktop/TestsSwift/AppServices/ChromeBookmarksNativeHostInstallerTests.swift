import XCTest
@testable import HandAgentDesktop

final class ChromeBookmarksNativeHostInstallerTests: XCTestCase {
    func testInstallationStatusUnavailableWithoutExtensionId() {
        let installer = ChromeBookmarksNativeHostInstaller(extensionId: nil)

        let status = installer.installationStatus()

        XCTAssertFalse(status.isAvailable)
        XCTAssertEqual(status.message, "扩展连接不可用：未配置 HandAgent Chrome 扩展 ID。")
    }

    func testEnsureInstalledWritesManifestAndReportsAvailable() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let helperURL = homeURL.appendingPathComponent("HandAgentChromeBookmarksNativeHost")
        FileManager.default.createFile(atPath: helperURL.path, contents: Data())
        try writeBridgeEndpoint(homeURL: homeURL, updatedAt: "2026-06-23T00:00:00.000Z")
        try writeConnectionStatus(state: "connected", homeURL: homeURL, updatedAt: "2026-06-23T00:01:00.000Z")
        let installer = ChromeBookmarksNativeHostInstaller(
            homeDirectoryURL: homeURL,
            extensionId: "extension-id",
            nativeHostExecutableURL: helperURL
        )

        installer.ensureInstalled()
        let status = installer.installationStatus()

        XCTAssertTrue(status.isAvailable)
        XCTAssertEqual(status.message, "Chrome 扩展已连接，正在监听收藏事件。")
    }

    func testInstallationStatusUnavailableWhenManifestIsMissing() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let helperURL = homeURL.appendingPathComponent("HandAgentChromeBookmarksNativeHost")
        FileManager.default.createFile(atPath: helperURL.path, contents: Data())
        try writeBridgeEndpoint(homeURL: homeURL, updatedAt: "2026-06-23T00:00:00.000Z")
        let installer = ChromeBookmarksNativeHostInstaller(
            homeDirectoryURL: homeURL,
            extensionId: "extension-id",
            nativeHostExecutableURL: helperURL
        )

        let status = installer.installationStatus()

        XCTAssertFalse(status.isAvailable)
        XCTAssertEqual(status.message, "扩展连接不可用：Native Messaging Host manifest 未安装。")
    }

    func testInstallationStatusUnavailableWhenExtensionHasNotConnected() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let helperURL = homeURL.appendingPathComponent("HandAgentChromeBookmarksNativeHost")
        FileManager.default.createFile(atPath: helperURL.path, contents: Data())
        try writeBridgeEndpoint(homeURL: homeURL, updatedAt: "2026-06-23T00:00:00.000Z")
        let installer = ChromeBookmarksNativeHostInstaller(
            homeDirectoryURL: homeURL,
            extensionId: "extension-id",
            nativeHostExecutableURL: helperURL
        )

        installer.ensureInstalled()
        let status = installer.installationStatus()

        XCTAssertFalse(status.isAvailable)
        XCTAssertEqual(status.message, "扩展连接不可用：尚未收到 Chrome 扩展连接。")
    }

    func testInstallationStatusUnavailableWhenConnectedStatusIsOlderThanCurrentBridge() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let helperURL = homeURL.appendingPathComponent("HandAgentChromeBookmarksNativeHost")
        FileManager.default.createFile(atPath: helperURL.path, contents: Data())
        try writeBridgeEndpoint(homeURL: homeURL, updatedAt: "2026-06-23T00:02:00.000Z")
        try writeConnectionStatus(state: "connected", homeURL: homeURL, updatedAt: "2026-06-23T00:01:00.000Z")
        let installer = ChromeBookmarksNativeHostInstaller(
            homeDirectoryURL: homeURL,
            extensionId: "extension-id",
            nativeHostExecutableURL: helperURL
        )

        installer.ensureInstalled()
        let status = installer.installationStatus()

        XCTAssertFalse(status.isAvailable)
        XCTAssertEqual(status.message, "扩展连接不可用：尚未连接当前 Swift bridge。")
    }

    func testInstallationStatusUnavailableWhenCurrentBridgeIsMissing() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let helperURL = homeURL.appendingPathComponent("HandAgentChromeBookmarksNativeHost")
        FileManager.default.createFile(atPath: helperURL.path, contents: Data())
        try writeConnectionStatus(state: "connected", homeURL: homeURL, updatedAt: "2026-06-23T00:01:00.000Z")
        let installer = ChromeBookmarksNativeHostInstaller(
            homeDirectoryURL: homeURL,
            extensionId: "extension-id",
            nativeHostExecutableURL: helperURL
        )

        installer.ensureInstalled()
        let status = installer.installationStatus()

        XCTAssertFalse(status.isAvailable)
        XCTAssertEqual(status.message, "扩展连接不可用：Swift bridge 未启动。")
    }

    func testInstallationStatusUnavailableWhenExtensionDisconnected() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let helperURL = homeURL.appendingPathComponent("HandAgentChromeBookmarksNativeHost")
        FileManager.default.createFile(atPath: helperURL.path, contents: Data())
        try writeBridgeEndpoint(homeURL: homeURL, updatedAt: "2026-06-23T00:00:00.000Z")
        try writeConnectionStatus(state: "disconnected", homeURL: homeURL, updatedAt: "2026-06-23T00:01:00.000Z", error: "port closed")
        let installer = ChromeBookmarksNativeHostInstaller(
            homeDirectoryURL: homeURL,
            extensionId: "extension-id",
            nativeHostExecutableURL: helperURL
        )

        installer.ensureInstalled()
        let status = installer.installationStatus()

        XCTAssertFalse(status.isAvailable)
        XCTAssertEqual(status.message, "扩展连接不可用：Chrome 扩展未连接（port closed）。")
    }

    private func writeConnectionStatus(
        state: String,
        homeURL: URL,
        updatedAt: String,
        error: String? = nil
    ) throws {
        let statusURL = homeURL
            .appendingPathComponent(".spotAgent", isDirectory: true)
            .appendingPathComponent("agent-triggers", isDirectory: true)
            .appendingPathComponent("chrome-bookmarks-extension", isDirectory: true)
            .appendingPathComponent("status.json")
        try FileManager.default.createDirectory(at: statusURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let status = TestConnectionStatus(
            protocolVersion: 1,
            state: state,
            updatedAt: updatedAt,
            error: error
        )
        try JSONEncoder().encode(status).write(to: statusURL)
    }

    private func writeBridgeEndpoint(homeURL: URL, updatedAt: String) throws {
        let endpointURL = homeURL
            .appendingPathComponent(".spotAgent", isDirectory: true)
            .appendingPathComponent("agent-triggers", isDirectory: true)
            .appendingPathComponent("chrome-bookmarks-extension", isDirectory: true)
            .appendingPathComponent("bridge.json")
        try FileManager.default.createDirectory(at: endpointURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let endpoint = TestBridgeEndpoint(updatedAt: updatedAt)
        try JSONEncoder().encode(endpoint).write(to: endpointURL)
    }
}

private struct TestConnectionStatus: Encodable {
    let protocolVersion: Int
    let state: String
    let updatedAt: String
    let error: String?
}

private struct TestBridgeEndpoint: Encodable {
    let updatedAt: String
}
