import AppKit
import Foundation
import HandAgentPluginSupport

runLineDelimitedPluginServer { namespace, tool, arguments in
    guard namespace == "app_window" else {
        return .text("unsupported namespace: \(namespace)", success: false)
    }
    switch tool {
    case "frontmost":
        return .json([
            "app": frontmostApp(),
            "window": frontmostWindow(),
        ])
    case "list_windows":
        return .json(["windows": visibleWindows()])
    case "activate":
        return activateApp(arguments: arguments)
    default:
        return .text("unsupported app_window tool: \(tool)", success: false)
    }
}

private func frontmostApp() -> [String: Any] {
    let app = NSWorkspace.shared.frontmostApplication
    return [
        "name": app?.localizedName as Any,
        "bundleId": app?.bundleIdentifier as Any,
        "pid": app.map { Int($0.processIdentifier) } as Any,
    ]
}

private func frontmostWindow() -> [String: Any] {
    visibleWindows().first ?? [:]
}

private func visibleWindows() -> [[String: Any]] {
    let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    let infoList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] ?? []
    return infoList.compactMap { info -> [String: Any]? in
        let layer = info[kCGWindowLayer as String] as? Int ?? 0
        if layer != 0 { return nil }
        return [
            "id": info[kCGWindowNumber as String] as? Int as Any,
            "title": info[kCGWindowName as String] as? String as Any,
            "appName": info[kCGWindowOwnerName as String] as? String as Any,
            "ownerPid": info[kCGWindowOwnerPID as String] as? Int as Any,
        ]
    }
}

private func activateApp(arguments: Any?) -> PluginToolResult {
    let object = arguments as? [String: Any] ?? [:]
    let bundleId = object["bundleId"] as? String
    let app = runningApplication(bundleId: bundleId)
    guard let app else {
        return .text("running app not found", success: false)
    }

    let activated = app.activate(options: [.activateAllWindows])
    return .json([
        "activated": activated,
        "app": [
            "name": app.localizedName as Any,
            "bundleId": app.bundleIdentifier as Any,
            "pid": Int(app.processIdentifier),
        ],
    ])
}

private func runningApplication(bundleId: String?) -> NSRunningApplication? {
    if let bundleId, !bundleId.isEmpty {
        return NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
    }
    return NSWorkspace.shared.frontmostApplication
}
