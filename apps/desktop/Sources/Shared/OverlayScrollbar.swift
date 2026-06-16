import AppKit
import SwiftUI

// MARK: - Palette

struct OverlayScrollbarPalette {
    let thumbColor: NSColor
    let hoverThumbColor: NSColor
    let thumbInset: CGFloat
    let cornerRadius: CGFloat
    let width: CGFloat

    static func make(theme: AppTheme) -> OverlayScrollbarPalette {
        OverlayScrollbarPalette(
            thumbColor: NSColor(theme.colors.textPrimary).withAlphaComponent(0.28),
            hoverThumbColor: NSColor(theme.colors.textPrimary).withAlphaComponent(0.42),
            thumbInset: 3,
            cornerRadius: 999,
            width: 10
        )
    }
}

// MARK: - NSScroller subclass

@MainActor
final class OverlayScroller: NSScroller {
    var palette = OverlayScrollbarPalette(
        thumbColor: .clear,
        hoverThumbColor: .clear,
        thumbInset: 3,
        cornerRadius: 999,
        width: 10
    ) {
        didSet { needsDisplay = true }
    }

    private var hoverTrackingArea: NSTrackingArea?
    private var isHovered = false {
        didSet {
            guard isHovered != oldValue else { return }
            needsDisplay = true
        }
    }

    override class func scrollerWidth(
        for controlSize: NSControl.ControlSize,
        scrollerStyle: NSScroller.Style
    ) -> CGFloat {
        OverlayScrollbarPalette.make(theme: .default).width
    }

    override func updateTrackingAreas() {
        if let hoverTrackingArea {
            removeTrackingArea(hoverTrackingArea)
        }

        let trackingArea = NSTrackingArea(
            rect: bounds,
            options: [.activeInKeyWindow, .inVisibleRect, .mouseEnteredAndExited],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(trackingArea)
        hoverTrackingArea = trackingArea
        super.updateTrackingAreas()
    }

    override func mouseEntered(with event: NSEvent) {
        isHovered = true
        super.mouseEntered(with: event)
    }

    override func mouseExited(with event: NSEvent) {
        isHovered = false
        super.mouseExited(with: event)
    }

    override func drawKnobSlot(in slotRect: NSRect, highlight flag: Bool) {}

    override func drawKnob() {
        let knobRect = rect(for: .knob)
        guard !knobRect.isEmpty else { return }

        let insetRect = knobRect.insetBy(dx: palette.thumbInset, dy: palette.thumbInset)
        guard insetRect.width > 0, insetRect.height > 0 else { return }

        let color = isHovered ? palette.hoverThumbColor : palette.thumbColor
        color.setFill()
        NSBezierPath(
            roundedRect: insetRect,
            xRadius: min(palette.cornerRadius, insetRect.width / 2),
            yRadius: min(palette.cornerRadius, insetRect.width / 2)
        ).fill()
    }
}

// MARK: - Shared apply function

@MainActor
enum OverlayScrollbar {
    static func apply(to scrollView: NSScrollView, theme: AppTheme) {
        let palette = OverlayScrollbarPalette.make(theme: theme)

        scrollView.drawsBackground = false
        scrollView.backgroundColor = .clear
        scrollView.borderType = .noBorder
        scrollView.scrollerStyle = .overlay
        scrollView.autohidesScrollers = true
        scrollView.hasHorizontalScroller = false
        scrollView.contentView.drawsBackground = false
        scrollView.contentView.backgroundColor = .clear

        if let scroller = scrollView.verticalScroller as? OverlayScroller {
            scroller.palette = palette
        } else {
            let scroller = OverlayScroller()
            scroller.palette = palette
            scroller.scrollerStyle = .overlay
            scroller.controlSize = .small
            scrollView.verticalScroller = scroller
        }
    }
}

// MARK: - SwiftUI ViewModifier

struct OverlayScrollbarModifier: ViewModifier {
    @Environment(\.appTheme) private var theme

    func body(content: Content) -> some View {
        content.background(OverlayScrollbarFinder(theme: theme))
    }
}

extension View {
    func overlayScrollbar() -> some View {
        modifier(OverlayScrollbarModifier())
    }
}

// MARK: - Private helper

struct OverlayScrollbarFinder: NSViewRepresentable {
    let theme: AppTheme
    
    final class Coordinator {
        var pendingWorkItems: [DispatchWorkItem] = []

        func cancelPendingWork() {
            pendingWorkItems.forEach { $0.cancel() }
            pendingWorkItems.removeAll()
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> NSView {
        let view = NSView(frame: .zero)
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        Self.scheduleFindAndStyle(nsView, theme: theme, coordinator: context.coordinator)
    }

    @MainActor
    private static func findAndStyle(_ view: NSView, theme: AppTheme) {
        guard let root = rootAncestor(of: view) else { return }
        if let scrollView = nearestScrollView(to: view, in: root) {
            OverlayScrollbar.apply(to: scrollView, theme: theme)
        }
    }

    private static func scheduleFindAndStyle(
        _ view: NSView,
        theme: AppTheme,
        coordinator: Coordinator
    ) {
        coordinator.cancelPendingWork()

        let delays: [TimeInterval] = [0, 0.01, 0.05]
        coordinator.pendingWorkItems = delays.map { delay in
            let workItem = DispatchWorkItem {
                Self.findAndStyle(view, theme: theme)
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
            return workItem
        }
    }

    static func rootAncestor(of view: NSView) -> NSView? {
        var current: NSView? = view.superview
        while current?.superview != nil {
            current = current?.superview
        }
        return current
    }

    static func nearestScrollView(to view: NSView, in root: NSView) -> NSScrollView? {
        let overlayRect = root.convert(view.bounds, from: view)
        let overlayCenter = CGPoint(x: overlayRect.midX, y: overlayRect.midY)

        let candidates = allScrollViews(in: root).filter { !view.isDescendant(of: $0) }
        let scored = candidates
            .map { scrollView -> (scrollView: NSScrollView, score: CGFloat, distance: CGFloat)? in
                let scrollRect = root.convert(scrollView.bounds, from: scrollView)
                let intersection = overlayRect.intersection(scrollRect)
                let score = intersection.isNull ? 0 : intersection.width * intersection.height
                let distance = hypot(scrollRect.midX - overlayCenter.x, scrollRect.midY - overlayCenter.y)
                return (scrollView, score, distance)
            }
            .sorted {
                if $0?.score != $1?.score {
                    return ($0?.score ?? 0) > ($1?.score ?? 0)
                }
                return ($0?.distance ?? .greatestFiniteMagnitude) < ($1?.distance ?? .greatestFiniteMagnitude)
            }

        return scored.compactMap { $0?.scrollView }.first
    }

    private static func allScrollViews(in node: NSView) -> [NSScrollView] {
        var result: [NSScrollView] = []
        if let scrollView = node as? NSScrollView {
            result.append(scrollView)
        }
        for child in node.subviews {
            result.append(contentsOf: allScrollViews(in: child))
        }
        return result
    }
}
