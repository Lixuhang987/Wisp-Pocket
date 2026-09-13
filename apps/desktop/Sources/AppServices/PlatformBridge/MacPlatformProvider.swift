import AppKit
import ApplicationServices
import Carbon.HIToolbox
import CoreGraphics
import Foundation
import HandAgentHostAutomation
import ImageIO
@preconcurrency import ScreenCaptureKit
import UniformTypeIdentifiers
import Vision

private let macPlatformAXWindowNumberAttribute = "AXWindowNumber"

struct PlatformBridgeError: LocalizedError {
    let code: String
    let message: String

    var errorDescription: String? { "\(code): \(message)" }
}

@MainActor
protocol PlatformProvider {
    func handle(method: String, args: Any?) async throws -> Any?
}

@MainActor
final class MacPlatformProvider: PlatformProvider, HostAutomationCapabilities {
    func handle(method: String, args: Any?) async throws -> Any? {
        switch method {
        case "clipboard.read":
            return readClipboard()
        case "app.list":
            return appList()
        case "app.frontmost":
            return try await frontmostAppWindow()
        case "app.activate":
            let arguments = args as? [String: Any] ?? [:]
            if let bundleId = arguments["bundleId"], !(bundleId is String), !(bundleId is NSNull) {
                throw PlatformBridgeError(code: "invalid_argument", message: "app.activate bundleId must be a string")
            }
            try await activateApp(bundleId: arguments["bundleId"] as? String)
            return ["activated": true, "app": try readFrontmostAppWindow()["app"] ?? NSNull()]
        case "window.list":
            return windowList()
        case "screen.capture":
            return try await captureScreen(args: args)
        case "ocr.read":
            return try await readOCR(args: args)
        case "accessibility.snapshot":
            return try accessibilitySnapshot(args: args)
        case "accessibility.action":
            return try await accessibilityAction(args: args)
        default:
            throw PlatformBridgeError(
                code: "unknown_method",
                message: "Unknown platform method: \(method)"
            )
        }
    }

    func frontmostAppWindow() async throws -> [String: Any] {
        try readFrontmostAppWindow()
    }

    func accessibilitySnapshot() async throws -> [String: Any] {
        let frontmost = try readFrontmostAppWindow()
        guard let app = frontmost["app"] as? [String: Any], let pid = app["pid"] as? Int else {
            throw PlatformBridgeError(code: "not_found", message: "No frontmost app is available")
        }
        let root = try accessibilitySnapshot(args: ["kind": "app", "pid": pid])
        return ["root": root, "app": app, "window": frontmost["window"] ?? [:]]
    }

    func captureScreenshot() async throws -> [String: Any] {
        try await captureScreen(args: nil)
    }

    func activateApp(bundleId: String?) async throws {
        let app: NSRunningApplication?
        if let bundleId, !bundleId.isEmpty {
            app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
        } else {
            app = NSWorkspace.shared.frontmostApplication
        }
        guard let app else {
            throw PlatformBridgeError(code: "not_found", message: "No running app found for app.activate")
        }
        try await activateRunningApplication(app)
    }

    func performAction(_ arguments: [String: Any]) async throws {
        try await performAccessibilityAction(MacPlatformAccessibilityActionRequest.parseAutomation(arguments: arguments))
    }

