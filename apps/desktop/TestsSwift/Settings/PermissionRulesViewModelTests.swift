import Foundation
import XCTest
@testable import HandAgentDesktop

final class PermissionRulesViewModelTests: XCTestCase {
    @MainActor
    func testLoadsPermissionRulesFromDotSpotAgentPermissionsJSON() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let fileURL = TestFiles.permissionsFileURL(homeURL)
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data(
            """
            {
              "version": 2,
              "rules": [
                {
                  "toolName": "file.write",
                  "decision": "allow",
                  "createdAt": "2026-05-19T00:00:00.000Z",
                  "arguments": {
                    "workspaceId": "default",
                    "relativePath": "notes/today.md"
                  }
                }
              ]
            }
            """.utf8
        ).write(to: fileURL)

        let viewModel = PermissionRulesViewModel(homeDirectoryURL: homeURL)

        XCTAssertEqual(viewModel.rules.count, 1)
        XCTAssertEqual(viewModel.rules[0].id, "file.write")
        XCTAssertEqual(viewModel.rules[0].toolName, "file.write")
        XCTAssertEqual(viewModel.rules[0].decision, "allow")
        XCTAssertEqual(viewModel.rules[0].createdAtText, "2026-05-19 00:00")
    }

    @MainActor
    func testRevokeRemovesPermissionRuleAndPreservesOtherRules() throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let fileURL = TestFiles.permissionsFileURL(homeURL)
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data(
            """
            {
              "version": 2,
              "rules": [
                {
                  "toolName": "file.write",
                  "decision": "allow",
                  "createdAt": "2026-05-19T00:00:00.000Z",
                  "arguments": { "relativePath": "a.md" }
                },
                {
                  "toolName": "file.read",
                  "decision": "deny",
                  "createdAt": "2026-05-19T00:01:00.000Z",
                  "arguments": { "relativePath": "b.md" }
                }
              ]
            }
            """.utf8
        ).write(to: fileURL)
        let viewModel = PermissionRulesViewModel(homeDirectoryURL: homeURL)

        viewModel.revoke(ruleId: "file.write")

        XCTAssertEqual(viewModel.rules.map(\.id), ["file.read"])
        let json = try TestFiles.readJSON(fileURL)
        let rules = try XCTUnwrap(json["rules"] as? [[String: Any]])
        XCTAssertEqual(rules.map { $0["toolName"] as? String }, ["file.read"])
    }
}
