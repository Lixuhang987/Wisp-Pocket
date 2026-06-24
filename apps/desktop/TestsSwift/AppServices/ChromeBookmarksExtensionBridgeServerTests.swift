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

    func testFolderTreeSnapshotEventWritesLocalSnapshot() async throws {
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
        let body = """
        {
          "type": "handagent.bookmarks.folderTreeSnapshot",
          "protocolVersion": 1,
          "profileId": "Default",
          "updatedAt": "2026-06-23T00:00:00.000Z",
          "folders": [
            {
              "id": "1",
              "title": "书签栏",
              "childCount": 2,
              "children": [
                {
                  "id": "6",
                  "title": "a",
                  "childCount": 1,
                  "children": []
                }
              ]
            }
          ]
        }
        """.data(using: .utf8)!

        let statusCode = try await post(body: body, endpoint: endpoint)

        XCTAssertEqual(statusCode, 204)
        let snapshot = try XCTUnwrap(ChromeBookmarksFolderTreeStore(homeDirectoryURL: homeURL).load())
        XCTAssertEqual(snapshot.profileId, "Default")
        XCTAssertEqual(snapshot.folders.first?.title, "书签栏")
        XCTAssertEqual(snapshot.folders.first?.children.first?.id, "6")
    }

    private func post(body: Data, endpoint: ChromeBookmarksBridgeEndpoint) async throws -> Int {
        var request = URLRequest(url: URL(string: "http://\(endpoint.host):\(endpoint.port)/events")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(endpoint.token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        let (_, response) = try await URLSession.shared.data(for: request)
        return (response as? HTTPURLResponse)?.statusCode ?? 0
    }
}