    private func activateRunningApplication(_ app: NSRunningApplication) async throws {
        try Task.checkCancellation()
        guard !app.isTerminated else {
            throw PlatformBridgeError(code: "action_failed", message: "The target app terminated before activation")
        }
        if !app.isActive, app.processIdentifier == ProcessInfo.processInfo.processIdentifier {
            NSApp.activate(ignoringOtherApps: true)
        } else if !app.isActive && !app.activate(options: [.activateAllWindows]) {
            guard MacPlatformAccessibilityPermission.isTrusted() else {
                throw MacPlatformAccessibilityPermission.deniedError()
            }
            let element = AXUIElementCreateApplication(app.processIdentifier)
            let result = AXUIElementSetAttributeValue(element, kAXFrontmostAttribute as CFString, kCFBooleanTrue)
            guard result == .success else {
                throw PlatformBridgeError(
                    code: "action_failed",
                    message: "Cannot activate the background app through Accessibility: \(result.readableName)"
                )
            }
        }
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: .seconds(2))
        var activeSince: ContinuousClock.Instant?
        repeat {
            try Task.checkCancellation()
            guard !app.isTerminated else {
                throw PlatformBridgeError(code: "action_failed", message: "The target app terminated during activation")
            }
            if NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier, app.isActive {
                activeSince = activeSince ?? clock.now
                if let activeSince, clock.now - activeSince >= .milliseconds(150) { return }
            } else {
                activeSince = nil
            }
            try await Task.sleep(for: .milliseconds(50))
        } while clock.now < deadline
        throw PlatformBridgeError(code: "action_failed", message: "The target app did not become the stable frontmost app")
    }

    private func readClipboard() -> [String: Any?] {
        let pasteboard = NSPasteboard.general
        let text = pasteboard.string(forType: .string)
        return ["text": text as Any?]
    }

    private func appList() -> [[String: Any?]] {
        NSWorkspace.shared.runningApplications
            .sorted { lhs, rhs in
                (lhs.localizedName ?? lhs.bundleIdentifier ?? "") <
                    (rhs.localizedName ?? rhs.bundleIdentifier ?? "")
            }
            .map { app in
                [
                    "name": app.localizedName as Any?,
                    "bundleId": app.bundleIdentifier as Any?,
                    "pid": Int(app.processIdentifier),
                    "isActive": app.isActive,
                    "activationPolicy": app.activationPolicy.readableName,
                    "resolution": "best_effort",
                ]
            }
    }

    private func readFrontmostAppWindow() throws -> [String: Any] {
        guard let app = NSWorkspace.shared.frontmostApplication else {
            throw PlatformBridgeError(code: "not_found", message: "No frontmost app is available")
        }
        let appInfo: [String: Any?] = [
            "name": app.localizedName,
            "bundleId": app.bundleIdentifier,
            "pid": Int(app.processIdentifier),
            "resolution": "best_effort",
        ]
        let window = selectFrontmostWindow(appProcessIdentifier: Int(app.processIdentifier), windows: windowList())
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return [
            "app": appInfo.compactMapValues { $0 },
            "window": window?.compactMapValues { $0 } ?? [:],
            "timestamp": formatter.string(from: Date()),
        ]
    }

    private func windowList() -> [[String: Any?]] {
        let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
        let infoList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] ?? []
        return infoList.compactMap { info -> [String: Any?]? in
            let layer = info[kCGWindowLayer as String] as? Int ?? 0
            if layer != 0 { return nil }
            return [
                "id": info[kCGWindowNumber as String] as? Int as Any?,
                "title": info[kCGWindowName as String] as? String as Any?,
                "appName": info[kCGWindowOwnerName as String] as? String as Any?,
                "ownerPid": info[kCGWindowOwnerPID as String] as? Int as Any?,
            ]
        }
    }

    private func captureScreen(args: Any?) async throws -> [String: Any] {
        let argsDict = args as? [String: Any] ?? [:]
        let target = argsDict["target"] as? [String: Any]
        let request = try MacPlatformScreenCaptureTarget.parse(args: argsDict)

        let hasScreenCaptureAccess = try MacPlatformScreenCapturePermission.ensureAllowed()

        let content: SCShareableContent
        do {
            content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        } catch {
            throw MacPlatformScreenCapturePermission.shareableContentError(
                error,
                preflightAccess: hasScreenCaptureAccess
            )
        }

        switch request {
        case .window(let windowId):
            guard let window = content.windows.first(where: { $0.windowID == windowId }) else {
                throw PlatformBridgeError(code: "not_found", message: "No window found with id \(windowId)")
            }
            let image = try await captureImage(
                filter: SCContentFilter(desktopIndependentWindow: window),
                width: max(64, Int(window.frame.width)),
                height: max(64, Int(window.frame.height))
            )
            return try MacPlatformScreenshotResponse.make(image: image, target: target)

        case .region(let displayId, let cropRect):
            let display = try resolveDisplay(displayId: displayId, content: content)
            guard CGRect(x: 0, y: 0, width: display.width, height: display.height).contains(cropRect) else {
                throw PlatformBridgeError(
                    code: "invalid_argument",
                    message: "screen.capture region must fit inside display bounds (\(display.width)x\(display.height))"
                )
            }
            let full = try await captureImage(
                filter: SCContentFilter(display: display, excludingWindows: []),
                width: display.width,
                height: display.height
            )
            guard let cropped = full.cropping(to: cropRect) else {
                throw PlatformBridgeError(
                    code: "capture_failed",
                    message: "Screen capture could not crop the requested region"
                )
            }
            return try MacPlatformScreenshotResponse.make(image: cropped, target: target)

        case .display(let displayId):
            let display = try resolveDisplay(displayId: displayId, content: content)
            let image = try await captureImage(
                filter: SCContentFilter(display: display, excludingWindows: []),
                width: display.width,
                height: display.height
            )
            return try MacPlatformScreenshotResponse.make(image: image, target: target)
        }
    }

    private func resolveDisplay(displayId: UInt32?, content: SCShareableContent) throws -> SCDisplay {
        if let displayId {
            guard let found = content.displays.first(where: { $0.displayID == displayId }) else {
                throw PlatformBridgeError(code: "not_found", message: "No display found with id \(displayId)")
            }
            return found
        }
        guard let first = content.displays.first else {
            throw PlatformBridgeError(code: "not_found", message: "No displays available")
        }
        return first
    }

    private func captureImage(filter: SCContentFilter, width: Int, height: Int) async throws -> CGImage {
        let config = SCStreamConfiguration()
        config.width = max(1, width)
        config.height = max(1, height)
        config.showsCursor = false
        do {
            return try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
        } catch {
            throw PlatformBridgeError(
                code: "capture_failed",
                message: "ScreenCaptureKit capture failed: \(error.localizedDescription)"
            )
        }
    }

    private func readOCR(args: Any?) async throws -> [String: Any] {
        let request = try MacPlatformOCRRequest.parse(args: args)
        guard let source = CGImageSourceCreateWithData(request.imageData as CFData, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            throw PlatformBridgeError(
                code: "invalid_argument",
                message: "ocr.read imageBase64 must contain a decodable image"
            )
        }

        let observations = try recognizeText(in: image, language: request.language)
        let lines = observations.compactMap { observation -> [String: Any]? in
            guard let candidate = observation.topCandidates(1).first else { return nil }
            return [
                "text": candidate.string,
                "confidence": Double(candidate.confidence),
            ]
        }
        let text = lines.compactMap { $0["text"] as? String }.joined(separator: "\n")
        return [
            "text": text,
            "lines": lines,
            "resolution": "best_effort",
        ]
    }

    private func recognizeText(in image: CGImage, language: String?) throws -> [VNRecognizedTextObservation] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        if let language, !language.isEmpty {
            request.recognitionLanguages = [language]
        }

        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        do {
            try handler.perform([request])
            return request.results ?? []
        } catch {
            throw PlatformBridgeError(
                code: "ocr_failed",
                message: "Vision OCR failed: \(error.localizedDescription)"
            )
        }
    }

    private func accessibilitySnapshot(args: Any?) throws -> [String: Any?] {
        let request = try MacPlatformAccessibilitySnapshotRequest.parse(args: args)
        guard MacPlatformAccessibilityPermission.isTrusted() else {
            throw MacPlatformAccessibilityPermission.deniedError()
        }
        let root = try resolveSnapshotRoot(for: request.target)
        var role: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(root.element, kAXRoleAttribute as CFString, &role)
        guard result == .success else {
            throw PlatformBridgeError(code: "snapshot_failed", message: "Accessibility snapshot failed: \(result.readableName)")
        }
        return snapshot(
            element: root.element,
            target: request.target.dictionary,
            elementId: root.elementId,
            depth: 0,
            maxDepth: request.maxDepth,
            maxChildren: request.maxChildren
        )
    }

    private func accessibilityAction(args: Any?) async throws -> [String: Any] {
        let request = try MacPlatformAccessibilityActionRequest.parse(args: args)
        try await performAccessibilityAction(request)
        return [
            "ok": true,
            "target": request.target.dictionary,
            "action": request.action.dictionary,
            "resolution": "best_effort",
        ]
    }

    private func performAccessibilityAction(_ request: MacPlatformAccessibilityActionRequest) async throws {
        try Task.checkCancellation()
        guard MacPlatformAccessibilityPermission.isTrusted() else {
            throw MacPlatformAccessibilityPermission.deniedError()
        }
        if case .position(let x, let y, let button) = request.target {
            try performMouseClick(at: CGPoint(x: x, y: y), button: button)
            return
        }

        switch request.action {
        case .press:
            try performPress(on: resolveActionTarget(request.target), actionName: "press")
        case .click:
            let element = try resolveActionTarget(request.target)
            do {
                try performPress(on: element, actionName: "click")
            } catch {
                try performMouseClick(on: element)
            }
        case .setValue(let value):
            let element = try resolveActionTarget(request.target)
            let result = AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, value as CFTypeRef)
            guard result == .success else {
                throw PlatformBridgeError(
                    code: "action_failed",
                    message: "accessibility.action set_value failed: \(result.readableName)"
                )
            }
        case .typeText(let text):
            let element = try resolveActionTarget(request.target)
            try await prepareKeyboardTarget(element, target: request.target)
            try Task.checkCancellation()
            for event in try MacPlatformKeyboard.textEvents(text) { event.post(tap: .cghidEventTap) }
        case .hotkey(let hotkey):
            if request.target != .frontmostApp {
                try await prepareKeyboardTarget(resolveActionTarget(request.target), target: request.target)
            } else if NSWorkspace.shared.frontmostApplication == nil {
                throw PlatformBridgeError(code: "not_found", message: "No frontmost app for hotkey")
            }
            try Task.checkCancellation()
            for event in try MacPlatformKeyboard.hotkeyEvents(hotkey) { event.post(tap: .cghidEventTap) }
        }
    }

    private func prepareKeyboardTarget(_ element: AXUIElement, target: MacPlatformAccessibilityActionTarget) async throws {
        var pid: pid_t = 0
        guard AXUIElementGetPid(element, &pid) == .success,
              let app = NSRunningApplication(processIdentifier: pid) else {
            throw PlatformBridgeError(code: "not_found", message: "No running app owns the keyboard target")
        }
        if target == .frontmostApp {
            guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid else {
                throw PlatformBridgeError(code: "action_failed", message: "The focused input no longer belongs to the frontmost app")
            }
            return
        }
        if NSWorkspace.shared.frontmostApplication?.processIdentifier != pid || !app.isActive {
            try await activateRunningApplication(app)
        }
        let result: AXError
        if copyStringAttribute(element, kAXRoleAttribute) == kAXWindowRole {
            result = AXUIElementPerformAction(element, kAXRaiseAction as CFString)
        } else {
            result = AXUIElementSetAttributeValue(element, kAXFocusedAttribute as CFString, kCFBooleanTrue)
        }
        guard result == .success else {
            throw PlatformBridgeError(code: "action_failed", message: "Cannot focus keyboard target: \(result.readableName)")
        }
        try await Task.sleep(for: .milliseconds(50))
        guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid else {
            throw PlatformBridgeError(code: "action_failed", message: "The target app lost focus before keyboard input")
        }
    }

    private func resolveSnapshotRoot(
        for target: MacPlatformAccessibilitySnapshotTarget
    ) throws -> (element: AXUIElement, elementId: String?) {
        switch target {
        case .frontmostApp:
            guard let pid = NSWorkspace.shared.frontmostApplication?.processIdentifier else {
                throw PlatformBridgeError(code: "not_found", message: "No frontmost app is available")
            }
            return (AXUIElementCreateApplication(pid), "pid:\(pid);path:")
        case .app(let pid, let bundleId):
            let resolvedPid: pid_t?
            if let pid {
                resolvedPid = pid_t(pid)
            } else if let bundleId {
                resolvedPid = NSWorkspace.shared.runningApplications
                    .first(where: { $0.bundleIdentifier == bundleId })?
                    .processIdentifier
            } else {
                resolvedPid = NSWorkspace.shared.frontmostApplication?.processIdentifier
            }
            guard let resolvedPid else {
                throw PlatformBridgeError(code: "not_found", message: "No matching app found for accessibility.snapshot")
            }
            return (AXUIElementCreateApplication(resolvedPid), "pid:\(resolvedPid);path:")
        case .window(let windowId):
            let app = try appForWindow(windowId: windowId)
            let appElement = AXUIElementCreateApplication(app.processIdentifier)
            guard let window = accessibilityWindow(
                appElement: appElement,
                windowId: windowId,
                appProcessIdentifier: app.processIdentifier
            ) else {
                let message = windowId.map {
                    "No accessibility window found for windowId \($0)"
                } ?? "No focused window found for accessibility.snapshot"
                throw PlatformBridgeError(code: "not_found", message: message)
            }
            return (window, nil)
        case .element(let pid, let path):
            let root = AXUIElementCreateApplication(pid_t(pid))
            return (try element(root: root, path: path), "pid:\(pid);path:\(path.map(String.init).joined(separator: "."))")
        }
    }

    private func resolveActionTarget(_ target: MacPlatformAccessibilityActionTarget) throws -> AXUIElement {
        switch target {
        case .frontmostApp:
            let systemWide = AXUIElementCreateSystemWide()
            guard let focused = copyElementAttribute(systemWide, kAXFocusedUIElementAttribute) else {
                throw PlatformBridgeError(code: "not_found", message: "No focused accessibility element found")
            }
            return focused
        case .window(let windowId):
            let app = try appForWindow(windowId: windowId)
            let appElement = AXUIElementCreateApplication(app.processIdentifier)
            guard let window = accessibilityWindow(
                appElement: appElement,
                windowId: windowId,
                appProcessIdentifier: app.processIdentifier
            ) else {
                let message = windowId.map {
                    "No accessibility window found for windowId \($0)"
                } ?? "No focused window found for accessibility.action"
                throw PlatformBridgeError(code: "not_found", message: message)
            }
            return window
        case .element(let pid, let path):
            let root = AXUIElementCreateApplication(pid_t(pid))
            return try element(root: root, path: path)
        case .selector(let role, let title):
            guard let pid = NSWorkspace.shared.frontmostApplication?.processIdentifier else {
                throw PlatformBridgeError(code: "not_found", message: "No frontmost app for AX selector")
            }
            let app = AXUIElementCreateApplication(pid)
            guard let element = findElement(role: role, title: title, in: app, depth: 0) else {
                throw PlatformBridgeError(code: "not_found", message: "No accessibility element matched role/title selector")
            }
            return element
        case .position:
            throw PlatformBridgeError(code: "invalid_argument", message: "A position can only be used with click")
        }
    }

    private func findElement(role: String?, title: String?, in element: AXUIElement, depth: Int) -> AXUIElement? {
        if (role == nil || copyStringAttribute(element, kAXRoleAttribute) == role),
           (title == nil || copyStringAttribute(element, kAXTitleAttribute) == title) {
            return element
        }
        guard depth < 8 else { return nil }
        for child in copyElementArrayAttribute(element, kAXChildrenAttribute).prefix(80) {
            if let match = findElement(role: role, title: title, in: child, depth: depth + 1) { return match }
        }
        return nil
    }

    private func appForWindow(windowId: Int?) throws -> NSRunningApplication {
        if let windowId {
            guard let window = cgWindowMetadata(windowId: windowId),
                  let app = NSRunningApplication(processIdentifier: pid_t(window.ownerPid)) else {
                throw PlatformBridgeError(code: "not_found", message: "No app found for windowId \(windowId)")
            }
            return app
        }
        guard let app = NSWorkspace.shared.frontmostApplication else {
            throw PlatformBridgeError(code: "not_found", message: "No frontmost app is available")
        }
        return app
    }

    private func element(root: AXUIElement, path: [Int]) throws -> AXUIElement {
        var current = root
        for index in path {
            let children = copyElementArrayAttribute(current, kAXChildrenAttribute)
            guard children.indices.contains(index) else {
                throw PlatformBridgeError(
                    code: "not_found",
                    message: "No accessibility element found at path \(path.map(String.init).joined(separator: "."))"
                )
            }
            current = children[index]
        }
        return current
    }

    private func accessibilityWindow(
        appElement: AXUIElement,
        windowId: Int?,
        appProcessIdentifier: pid_t
    ) -> AXUIElement? {
        selectAccessibilityWindow(
            windowId: windowId,
            focusedWindow: copyElementAttribute(appElement, kAXFocusedWindowAttribute),
            windows: copyElementArrayAttribute(appElement, kAXWindowsAttribute),
            targetWindow: windowId.flatMap(cgWindowMetadata),
            appProcessIdentifier: Int(appProcessIdentifier),
            windowNumber: { copyIntAttribute($0, macPlatformAXWindowNumberAttribute) },
            windowTitle: { copyStringAttribute($0, kAXTitleAttribute) },
            windowFrame: { copyFrameRect($0) }
        )
    }

    private func snapshot(
        element: AXUIElement,
        target: [String: Any]?,
        elementId: String?,
        depth: Int,
        maxDepth: Int,
        maxChildren: Int
    ) -> [String: Any?] {
        let role = copyStringAttribute(element, kAXRoleAttribute) ?? "unknown"
        let title = copyStringAttribute(element, kAXTitleAttribute)
        let value = copyStringAttribute(element, kAXValueAttribute)
        let description = copyStringAttribute(element, kAXDescriptionAttribute)
        let frame = copyFrame(element)
        let children: [[String: Any?]]

        if depth >= maxDepth {
            children = []
        } else {
            children = Array(copyElementArrayAttribute(element, kAXChildrenAttribute).prefix(maxChildren)).enumerated()
                .map { index, child in
                    let childId = elementId.map { base in
                        base.hasSuffix("path:")
                            ? "\(base)\(index)"
                            : "\(base).\(index)"
                    }
                    return snapshot(
                        element: child,
                        target: nil,
                        elementId: childId,
                        depth: depth + 1,
                        maxDepth: maxDepth,
                        maxChildren: maxChildren
                    )
                }
        }

        return [
            "role": role,
            "label": title ?? description,
            "title": title,
            "value": value,
            "description": description,
            "frame": frame,
            "elementId": elementId,
            "target": target,
            "children": children,
            "resolution": "best_effort",
        ]
    }

    private func performPress(on element: AXUIElement, actionName: String) throws {
        let result = AXUIElementPerformAction(element, kAXPressAction as CFString)
        guard result == .success else {
            throw PlatformBridgeError(
                code: "action_failed",
                message: "accessibility.action \(actionName) failed: \(result.readableName)"
            )
        }
    }

    private func performMouseClick(on element: AXUIElement) throws {
        guard let frame = copyFrame(element) else {
            throw PlatformBridgeError(
                code: "action_failed",
                message: "accessibility.action click failed: element has no frame for fallback click"
            )
        }
        guard let x = frame["x"], let y = frame["y"], let width = frame["width"], let height = frame["height"] else {
            throw PlatformBridgeError(
                code: "action_failed",
                message: "accessibility.action click failed: element frame is incomplete"
            )
        }
        let point = CGPoint(x: x + width / 2, y: y + height / 2)
        try performMouseClick(at: point, button: .left)
    }

    private func performMouseClick(at point: CGPoint, button: MacPlatformMouseButton) throws {
        guard let down = CGEvent(mouseEventSource: nil, mouseType: button.downEvent, mouseCursorPosition: point, mouseButton: button.cgButton),
              let up = CGEvent(mouseEventSource: nil, mouseType: button.upEvent, mouseCursorPosition: point, mouseButton: button.cgButton) else {
            throw PlatformBridgeError(code: "action_failed", message: "accessibility.action click failed: cannot create mouse event")
        }
        down.setIntegerValueField(.mouseEventClickState, value: 1)
        up.setIntegerValueField(.mouseEventClickState, value: 1)
        down.post(tap: .cghidEventTap)
        up.post(tap: .cghidEventTap)
    }

    private func copyElementAttribute(_ element: AXUIElement, _ attribute: String) -> AXUIElement? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success,
              let value,
              CFGetTypeID(value) == AXUIElementGetTypeID() else {
            return nil
        }
        return (value as! AXUIElement)
    }

    private func copyElementArrayAttribute(_ element: AXUIElement, _ attribute: String) -> [AXUIElement] {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success,
              let array = value as? [AXUIElement] else {
            return []
        }
        return array
    }

    private func copyStringAttribute(_ element: AXUIElement, _ attribute: String) -> String? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success else { return nil }
        if let string = value as? String {
            return string
        }
        if let number = value as? NSNumber {
            return number.stringValue
        }
        return nil
    }

    private func copyIntAttribute(_ element: AXUIElement, _ attribute: String) -> Int? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success else { return nil }
        if let int = value as? Int {
            return int
        }
        if let number = value as? NSNumber {
            return number.intValue
        }
        return nil
    }

    private func copyFrame(_ element: AXUIElement) -> [String: Double]? {
        guard let frame = copyFrameRect(element) else { return nil }
        return [
            "x": frame.origin.x,
            "y": frame.origin.y,
            "width": frame.width,
            "height": frame.height,
        ]
    }

    private func copyFrameRect(_ element: AXUIElement) -> CGRect? {
        var positionValue: CFTypeRef?
        var sizeValue: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &positionValue) == .success,
              AXUIElementCopyAttributeValue(element, kAXSizeAttribute as CFString, &sizeValue) == .success,
              let positionAX = positionValue,
              let sizeAX = sizeValue else {
            return nil
        }

        guard CFGetTypeID(positionAX) == AXValueGetTypeID(),
              CFGetTypeID(sizeAX) == AXValueGetTypeID() else {
            return nil
        }

        var point = CGPoint.zero
        var size = CGSize.zero
        guard AXValueGetValue((positionAX as! AXValue), .cgPoint, &point),
              AXValueGetValue((sizeAX as! AXValue), .cgSize, &size) else {
            return nil
        }
        return CGRect(origin: point, size: size)
    }
}

