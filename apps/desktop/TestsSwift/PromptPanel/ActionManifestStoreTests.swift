import XCTest
@testable import HandAgentDesktop

final class ActionManifestStoreTests: XCTestCase {
    func testLoadsActionManifestsFromStableActionDirectories() throws {
        let root = try FileManager.default.url(
            for: .itemReplacementDirectory,
            in: .userDomainMask,
            appropriateFor: FileManager.default.temporaryDirectory,
            create: true
        )
        defer { try? FileManager.default.removeItem(at: root) }
        let actions = root.appendingPathComponent("actions", isDirectory: true)
        try FileManager.default.createDirectory(at: actions.appendingPathComponent("beta", isDirectory: true), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: actions.appendingPathComponent("alpha", isDirectory: true), withIntermediateDirectories: true)
        try writeActionManifest(id: "beta", trigger: "b", to: actions.appendingPathComponent("beta/action.json"))
        try writeActionManifest(id: "alpha", trigger: "a", to: actions.appendingPathComponent("alpha/action.json"))

        let store = ActionManifestStore(actionsDirectoryURL: actions)
        let result = store.load()

        XCTAssertEqual(result.actions.map(\.id), ["alpha/code_review", "beta/code_review"])
        XCTAssertEqual(result.disabled, [])
    }

    func testDisablesManifestWhenDirectoryNameDoesNotMatchId() throws {
        let root = try FileManager.default.url(
            for: .itemReplacementDirectory,
            in: .userDomainMask,
            appropriateFor: FileManager.default.temporaryDirectory,
            create: true
        )
        defer { try? FileManager.default.removeItem(at: root) }
        let actions = root.appendingPathComponent("actions", isDirectory: true)
        let wrong = actions.appendingPathComponent("wrong", isDirectory: true)
        try FileManager.default.createDirectory(at: wrong, withIntermediateDirectories: true)
        try writeActionManifest(id: "actual", trigger: "a", to: wrong.appendingPathComponent("action.json"))

        let result = ActionManifestStore(actionsDirectoryURL: actions).load()

        XCTAssertEqual(result.actions, [])
        XCTAssertEqual(result.disabled.map(\.id), ["action:wrong"])
        XCTAssertEqual(result.disabled.first?.reason, "action manifest id must match directory name")
    }
}

private func writeActionManifest(id: String, trigger: String, to url: URL) throws {
    let json = """
    {
      "version": 1,
      "id": "\(id)",
      "title": "\(id)",
      "enabled": true,
      "prompts": [
        {
          "name": "code_review",
          "trigger": "\(trigger)",
          "title": "Review",
          "template": "Review the code the user provides."
        }
      ]
    }
    """
    try json.data(using: .utf8)!.write(to: url)
}
