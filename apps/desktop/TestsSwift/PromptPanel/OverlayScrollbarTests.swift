import AppKit
import XCTest
@testable import HandAgentDesktop

@MainActor
final class OverlayScrollbarTests: XCTestCase {
    func testApplyUsesOverlayScrollerAndTransparentBackground() throws {
        let scrollView = NSScrollView()

        OverlayScrollbar.apply(to: scrollView, theme: .light)

        XCTAssertFalse(scrollView.drawsBackground)
        XCTAssertEqual(scrollView.backgroundColor, .clear)
        XCTAssertFalse(scrollView.contentView.drawsBackground)
        XCTAssertEqual(scrollView.contentView.backgroundColor, .clear)
        XCTAssertFalse(scrollView.hasHorizontalScroller)
        XCTAssertTrue(scrollView.autohidesScrollers)
        let scroller = try XCTUnwrap(scrollView.verticalScroller as? OverlayScroller)
        XCTAssertEqual(scroller.controlSize, .small)
    }

    func testPaletteUsesThemeTextColorOpacityForThumbs() {
        let palette = OverlayScrollbarPalette.make(theme: .dark)
        let expectedThumb = NSColor(AppTheme.dark.colors.textPrimary).withAlphaComponent(0.28)
        let expectedHover = NSColor(AppTheme.dark.colors.textPrimary).withAlphaComponent(0.42)

        XCTAssertEqual(palette.thumbInset, 3)
        XCTAssertEqual(palette.width, 10)
        XCTAssertTrue(palette.thumbColor.isEqual(expectedThumb))
        XCTAssertTrue(palette.hoverThumbColor.isEqual(expectedHover))
    }

    func testNearestScrollViewPrefersTheMostOverlappingScrollView() {
        let root = NSView(frame: NSRect(x: 0, y: 0, width: 640, height: 420))
        let promptPanelContainer = NSView(frame: root.bounds)
        let growingTextScrollView = NSScrollView(frame: NSRect(x: 32, y: 38, width: 180, height: 20))
        let actionContainer = NSView(frame: NSRect(x: 32, y: 113, width: 576, height: 275))
        let actionListScrollView = NSScrollView(frame: actionContainer.bounds)
        let overlayHost = NSView(frame: actionContainer.bounds)

        root.addSubview(promptPanelContainer)
        promptPanelContainer.addSubview(growingTextScrollView)
        promptPanelContainer.addSubview(actionContainer)
        actionContainer.addSubview(actionListScrollView)
        actionContainer.addSubview(overlayHost)

        XCTAssertEqual(
            OverlayScrollbarFinder.nearestScrollView(to: overlayHost, in: root),
            actionListScrollView
        )
    }
}