struct MacPlatformOCRRequest: Equatable {
    let imageData: Data
    let mimeType: String?
    let language: String?

    static func parse(args: Any?) throws -> MacPlatformOCRRequest {
        let argsDict = args as? [String: Any] ?? [:]
        guard let imageBase64 = argsDict["imageBase64"] as? String, !imageBase64.isEmpty else {
            throw PlatformBridgeError(code: "invalid_argument", message: "ocr.read requires non-empty imageBase64")
        }
        guard let imageData = Data(base64Encoded: imageBase64) else {
            throw PlatformBridgeError(code: "invalid_argument", message: "ocr.read imageBase64 must be valid base64")
        }
        let mimeType = argsDict["mimeType"] as? String
        if let mimeType, !["image/png", "image/jpeg", "image/webp"].contains(mimeType) {
            throw PlatformBridgeError(code: "invalid_argument", message: "ocr.read unsupported mimeType: \(mimeType)")
        }
        return MacPlatformOCRRequest(
            imageData: imageData,
            mimeType: mimeType,
            language: argsDict["language"] as? String
        )
    }
}

enum MacPlatformAccessibilityPermission {
    static func isTrusted() -> Bool {
        AXIsProcessTrustedWithOptions(["AXTrustedCheckOptionPrompt": false] as CFDictionary)
    }

