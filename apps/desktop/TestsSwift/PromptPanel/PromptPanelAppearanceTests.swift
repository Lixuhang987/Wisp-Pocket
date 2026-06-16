import AppKit
import SwiftUI
import XCTest
@testable import HandAgentDesktop

@MainActor
final class PromptPanelAppearanceTests: XCTestCase {
    func testShowKeepsAquaForAppKitControlStabilization() {
        let controller = makeAppearanceController()
        controller.configure(viewModel: PromptPanelViewModel(actions: []))
        defer { controller.hide() }

        controller.show()

        let panel = Mirror(reflecting: controller).descendant("panel") as? NSPanel
        XCTAssertEqual(
            panel?.appearance?.bestMatch(from: [.aqua, .darkAqua]),
            .aqua
        )
    }

    func testUpdateThemeRefreshesExistingRootViewWithoutReplacingViewModel() {
        let controller = makeAppearanceController()
        let viewModel = PromptPanelViewModel(actions: [])
        viewModel.draft = "keep me"
        controller.configure(viewModel: viewModel)
        defer { controller.hide() }

        controller.show()
        controller.updateTheme(.dark)

        let panel = Mirror(reflecting: controller).descendant("panel") as? NSPanel
        let hosting = panel?.contentView as? NSHostingView<AnyView>
        XCTAssertNotNil(hosting)
        XCTAssertEqual(viewModel.draft, "keep me")
    }

    func testActionListScrollViewIsTransparentInRenderedPromptPanel() throws {
        let actions = (0..<20).map { index in
            ActionDefinition.skill(
                id: "action-\(index)",
                trigger: "trigger-\(index)",
                title: "Action \(index)",
                description: "Description \(index)",
                template: "Template \(index)",
                icons: [],
                defaultShortcut: nil
            )
        }
        let controller = makeAppearanceController()
        controller.register(actions: actions)
        controller.configure(viewModel: PromptPanelViewModel(actions: actions))
        defer { controller.hide() }

        controller.show()

        let panel = try XCTUnwrap(Mirror(reflecting: controller).descendant("panel") as? NSPanel)
        let hostingView = try XCTUnwrap(panel.contentView as? NSHostingView<AnyView>)
        hostingView.layoutSubtreeIfNeeded()
        flushMainQueue(times: 6)

        let scrollViews = collectScrollViews(in: hostingView)
        XCTAssertGreaterThanOrEqual(scrollViews.count, 1)
        let nonTextScrollViews = scrollViews.filter { !($0.documentView is NSTextView) }
        XCTAssertEqual(nonTextScrollViews.count, 1, describeViewTree(hostingView))
        let actionListScrollView = try XCTUnwrap(
            nonTextScrollViews.first,
            "Expected a non-text action list scroll view. Tree:\n\(describeViewTree(hostingView))"
        )

        XCTAssertFalse(actionListScrollView.drawsBackground, describeViewTree(hostingView))
        XCTAssertEqual(actionListScrollView.backgroundColor, .clear, describeViewTree(hostingView))
        XCTAssertFalse(actionListScrollView.contentView.drawsBackground, describeViewTree(hostingView))
        XCTAssertEqual(actionListScrollView.contentView.backgroundColor, .clear, describeViewTree(hostingView))
        XCTAssertTrue(actionListScrollView.verticalScroller is OverlayScroller, describeViewTree(hostingView))
    }
}

@MainActor
private func makeAppearanceController() -> PromptPanelController {
    PromptPanelController(
        focusRestorer: FakePromptPanelAppearanceFocusRestorer(),
        presentationMode: .hiddenForTesting
    )
}

@MainActor
private final class FakePromptPanelAppearanceFocusRestorer: PromptPanelFocusRestoring {
    typealias Token = Int

    func captureCurrentFocusOwner() -> Int? { nil }
    func restoreFocus(to token: Int) {}
}

@MainActor
private func collectScrollViews(in root: NSView) -> [NSScrollView] {
    var result: [NSScrollView] = []
    var queue: [NSView] = [root]
    while !queue.isEmpty {
        let node = queue.removeFirst()
        if let scrollView = node as? NSScrollView {
            result.append(scrollView)
        }
        queue.append(contentsOf: node.subviews)
    }
    return result
}

@MainActor
private func describeViewTree(_ root: NSView, indent: String = "") -> String {
    let frameDescription = NSStringFromRect(root.frame)
    let backgroundDescription: String
    if let scrollView = root as? NSScrollView {
        backgroundDescription = " drawsBackground=\(scrollView.drawsBackground) bg=\(scrollView.backgroundColor) clipBg=\(scrollView.contentView.backgroundColor) clipDraws=\(scrollView.contentView.drawsBackground) doc=\(String(describing: type(of: scrollView.documentView)))"
    } else {
        backgroundDescription = ""
    }

    let line = "\(indent)\(type(of: root)) frame=\(frameDescription)\(backgroundDescription)"
    let children = root.subviews.map { describeViewTree($0, indent: indent + "  ") }
    return ([line] + children).joined(separator: "\n")
}

@MainActor
private func flushMainQueue(times: Int) {
    guard times > 0 else { return }

    let expectation = XCTestExpectation(description: "flush-main-queue-\(times)")
    DispatchQueue.main.async {
        expectation.fulfill()
    }
    _ = XCTWaiter.wait(for: [expectation], timeout: 1)
    flushMainQueue(times: times - 1)
}
