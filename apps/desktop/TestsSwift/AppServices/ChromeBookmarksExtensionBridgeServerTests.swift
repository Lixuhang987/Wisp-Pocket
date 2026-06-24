import XCTest
@testable import HandAgentDesktop

final class ChromeBookmarksExtensionBridgeServerTests: XCTestCase {
    func testStartWritesAssignedLoopbackPort() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let server = ChromeBookmarksExtensionBridgeServer(homeDirectoryURL: homeURL)
        defer { try? server.stop() }

        try server.start { _ in }
        let endpointURL = ChromeBookmarksExtensionBridgeServer.endpointURL(homeDirectoryURL: homeURL)
        let endpoint = try JSONDecoder().decode(
            ChromeBookmarksBridgeEndpoint.self,
            from: Data(contentsOf: endpointURL)
        )

        XCTAssertEqual(endpoint.host, "127.0.0.1")
        XCTAssertGreaterThan(endpoint.port, 0)
    }
}