    static func deniedError() -> PlatformBridgeError {
        PlatformBridgeError(
            code: "permission_denied",
            message: "Wisp Pocket 没有辅助功能权限。请打开「系统设置 → 隐私与安全性 → 辅助功能」，允许 Wisp Pocket 后重试。"
        )
    }
}

enum MacPlatformScreenCapturePermission {
    static func isAllowed() -> Bool {
        CGPreflightScreenCaptureAccess()
    }

    static func requestAccess() -> Bool {
        CGRequestScreenCaptureAccess()
    }

    static func ensureAllowed(
        preflight: () -> Bool = isAllowed,
        request: () -> Bool = requestAccess
    ) throws -> Bool {
        if preflight() {
            return true
        }
        guard request() else {
            throw deniedError()
        }
        return true
    }

    static func deniedError() -> PlatformBridgeError {
        PlatformBridgeError(
            code: "permission_denied",
            message: "Wisp Pocket 没有屏幕录制权限。请打开「系统设置 → 隐私与安全性 → 屏幕录制」，允许 Wisp Pocket 后重试。"
        )
    }

    static func shareableContentError(_ error: Error, preflightAccess: Bool) -> PlatformBridgeError {
        let nsError = error as NSError
        return PlatformBridgeError(
            code: preflightAccess ? "capture_failed" : "permission_denied",
            message: """
            Failed to enumerate ScreenCaptureKit shareable content \
            (preflight=\(preflightAccess), domain=\(nsError.domain), code=\(nsError.code), message=\(nsError.localizedDescription)).
            """
        )
    }
}

