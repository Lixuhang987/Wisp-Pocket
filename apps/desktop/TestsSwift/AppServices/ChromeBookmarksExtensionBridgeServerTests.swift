import XCTest
@testable import HandAgentDesktop

final class ChromeBookmarksExtensionBridgeServerTests: XCTestCase {
    @MainActor
    func testRuntimeReloadKeepsPublishedEndpointReachable() async throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        XCTAssertTrue(store.saveInstances([
            AgentTriggerInstance(
                id: "qa-bookmarks", packageId: "chrome-bookmarks", title: "QA Bookmarks", enabled: true,
                config: ["folderIds": .stringList(["qa-folder"])], promptTemplate: "Summarize {{url}}",
                deliveryPolicy: .default, notificationPolicy: .default,
                targetPetId: "pet-test"
            ),
        ]))
        let factory = IsolatedChromeBridgeFactory(homeURL: homeURL)
        let runtime = AgentTriggerRuntime(registry: AgentTriggerRegistry(factories: [factory]), store: store)
        defer { try? factory.server?.stop() }
        let endpointURL = ChromeBookmarksExtensionBridgeServer.endpointURL(homeDirectoryURL: homeURL)

        for iteration in 0..<20 {
            try runtime.reload()
            let endpoint = try JSONDecoder().decode(ChromeBookmarksBridgeEndpoint.self, from: Data(contentsOf: endpointURL))
            let hello = try JSONSerialization.data(withJSONObject: [
                "type": "handagent.bookmarks.hello", "protocolVersion": 1,
                "profileId": "qa-profile", "extensionVersion": "qa", "extensionInstanceId": "qa-instance",
                "sentAt": "2026-09-14T00:00:00.000Z",
            ])
            let helloStatus = try await Self.post(body: hello, endpoint: endpoint)
            XCTAssertEqual(helloStatus, 204, "reload \(iteration) must publish a reachable authenticated endpoint")

            let title = "QA folder \(iteration)"
            let snapshot = try JSONSerialization.data(withJSONObject: [
                "type": "handagent.bookmarks.folderTreeSnapshot", "protocolVersion": 1,
                "profileId": "qa-profile", "updatedAt": "2026-09-14T00:00:00.000Z",
                "folders": [["id": "qa-folder", "title": title, "childCount": 0, "children": []]],
            ])
            let snapshotStatus = try await Self.post(body: snapshot, endpoint: endpoint)
            XCTAssertEqual(snapshotStatus, 204)
            let saved = try XCTUnwrap(ChromeBookmarksFolderTreeStore(homeDirectoryURL: homeURL).load())
            XCTAssertEqual(saved.folders.first?.title, title)
        }
    }

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

        let statusCode = try await Self.post(body: body, endpoint: endpoint)

        XCTAssertEqual(statusCode, 204)
        let snapshot = try XCTUnwrap(ChromeBookmarksFolderTreeStore(homeDirectoryURL: homeURL).load())
        XCTAssertEqual(snapshot.profileId, "Default")
        XCTAssertEqual(snapshot.folders.first?.title, "书签栏")
        XCTAssertEqual(snapshot.folders.first?.children.first?.id, "6")
    }

    private static func post(body: Data, endpoint: ChromeBookmarksBridgeEndpoint) async throws -> Int {
        var request = URLRequest(url: URL(string: "http://\(endpoint.host):\(endpoint.port)/events")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(endpoint.token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        request.timeoutInterval = 2
        let (_, response) = try await URLSession.shared.data(for: request)
        return (response as? HTTPURLResponse)?.statusCode ?? 0
    }
}

private final class IsolatedChromeBridgeFactory: AgentTriggerProviderFactory {
    private let homeURL: URL
    private(set) var server: ChromeBookmarksExtensionBridgeServer?

    init(homeURL: URL) {
        self.homeURL = homeURL
    }

    func descriptor() -> AgentTriggerProviderDescriptor {
        AgentTriggerProviderDescriptor(kind: "chrome.bookmarks", displayName: "Chrome Bookmarks")
    }

    func createHostProvider() -> any AgentTriggerProvider {
        let server = ChromeBookmarksExtensionBridgeServer(homeDirectoryURL: homeURL)
        self.server = server
        return ChromeBookmarksAgentTriggerProvider(eventSource: server)
    }
}
