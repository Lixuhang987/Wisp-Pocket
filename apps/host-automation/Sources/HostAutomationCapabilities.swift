import Foundation

/// The fixed macOS boundary used by the two built-in business modules.
@MainActor
public protocol HostAutomationCapabilities {
    func frontmostAppWindow() async throws -> [String: Any]
    func accessibilitySnapshot() async throws -> [String: Any]
    func captureScreenshot() async throws -> [String: Any]
    func activateApp(bundleId: String?) async throws
    func performAction(_ arguments: [String: Any]) async throws
}
