import ApplicationServices
import AppKit
import Carbon.HIToolbox
import Foundation
import HandAgentPluginSupport

runLineDelimitedPluginServer { namespace, tool, arguments in
    guard namespace == "ax" else {
        return .text("unsupported namespace: \(namespace)", success: false)
    }
    guard AXIsProcessTrusted() else {
        return .text("Accessibility permission is not granted.", success: false)
    }
    switch tool {
    case "snapshot":
        return .json(["root": frontmostSnapshot()])
    case "action":
        do {
            try performAction(arguments: arguments)
            return .json(["ok": true])
        } catch {
            return .text(error.localizedDescription, success: false)
        }
    default:
        return .text("unsupported ax tool: \(tool)", success: false)
    }
}

private func performAction(arguments: Any?) throws {
    let object = arguments as? [String: Any] ?? [:]
    let action = object["action"] as? String ?? "press"
    switch action {
    case "press", "click":
        let element = try targetElement(selector: object["selector"] as? [String: Any])
        let result = AXUIElementPerformAction(element, kAXPressAction as CFString)
        guard result == .success else {
            throw NSError(
                domain: "HandAgentAtomicAXPlugin",
                code: Int(result.rawValue),
                userInfo: [NSLocalizedDescriptionKey: "AX press failed: \(result.rawValue)"]
            )
        }
    case "set_value":
        let element = try targetElement(selector: object["selector"] as? [String: Any])
        let value = (object["value"] as? String ?? "") as CFTypeRef
        let result = AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, value)
        guard result == .success else {
            throw NSError(
                domain: "HandAgentAtomicAXPlugin",
                code: Int(result.rawValue),
                userInfo: [NSLocalizedDescriptionKey: "AX set value failed: \(result.rawValue)"]
            )
        }
    case "type_text":
        let element = try targetElement(selector: object["selector"] as? [String: Any])
        let text = object["text"] as? String ?? ""
        let result = AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, text as CFTypeRef)
        guard result == .success else {
            throw NSError(
                domain: "HandAgentAtomicAXPlugin",
                code: Int(result.rawValue),
                userInfo: [NSLocalizedDescriptionKey: "AX type text failed: \(result.rawValue)"]
            )
        }
    case "hotkey":
        try sendHotkey(keys: object["keys"])
    default:
        throw NSError(
            domain: "HandAgentAtomicAXPlugin",
            code: 2,
            userInfo: [NSLocalizedDescriptionKey: "Unsupported AX action: \(action)"]
        )
    }
}

private func targetElement(selector: [String: Any]?) throws -> AXUIElement {
    guard let selector, !selector.isEmpty else {
        return try focusedElement()
    }
    guard let pid = NSWorkspace.shared.frontmostApplication?.processIdentifier else {
        throw NSError(
            domain: "HandAgentAtomicAXPlugin",
            code: 3,
            userInfo: [NSLocalizedDescriptionKey: "No frontmost app for AX selector"]
        )
    }
    let app = AXUIElementCreateApplication(pid)
    if let element = findElement(matching: selector, in: app, depth: 0, maxDepth: 8, maxChildren: 80) {
        return element
    }
    throw NSError(
        domain: "HandAgentAtomicAXPlugin",
        code: 4,
        userInfo: [NSLocalizedDescriptionKey: "No AX element matched selector"]
    )
}

private func focusedElement() throws -> AXUIElement {
    let systemWide = AXUIElementCreateSystemWide()
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(systemWide, kAXFocusedUIElementAttribute as CFString, &value) == .success,
          let element = value else {
        throw NSError(
            domain: "HandAgentAtomicAXPlugin",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "No focused AX element"]
        )
    }
    return element as! AXUIElement
}

private func findElement(
    matching selector: [String: Any],
    in element: AXUIElement,
    depth: Int,
    maxDepth: Int,
    maxChildren: Int
) -> AXUIElement? {
    if matches(selector: selector, element: element) {
        return element
    }
    guard depth < maxDepth else { return nil }
    var rawChildren: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &rawChildren) == .success,
          let children = rawChildren as? [AXUIElement] else {
        return nil
    }
    for child in children.prefix(maxChildren) {
        if let match = findElement(
            matching: selector,
            in: child,
            depth: depth + 1,
            maxDepth: maxDepth,
            maxChildren: maxChildren
        ) {
            return match
        }
    }
    return nil
}

private func matches(selector: [String: Any], element: AXUIElement) -> Bool {
    if let role = selector["role"] as? String,
       copyString(element, kAXRoleAttribute) != role {
        return false
    }
    if let title = selector["title"] as? String,
       copyString(element, kAXTitleAttribute) != title {
        return false
    }
    return selector["role"] != nil || selector["title"] != nil
}

private func sendHotkey(keys: Any?) throws {
    let tokens = keyTokens(keys)
    let modifiers = tokens.reduce(CGEventFlags()) { result, token in
        switch token {
        case "command", "cmd", "meta":
            return result.union(.maskCommand)
        case "shift":
            return result.union(.maskShift)
        case "option", "alt":
            return result.union(.maskAlternate)
        case "control", "ctrl":
            return result.union(.maskControl)
        default:
            return result
        }
    }
    guard let key = tokens.last(where: { keyCode($0) != nil }),
          let code = keyCode(key) else {
        throw NSError(
            domain: "HandAgentAtomicAXPlugin",
            code: 5,
            userInfo: [NSLocalizedDescriptionKey: "Unsupported hotkey"]
        )
    }
    postKey(code, flags: modifiers, keyDown: true)
    postKey(code, flags: modifiers, keyDown: false)
}

private func keyTokens(_ value: Any?) -> [String] {
    if let array = value as? [String] {
        return array.map { $0.lowercased() }
    }
    if let string = value as? String {
        return string
            .split { $0 == "+" || $0 == "," || $0 == " " }
            .map { $0.lowercased() }
    }
    return []
}

private func postKey(_ keyCode: CGKeyCode, flags: CGEventFlags, keyDown: Bool) {
    let event = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: keyDown)
    event?.flags = flags
    event?.post(tap: .cghidEventTap)
}

private func keyCode(_ key: String) -> CGKeyCode? {
    let letterCodes: [String: Int] = [
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
    ]
    return letterCodes[key].map(CGKeyCode.init)
}

private func frontmostSnapshot() -> [String: Any] {
    guard let pid = NSWorkspace.shared.frontmostApplication?.processIdentifier else {
        return [:]
    }
    let app = AXUIElementCreateApplication(pid)
    return snapshot(element: app, depth: 0, maxDepth: 3, maxChildren: 20)
}

private func snapshot(element: AXUIElement, depth: Int, maxDepth: Int, maxChildren: Int) -> [String: Any] {
    var result: [String: Any] = [
        "role": copyString(element, kAXRoleAttribute) ?? "unknown",
    ]
    if let title = copyString(element, kAXTitleAttribute), !title.isEmpty {
        result["title"] = title
    }
    if let value = copyString(element, kAXValueAttribute), !value.isEmpty {
        result["value"] = value
    }
    guard depth < maxDepth else { return result }
    var rawChildren: CFTypeRef?
    if AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &rawChildren) == .success,
       let children = rawChildren as? [AXUIElement],
       !children.isEmpty {
        result["children"] = children.prefix(maxChildren).map {
            snapshot(element: $0, depth: depth + 1, maxDepth: maxDepth, maxChildren: maxChildren)
        }
    }
    return result
}

private func copyString(_ element: AXUIElement, _ attribute: String) -> String? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success else {
        return nil
    }
    return value as? String
}