enum MacPlatformScreenCaptureTarget: Equatable {
    case display(id: UInt32?)
    case window(id: UInt32)
    case region(displayId: UInt32?, rect: CGRect)

    static func parse(args: [String: Any]) throws -> MacPlatformScreenCaptureTarget {
        if let target = args["target"], !(target is [String: Any]) {
            throw PlatformBridgeError(code: "invalid_argument", message: "screen.capture target must be an object")
        }
        let target = args["target"] as? [String: Any] ?? [:]
        if let kind = target["kind"], !(kind is String) {
            throw PlatformBridgeError(code: "invalid_argument", message: "screen.capture target kind must be a string")
        }
        var displayId: UInt32?
        for key in ["displayId", "screenId"] {
            guard let value = target[key] else { continue }
            guard let string = value as? String, let id = UInt32(string), id > 0 else {
                throw PlatformBridgeError(code: "invalid_argument", message: "screen.capture \(key) must be a positive display identifier string")
            }
            guard displayId == nil || displayId == id else {
                throw PlatformBridgeError(code: "invalid_argument", message: "screen.capture displayId and screenId must agree")
            }
            displayId = id
        }
        switch target["kind"] as? String ?? "display" {
        case "display":
            return .display(id: displayId)
        case "window":
            guard let integer = intValue(target["windowId"]), let id = UInt32(exactly: integer), id > 0 else {
                throw PlatformBridgeError(code: "invalid_argument", message: "screen.capture window target requires a positive integer windowId")
            }
            return .window(id: id)
        case "region":
            guard let x = intValue(target["x"]), let y = intValue(target["y"]),
                  let width = intValue(target["width"]), let height = intValue(target["height"]),
                  x >= 0, y >= 0, width > 0, height > 0 else {
                throw PlatformBridgeError(code: "invalid_argument", message: "screen.capture region requires integer x/y >= 0 and width/height > 0")
            }
            return .region(displayId: displayId, rect: CGRect(x: x, y: y, width: width, height: height))
        default:
            throw PlatformBridgeError(code: "invalid_argument", message: "screen.capture target kind must be display, window or region")
        }
    }
}

struct MacPlatformAccessibilitySnapshotRequest: Equatable {
    let target: MacPlatformAccessibilitySnapshotTarget
    let maxDepth: Int
    let maxChildren: Int

    static func parse(args: Any?) throws -> MacPlatformAccessibilitySnapshotRequest {
        let argsDict = args as? [String: Any] ?? [:]
        let target = try MacPlatformAccessibilitySnapshotTarget.parse(args: argsDict)
        return MacPlatformAccessibilitySnapshotRequest(
            target: target,
            maxDepth: clampedInt(argsDict["maxDepth"], defaultValue: 4, minValue: 0, maxValue: 6),
            maxChildren: clampedInt(argsDict["maxChildren"], defaultValue: 25, minValue: 1, maxValue: 50)
        )
    }
}

enum MacPlatformAccessibilitySnapshotTarget: Equatable {
    case frontmostApp
    case app(pid: Int?, bundleId: String?)
    case window(windowId: Int?)
    case element(pid: Int, path: [Int])

    var dictionary: [String: Any] {
        switch self {
        case .frontmostApp:
            return ["kind": "frontmost_app"]
        case .app(let pid, let bundleId):
            var value: [String: Any] = ["kind": "app"]
            if let pid { value["pid"] = pid }
            if let bundleId { value["bundleId"] = bundleId }
            return value
        case .window(let windowId):
            var value: [String: Any] = ["kind": "window"]
            if let windowId { value["windowId"] = windowId }
            return value
        case .element(let pid, let path):
            return ["kind": "element", "elementId": elementId(pid: pid, path: path)]
        }
    }

    static func parse(args: [String: Any]) throws -> MacPlatformAccessibilitySnapshotTarget {
        if let kind = args["kind"], !(kind is String) {
            throw PlatformBridgeError(code: "invalid_argument", message: "accessibility.snapshot kind must be a string")
        }
        let kind = args["kind"] as? String ?? "frontmost_app"
        switch kind {
        case "frontmost_app":
            return .frontmostApp
        case "app":
            if let bundleId = args["bundleId"], !(bundleId is String) {
                throw PlatformBridgeError(code: "invalid_argument", message: "accessibility.snapshot bundleId must be a string")
            }
            return .app(pid: try nativeIdentifier(args["pid"], name: "pid", maximum: Int(Int32.max)), bundleId: args["bundleId"] as? String)
        case "window":
            return .window(windowId: try nativeIdentifier(args["windowId"], name: "windowId", maximum: Int(UInt32.max)))
        case "element":
            guard let elementId = args["elementId"] as? String else {
                throw PlatformBridgeError(code: "invalid_argument", message: "accessibility.snapshot element target requires elementId")
            }
            let parsed = try parseElementId(elementId)
            return .element(pid: parsed.pid, path: parsed.path)
        default:
            throw PlatformBridgeError(code: "invalid_argument", message: "Unknown accessibility.snapshot target kind: \(kind)")
        }
    }
}

struct MacPlatformAccessibilityActionRequest: Equatable {
    let target: MacPlatformAccessibilityActionTarget
    let action: MacPlatformAccessibilityAction

