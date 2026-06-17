import AppKit
import KeyboardShortcuts

enum AppScopedShortcutMatcher {
    static func configuredShortcut(for name: KeyboardShortcuts.Name) -> KeyboardShortcuts.Shortcut? {
        KeyboardShortcuts.getShortcut(for: name) ?? name.defaultShortcut
    }

    static func matches(_ event: NSEvent, name: KeyboardShortcuts.Name) -> Bool {
        guard
            let shortcut = configuredShortcut(for: name),
            let pressed = KeyboardShortcuts.Shortcut(event: event)
        else {
            return false
        }
        return pressed == shortcut
    }
}
