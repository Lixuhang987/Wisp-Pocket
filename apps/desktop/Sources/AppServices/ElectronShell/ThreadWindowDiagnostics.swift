import Foundation

enum ThreadWindowDiagnostics {
    static var isEnabled: Bool {
        ProcessInfo.processInfo.environment["HANDAGENT_THREADWINDOW_TRACE"] == "1"
    }

    static func emit(_ message: @autoclosure () -> String) {
        guard isEnabled else { return }
        fputs("[handagent-threadwindow] \(message())\n", stderr)
    }
}