    static func parse(args: Any?) throws -> MacPlatformAccessibilityActionRequest {
        let argsDict = args as? [String: Any] ?? [:]
        if let target = argsDict["target"], !(target is [String: Any]), !(target is NSNull) {
            throw PlatformBridgeError(code: "invalid_argument", message: "accessibility.action target must be an object")
        }
        guard let actionDict = argsDict["action"] as? [String: Any] else {
            throw PlatformBridgeError(code: "invalid_argument", message: "accessibility.action requires action")
        }
        let target = try MacPlatformAccessibilityActionTarget.parse(args: argsDict["target"] as? [String: Any] ?? [:])
        let action = try MacPlatformAccessibilityAction.parse(args: actionDict)
        if case .position = target, action != .click {
            throw PlatformBridgeError(code: "invalid_argument", message: "A position can only be used with click")
        }
        return MacPlatformAccessibilityActionRequest(target: target, action: action)
    }

    static func parseAutomation(arguments: [String: Any]) throws -> MacPlatformAccessibilityActionRequest {
        guard let kind = arguments["action"] as? String else {
            throw PlatformBridgeError(code: "invalid_argument", message: "Automation action requires an action name")
        }
        for key in ["selector", "position"] {
            if let value = arguments[key], !(value is [String: Any]), !(value is NSNull) {
                throw PlatformBridgeError(code: "invalid_argument", message: "Automation \(key) must be an object")
            }
        }
        var action = arguments
        action["kind"] = kind
        var target: [String: Any] = [:]
        if let selector = arguments["selector"] as? [String: Any], !selector.isEmpty {
            target = selector
            target["kind"] = "selector"
        } else if let position = arguments["position"] as? [String: Any] {
            target = position
            target["kind"] = "position"
            if let button = arguments["button"] { target["button"] = button }
        }
        return try parse(args: ["target": target, "action": action])
    }
}

enum MacPlatformAccessibilityActionTarget: Equatable {
    case frontmostApp
    case window(windowId: Int?)
    case element(pid: Int, path: [Int])
    case selector(role: String?, title: String?)
    case position(x: Double, y: Double, button: MacPlatformMouseButton)

    var dictionary: [String: Any] {
        switch self {
        case .frontmostApp:
            return ["kind": "frontmost_app"]
        case .window(let windowId):
            var value: [String: Any] = ["kind": "window"]
            if let windowId { value["windowId"] = windowId }
            return value
        case .element(let pid, let path):
            return ["kind": "element", "elementId": elementId(pid: pid, path: path)]
        case .selector(let role, let title):
            var value: [String: Any] = ["kind": "selector"]
            if let role { value["role"] = role }
            if let title { value["title"] = title }
            return value
        case .position(let x, let y, let button):
            return ["kind": "position", "x": x, "y": y, "button": button.rawValue]
        }
    }

    static func parse(args: [String: Any]) throws -> MacPlatformAccessibilityActionTarget {
        if let kind = args["kind"], !(kind is String) {
            throw PlatformBridgeError(code: "invalid_argument", message: "accessibility.action target kind must be a string")
        }
        let kind = args["kind"] as? String ?? "frontmost_app"
        switch kind {
        case "frontmost_app":
            return .frontmostApp
        case "window":
            return .window(windowId: try nativeIdentifier(args["windowId"], name: "windowId", maximum: Int(UInt32.max)))
        case "element":
            guard let elementId = args["elementId"] as? String else {
                throw PlatformBridgeError(code: "invalid_argument", message: "accessibility.action element target requires elementId")
            }
            let parsed = try parseElementId(elementId)
            return .element(pid: parsed.pid, path: parsed.path)
        case "selector":
            for key in ["role", "title"] where args[key] != nil && !(args[key] is String) {
                throw PlatformBridgeError(code: "invalid_argument", message: "AX selector \(key) must be a string")
            }
            let role = args["role"] as? String
            let title = args["title"] as? String
            guard role != nil || title != nil else {
                throw PlatformBridgeError(code: "invalid_argument", message: "An AX selector requires role or title")
            }
            return .selector(role: role, title: title)
        case "position":
            guard let x = finiteCoordinate(args["x"]), let y = finiteCoordinate(args["y"]) else {
                throw PlatformBridgeError(code: "invalid_argument", message: "A click position requires finite x/y coordinates")
            }
            if let button = args["button"], !(button is String) {
                throw PlatformBridgeError(code: "invalid_argument", message: "Click button must be left, right or other")
            }
            guard let button = MacPlatformMouseButton(rawValue: args["button"] as? String ?? "left") else {
                throw PlatformBridgeError(code: "invalid_argument", message: "Click button must be left, right or other")
            }
            return .position(x: x, y: y, button: button)
        default:
            throw PlatformBridgeError(code: "invalid_argument", message: "Unknown accessibility.action target kind: \(kind)")
        }
    }
}

enum MacPlatformAccessibilityAction: Equatable {
    case press
    case click
    case setValue(String)
    case typeText(String)
    case hotkey(MacPlatformHotkey)

    var dictionary: [String: Any] {
        switch self {
        case .press:
            return ["kind": "press"]
        case .click:
            return ["kind": "click"]
        case .setValue(let value):
            return ["kind": "set_value", "value": value]
        case .typeText(let text):
            return ["kind": "type_text", "text": text]
        case .hotkey(let hotkey):
            return ["kind": "hotkey", "keys": hotkey.keys]
        }
    }

    static func parse(args: [String: Any]) throws -> MacPlatformAccessibilityAction {
        let kind = args["kind"] as? String
        switch kind {
        case "press":
            return .press
        case "click":
            return .click
        case "set_value":
            guard let value = args["value"] as? String else {
                throw PlatformBridgeError(code: "invalid_argument", message: "accessibility.action set_value requires value")
            }
            return .setValue(value)
        case "type_text":
            guard let text = args["text"] as? String else {
                throw PlatformBridgeError(code: "invalid_argument", message: "accessibility.action type_text requires text")
            }
            return .typeText(text)
        case "hotkey":
            return .hotkey(try MacPlatformHotkey.parse(args["keys"]))
        default:
            throw PlatformBridgeError(code: "invalid_argument", message: "Unknown accessibility.action kind: \(kind ?? "nil")")
        }
    }
}

enum MacPlatformMouseButton: String {
    case left, right, other

    var cgButton: CGMouseButton {
        switch self {
        case .left: .left
        case .right: .right
        case .other: .center
        }
    }

    var downEvent: CGEventType {
        switch self {
        case .left: .leftMouseDown
        case .right: .rightMouseDown
        case .other: .otherMouseDown
        }
    }

    var upEvent: CGEventType {
        switch self {
        case .left: .leftMouseUp
        case .right: .rightMouseUp
        case .other: .otherMouseUp
        }
    }
}

struct MacPlatformHotkey: Equatable {
    let keyCode: CGKeyCode
    let modifiers: CGEventFlags
    let keys: [String]

