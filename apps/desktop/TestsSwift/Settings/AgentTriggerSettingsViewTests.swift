import AppKit
import SwiftUI
import XCTest
@testable import HandAgentDesktop

@MainActor
final class AgentTriggerSettingsViewTests: XCTestCase {
    func testCancellingInvalidChromeAutomationClearsFormError() throws {
        try assertInvalidFormCanBeDismissed(
            packageId: "chrome-bookmarks",
            expectedError: "至少选择一个收藏夹文件夹",
            dismissButton: "取消"
        )
    }

    func testCollapsingInvalidChromeAutomationClearsFormError() throws {
        try assertInvalidFormCanBeDismissed(
            packageId: "chrome-bookmarks",
            expectedError: "至少选择一个收藏夹文件夹",
            dismissButton: "收起"
        )
    }

    func testCancellingInvalidClockAutomationClearsFormError() throws {
        try assertInvalidFormCanBeDismissed(
            packageId: "system-clock",
            expectedError: "标题不能为空",
            dismissButton: "取消"
        )
    }

    func testCollapsingInvalidClockAutomationClearsFormError() throws {
        try assertInvalidFormCanBeDismissed(
            packageId: "system-clock",
            expectedError: "标题不能为空",
            dismissButton: "收起"
        )
    }

    private func assertInvalidFormCanBeDismissed(
        packageId: String,
        expectedError: String,
        dismissButton: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        let homeURL = TestFiles.makeTemporaryHomeDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let store = AgentTriggerStore(homeDirectoryURL: homeURL)
        store.ensureBuiltinPackagesInstalled()
        let viewModel = AgentTriggerSettingsViewModel(
            store: store,
            chromeBookmarksFolderTreeStore: ChromeBookmarksFolderTreeStore(homeDirectoryURL: homeURL),
            packageConnectionStatusProvider: { _ in nil }
        )
        viewModel.targetPetId = "pet-test"
        viewModel.selectPackage(id: "system-clock")
        XCTAssertTrue(viewModel.createInstanceForCurrentPackage(
            title: "Existing automation",
            config: ["scheduleAt": .stringList(["09:00"]), "timezone": .string("UTC")]
        ), file: file, line: line)
        let savedInstances = store.loadInstances()
        viewModel.targetPetId = "pet-test"
        viewModel.selectPackage(id: packageId)

        let hosted = HostedAgentTriggerSettings(viewModel: viewModel)
        defer { hosted.close() }
        XCTAssertFalse(hosted.window.isVisible, file: file, line: line)

        try hosted.pressButton("新增自动化", file: file, line: line)
        try hosted.pressButton("保存", file: file, line: line)
        XCTAssertTrue(hosted.waitUntil {
            hosted.containsText(expectedError) && viewModel.saveErrorMessage == expectedError
        }, "The invalid save must show its validation error", file: file, line: line)
        XCTAssertTrue(hosted.hasButton("保存"), file: file, line: line)
        XCTAssertEqual(store.loadInstances(), savedInstances, file: file, line: line)

        try hosted.pressButton(dismissButton, file: file, line: line)
        XCTAssertTrue(hosted.waitUntil {
            hosted.hasButton("新增自动化") && !hosted.hasButton("保存")
        }, "The form must close", file: file, line: line)
        XCTAssertNil(viewModel.saveErrorMessage, file: file, line: line)
        XCTAssertTrue(hosted.waitUntil { !hosted.containsText(expectedError) },
                      "The dismissed form must not leave its error visible", file: file, line: line)

        try hosted.pressButton("新增自动化", file: file, line: line)
        XCTAssertTrue(hosted.waitUntil { hosted.hasButton("保存") }, file: file, line: line)
        XCTAssertFalse(hosted.containsText(expectedError), file: file, line: line)
        XCTAssertEqual(viewModel.selectedPackageId, packageId, file: file, line: line)
        XCTAssertEqual(viewModel.instances, savedInstances, file: file, line: line)
        XCTAssertEqual(AgentTriggerStore(homeDirectoryURL: homeURL).loadInstances(), savedInstances,
                       file: file, line: line)
        XCTAssertFalse(hosted.window.isVisible, file: file, line: line)
    }
}

@MainActor
private final class HostedAgentTriggerSettings {
    let window: NSWindow
    private let hostingView: NSHostingView<AgentTriggerSettingsView>
    private let application = NSApplication.shared
    private let enhancedUI = NSAccessibility.Attribute(rawValue: "AXEnhancedUserInterface")
    private let previousEnhancedUI: Any?

    init(viewModel: AgentTriggerSettingsViewModel) {
        // Enable AX only inside this process so an unshown SwiftUI host exposes its controls.
        previousEnhancedUI = application.accessibilityAttributeValue(enhancedUI)
        application.accessibilitySetValue(true, forAttribute: enhancedUI)
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 800, height: 1200),
            styleMask: [.titled],
            backing: .buffered,
            defer: false
        )
        window.isReleasedWhenClosed = false
        hostingView = NSHostingView(rootView: AgentTriggerSettingsView(viewModel: viewModel))
        window.contentView = hostingView
    }

    func close() {
        window.close()
        application.accessibilitySetValue(previousEnhancedUI, forAttribute: enhancedUI)
    }

    func pressButton(_ title: String, file: StaticString, line: UInt) throws {
        _ = waitUntil { hasButton(title) }
        let button = try XCTUnwrap(button(named: title), "Missing button: \(title)", file: file, line: line)
        XCTAssertEqual(button.accessibilityPerformPress?(), true, file: file, line: line)
    }

    func hasButton(_ title: String) -> Bool {
        button(named: title) != nil
    }

    func containsText(_ text: String) -> Bool {
        elements().contains { element in
            guard element.accessibilityRole?() == .staticText else { return false }
            let value: String? = element.accessibilityValue?()
            return value?.contains(text) == true || element.accessibilityLabel?()?.contains(text) == true
        }
    }

    func waitUntil(_ condition: () -> Bool) -> Bool {
        let deadline = Date(timeIntervalSinceNow: 1)
        repeat {
            hostingView.layoutSubtreeIfNeeded()
            if condition() { return true }
            RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.01))
        } while Date() < deadline
        return condition()
    }

    private func button(named title: String) -> AnyObject? {
        elements().first {
            $0.accessibilityRole?() == .button && $0.accessibilityLabel?() == title
        }
    }

    private func elements() -> [AnyObject] {
        var result: [AnyObject] = []
        var pending: [AnyObject] = [hostingView]
        var visited: Set<ObjectIdentifier> = []
        while let element = pending.popLast() {
            guard visited.insert(ObjectIdentifier(element)).inserted else { continue }
            result.append(element)
            // SwiftUI AX nodes implement these public selectors without declaring NSAccessibilityProtocol.
            pending.append(contentsOf: (element.accessibilityChildren?() ?? []).map { $0 as AnyObject })
        }
        return result
    }
}
