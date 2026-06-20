import XCTest
@testable import HandAgentDesktop

@MainActor
final class CommonDocumentationTests: XCTestCase {
    func testSourcesDocsIndexCommonAndDiscourageDuplicateComponents() throws {
        let source = try read("apps/desktop/Sources/sources.md")

        XCTAssertTrue(source.contains("`Common/`"))
        XCTAssertTrue(source.contains("优先"))
        XCTAssertTrue(source.contains("不要重复造轮子"))
    }

    func testCommonDocsListDirectChildrenAndComponentBoundary() throws {
        let source = try read("apps/desktop/Sources/Common/common.md")

        XCTAssertTrue(source.contains("CommonComponents.swift"))
        XCTAssertTrue(source.contains("Settings"))
        XCTAssertTrue(source.contains("PromptPanel"))
        XCTAssertTrue(source.contains("不属于 Common"))
    }

    func testSettingsDocsPreferCommonWrappers() throws {
        let source = try read("apps/desktop/Sources/Settings/settings.md")

        XCTAssertTrue(source.contains("Common"))
        XCTAssertTrue(source.contains("薄包装"))
        XCTAssertTrue(source.contains("SettingsStyles.swift"))
    }

    private func read(_ relativePath: String) throws -> String {
        let url = CommonComponentsThemeTests.repositoryRoot(from: #filePath)
            .appendingPathComponent(relativePath)
        return try String(contentsOf: url, encoding: .utf8)
    }
}