    static func parse(_ value: Any?) throws -> MacPlatformHotkey {
        let keys: [String]
        if let array = value as? [String] {
            keys = array.map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
        } else if let string = value as? String {
            keys = string.split { $0 == "+" || $0 == "," || $0.isWhitespace }.map { $0.lowercased() }
        } else {
            throw PlatformBridgeError(code: "invalid_argument", message: "hotkey requires a keys string or string array")
        }
        var modifiers = CGEventFlags()
        var keyCode: CGKeyCode?
        for key in keys {
            switch key {
            case "command", "cmd", "meta": modifiers.insert(.maskCommand)
            case "control", "ctrl": modifiers.insert(.maskControl)
            case "option", "alt": modifiers.insert(.maskAlternate)
            case "shift": modifiers.insert(.maskShift)
            default:
                guard keyCode == nil, let code = MacPlatformKeyboard.keyCode(for: key) else {
                    throw PlatformBridgeError(code: "invalid_argument", message: "Unsupported or ambiguous hotkey key: \(key)")
                }
                keyCode = code
            }
        }
        guard let keyCode else {
            throw PlatformBridgeError(code: "invalid_argument", message: "hotkey requires one non-modifier key")
        }
        return MacPlatformHotkey(keyCode: keyCode, modifiers: modifiers, keys: keys)
    }
}

enum MacPlatformKeyboard {
    private static let keyCodes: [String: Int] = [
        "a": kVK_ANSI_A, "b": kVK_ANSI_B, "c": kVK_ANSI_C, "d": kVK_ANSI_D,
        "e": kVK_ANSI_E, "f": kVK_ANSI_F, "g": kVK_ANSI_G, "h": kVK_ANSI_H,
        "i": kVK_ANSI_I, "j": kVK_ANSI_J, "k": kVK_ANSI_K, "l": kVK_ANSI_L,
        "m": kVK_ANSI_M, "n": kVK_ANSI_N, "o": kVK_ANSI_O, "p": kVK_ANSI_P,
        "q": kVK_ANSI_Q, "r": kVK_ANSI_R, "s": kVK_ANSI_S, "t": kVK_ANSI_T,
        "u": kVK_ANSI_U, "v": kVK_ANSI_V, "w": kVK_ANSI_W, "x": kVK_ANSI_X,
        "y": kVK_ANSI_Y, "z": kVK_ANSI_Z,
        "0": kVK_ANSI_0, "1": kVK_ANSI_1, "2": kVK_ANSI_2, "3": kVK_ANSI_3,
        "4": kVK_ANSI_4, "5": kVK_ANSI_5, "6": kVK_ANSI_6, "7": kVK_ANSI_7,
        "8": kVK_ANSI_8, "9": kVK_ANSI_9,
        "return": kVK_Return, "enter": kVK_Return, "tab": kVK_Tab,
        "escape": kVK_Escape, "esc": kVK_Escape, "space": kVK_Space,
        "delete": kVK_Delete, "backspace": kVK_Delete,
        "left": kVK_LeftArrow, "right": kVK_RightArrow,
        "up": kVK_UpArrow, "down": kVK_DownArrow,
        "home": kVK_Home, "end": kVK_End, "pageup": kVK_PageUp, "pagedown": kVK_PageDown,
        "forwarddelete": kVK_ForwardDelete,
    ]

    static func keyCode(for token: String) -> CGKeyCode? {
        if let code = keyCodes[token] { return CGKeyCode(code) }
        if token.hasPrefix("keycode:"), let code = UInt16(token.dropFirst("keycode:".count)), code <= 127 {
            return code
        }
        return nil
    }

    static func keyName(for keyCode: CGKeyCode) -> String {
        keyCodes.keys.sorted().first { keyCodes[$0] == Int(keyCode) } ?? "keyCode:\(keyCode)"
    }

    static func hotkeyEvents(_ hotkey: MacPlatformHotkey) throws -> [CGEvent] {
        guard let down = CGEvent(keyboardEventSource: nil, virtualKey: hotkey.keyCode, keyDown: true),
              let up = CGEvent(keyboardEventSource: nil, virtualKey: hotkey.keyCode, keyDown: false) else {
            throw PlatformBridgeError(code: "action_failed", message: "Cannot create hotkey events")
        }
        down.flags = hotkey.modifiers
        up.flags = hotkey.modifiers
        return [down, up]
    }

    static func textEvents(_ text: String) throws -> [CGEvent] {
        let characters = Array(text.utf16)
        var events: [CGEvent] = []
        var offset = 0
        while offset < characters.count {
            // CGEvent text payloads are small; keep UTF-16 surrogate pairs together.
            var end = min(offset + 20, characters.count)
            if end < characters.count, (0xD800...0xDBFF).contains(characters[end - 1]) { end -= 1 }
            let chunk = Array(characters[offset..<end])
            guard let down = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true),
                  let up = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false) else {
                throw PlatformBridgeError(code: "action_failed", message: "Cannot create text input events")
            }
            for event in [down, up] {
                event.flags = []
                chunk.withUnsafeBufferPointer { buffer in
                    event.keyboardSetUnicodeString(stringLength: buffer.count, unicodeString: buffer.baseAddress)
                }
                events.append(event)
            }
            offset = end
        }
        return events
    }

    static func text(from event: CGEvent) -> String? {
        var length = 0
        var characters = [UniChar](repeating: 0, count: 256)
        characters.withUnsafeMutableBufferPointer { buffer in
            event.keyboardGetUnicodeString(
                maxStringLength: buffer.count, actualStringLength: &length, unicodeString: buffer.baseAddress
            )
        }
        guard length > 0, length <= characters.count else { return nil }
        return String(utf16CodeUnits: characters, count: length)
    }
}

