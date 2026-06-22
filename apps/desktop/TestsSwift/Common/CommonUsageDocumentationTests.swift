import XCTest
@testable import HandAgentDesktop

@MainActor
final class CommonUsageDocumentationTests: XCTestCase {
    /// PromptPanel 文档必须说明 Common 复用边界：基础控件可复用，
    /// 专用输入和窗口交互保留在 PromptPanel。
    func testPromptPanelDocsDescribeCommonReuseBoundary() throws {
        let source = try read("apps/desktop/Sources/PromptPanel/prompt-panel.md")

        XCTAssertTrue(
            source.contains("Common"),
            "prompt-panel.md must reference Common to describe the reuse boundary."
        )
        XCTAssertTrue(
            source.contains("growing text view") || source.contains("GrowingTextView"),
            "prompt-panel.md must mention the growing text view as PromptPanel-specific."
        )
        XCTAssertTrue(
            source.contains("保留") || source.contains("专用"),
            "prompt-panel.md must state that PromptPanel-specific UI is kept local."
        )
    }

    /// PromptPanel 样式文件保留专用修饰器，不复制 Common 已覆盖的独立组件定义。
    func testPromptPanelStylesDoNotDuplicateCommonStandaloneComponents() throws {
        let source = try read("apps/desktop/Sources/PromptPanel/PromptPanelStyles.swift")

        // PromptPanel styles should remain as ViewModifiers (specialized), not
        // redefine standalone structs that Common already provides.
        XCTAssertFalse(
            source.contains("struct CommonActionButton"),
            "PromptPanelStyles must not redefine CommonActionButton."
        )
        XCTAssertFalse(
            source.contains("struct CommonIconButton"),
            "PromptPanelStyles must not redefine CommonIconButton."
        )
        XCTAssertFalse(
            source.contains("struct CommonTextField"),
            "PromptPanelStyles must not redefine CommonTextField."
        )
    }

    private func read(_ relativePath: String) throws -> String {
        let url = CommonComponentsThemeTests.repositoryRoot(from: #filePath)
            .appendingPathComponent(relativePath)
        return try String(contentsOf: url, encoding: .utf8)
    }
}