enum MacPlatformScreenshotResponse {
    static func make(image: CGImage, target: [String: Any]?) throws -> [String: Any] {
        let original = try pngData(from: image)
        let scale = min(1, 480 / Double(max(image.width, image.height)))
        let thumbnail: CGImage
        if scale == 1 {
            thumbnail = image
        } else {
            let width = max(1, Int((Double(image.width) * scale).rounded(.down)))
            let height = max(1, Int((Double(image.height) * scale).rounded(.down)))
            guard let context = CGContext(
                data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else {
                throw PlatformBridgeError(code: "encode_failed", message: "Cannot allocate screenshot thumbnail")
            }
            context.interpolationQuality = .high
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            guard let resized = context.makeImage() else {
                throw PlatformBridgeError(code: "encode_failed", message: "Cannot resize screenshot thumbnail")
            }
            thumbnail = resized
        }
        var result: [String: Any] = [
            "imageBase64": original.base64EncodedString(),
            "thumbnailBase64": try pngData(from: thumbnail).base64EncodedString(),
            "mimeType": "image/png", "width": image.width, "height": image.height,
            "thumbnailWidth": thumbnail.width, "thumbnailHeight": thumbnail.height,
            "resolution": "best_effort",
        ]
        if let target { result["target"] = target }
        return result
    }

    private static func pngData(from image: CGImage) throws -> Data {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else {
            throw PlatformBridgeError(code: "encode_failed", message: "Cannot create PNG encoder")
        }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else {
            throw PlatformBridgeError(code: "encode_failed", message: "Cannot encode screenshot PNG")
        }
        return data as Data
    }
}

func selectFrontmostWindow(appProcessIdentifier: Int, windows: [[String: Any?]]) -> [String: Any?]? {
    windows.first { $0["ownerPid"] as? Int == appProcessIdentifier }
}

private func finiteCoordinate(_ value: Any?) -> Double? {
    guard let number = value as? NSNumber,
          CFGetTypeID(number) != CFBooleanGetTypeID(), number.doubleValue.isFinite else { return nil }
    return number.doubleValue
}

private func parseElementId(_ elementId: String) throws -> (pid: Int, path: [Int]) {
    var parts: [String: String] = [:]
    for part in elementId.split(separator: ";", omittingEmptySubsequences: false) {
        let pair = part.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false).map(String.init)
        guard pair.count == 2, ["pid", "path"].contains(pair[0]), parts[pair[0]] == nil else {
            throw PlatformBridgeError(code: "invalid_argument", message: "elementId requires unique pid/path fields, for example pid:123;path:0.1")
        }
        parts[pair[0]] = pair[1]
    }
    guard let pidString = parts["pid"], let pid = Int(pidString), pid > 0, Int32(exactly: pid) != nil else {
        throw PlatformBridgeError(code: "invalid_argument", message: "elementId must include a positive 32-bit pid, for example pid:123;path:0.1")
    }
    let pathString = parts["path"] ?? ""
    let path: [Int]
    if pathString.isEmpty {
        path = []
    } else {
        path = try pathString.split(separator: ".", omittingEmptySubsequences: false).map { item in
            guard let index = Int(item), index >= 0 else {
                throw PlatformBridgeError(code: "invalid_argument", message: "elementId path must contain non-negative integer indexes")
            }
            return index
        }
    }
    return (pid, path)
}

private func elementId(pid: Int, path: [Int]) -> String {
    "pid:\(pid);path:\(path.map(String.init).joined(separator: "."))"
}

struct MacPlatformCGWindowMetadata: Equatable {
    let windowId: Int
    let ownerPid: Int
    let title: String?
    let bounds: CGRect?
}

private func cgWindowMetadata(windowId: Int) -> MacPlatformCGWindowMetadata? {
    guard let id = CGWindowID(exactly: windowId), id > 0 else { return nil }
    let windows = CGWindowListCopyWindowInfo([.optionIncludingWindow], id) as? [[String: Any]] ?? []
    guard let info = windows.first,
          let ownerPid = intValue(info[kCGWindowOwnerPID as String]) else {
        return nil
    }
    return MacPlatformCGWindowMetadata(
        windowId: intValue(info[kCGWindowNumber as String]) ?? windowId,
        ownerPid: ownerPid,
        title: info[kCGWindowName as String] as? String,
        bounds: cgWindowBounds(info[kCGWindowBounds as String])
    )
}

func selectAccessibilityWindow<Element>(
    windowId: Int?,
    focusedWindow: Element?,
    windows: [Element],
    targetWindow: MacPlatformCGWindowMetadata? = nil,
    appProcessIdentifier: Int? = nil,
    windowNumber: (Element) -> Int?,
    windowTitle: (Element) -> String? = { _ in nil },
    windowFrame: (Element) -> CGRect? = { _ in nil }
) -> Element? {
    guard let windowId else {
        return focusedWindow
    }
    if let directMatch = windows.first(where: { windowNumber($0) == windowId }) {
        return directMatch
    }
    guard let targetWindow,
          targetWindow.windowId == windowId,
          targetWindow.ownerPid == appProcessIdentifier,
          let targetTitle = normalizedNonEmptyTitle(targetWindow.title),
          let targetBounds = targetWindow.bounds else {
        return nil
    }
    let fallbackMatches = windows.filter { window in
        guard normalizedNonEmptyTitle(windowTitle(window)) == targetTitle,
              let frame = windowFrame(window) else {
            return false
        }
        return frame.approximatelyEquals(targetBounds)
    }
    return fallbackMatches.count == 1 ? fallbackMatches[0] : nil
}

private func cgWindowBounds(_ value: Any?) -> CGRect? {
    guard let bounds = value as? [String: Any],
          let x = doubleValue(bounds["X"]),
          let y = doubleValue(bounds["Y"]),
          let width = doubleValue(bounds["Width"]),
          let height = doubleValue(bounds["Height"]) else {
        return nil
    }
    return CGRect(x: x, y: y, width: width, height: height)
}

private func normalizedNonEmptyTitle(_ title: String?) -> String? {
    guard let title else { return nil }
    let normalized = title.trimmingCharacters(in: .whitespacesAndNewlines)
    return normalized.isEmpty ? nil : normalized
}

private func intValue(_ value: Any?) -> Int? {
    guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
    return Int(exactly: number.doubleValue)
}

private func nativeIdentifier(_ value: Any?, name: String, maximum: Int) throws -> Int? {
    guard let value else { return nil }
    guard let identifier = intValue(value), (1...maximum).contains(identifier) else {
        throw PlatformBridgeError(code: "invalid_argument", message: "\(name) must be an integer between 1 and \(maximum)")
    }
    return identifier
}

private func doubleValue(_ value: Any?) -> Double? {
    if let double = value as? Double { return double }
    if let int = value as? Int { return Double(int) }
    return (value as? NSNumber)?.doubleValue
}

private func clampedInt(_ value: Any?, defaultValue: Int, minValue: Int, maxValue: Int) -> Int {
    min(max(intValue(value) ?? defaultValue, minValue), maxValue)
}

private extension CGRect {
    func approximatelyEquals(_ other: CGRect, tolerance: CGFloat = 2) -> Bool {
        abs(origin.x - other.origin.x) <= tolerance &&
            abs(origin.y - other.origin.y) <= tolerance &&
            abs(width - other.width) <= tolerance &&
            abs(height - other.height) <= tolerance
    }
}

private extension NSApplication.ActivationPolicy {
    var readableName: String {
        switch self {
        case .regular: return "regular"
        case .accessory: return "accessory"
        case .prohibited: return "prohibited"
        @unknown default: return "unknown"
        }
    }
}

private extension AXError {
    var readableName: String {
        switch self {
        case .success: return "success"
        case .failure: return "failure"
        case .illegalArgument: return "illegal_argument"
        case .invalidUIElement: return "invalid_ui_element"
        case .invalidUIElementObserver: return "invalid_ui_element_observer"
        case .cannotComplete: return "cannot_complete"
        case .attributeUnsupported: return "attribute_unsupported"
        case .actionUnsupported: return "action_unsupported"
        case .notificationUnsupported: return "notification_unsupported"
        case .notImplemented: return "not_implemented"
        case .notificationAlreadyRegistered: return "notification_already_registered"
        case .notificationNotRegistered: return "notification_not_registered"
        case .apiDisabled: return "api_disabled"
        case .noValue: return "no_value"
        case .parameterizedAttributeUnsupported: return "parameterized_attribute_unsupported"
        case .notEnoughPrecision: return "not_enough_precision"
        @unknown default: return "unknown"
        }
    }
}
