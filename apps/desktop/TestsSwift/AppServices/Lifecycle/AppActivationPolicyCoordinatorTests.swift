import AppKit
import XCTest
@testable import HandAgentDesktop

final class AppActivationPolicyCoordinatorTests: XCTestCase {
    @MainActor
    func testUsesAccessoryPolicyWithoutSettingsWindow() {
        let coordinator = AppActivationPolicyCoordinator()

        XCTAssertEqual(coordinator.currentPolicy(), .accessory)
    }

    @MainActor
    func testUsesRegularPolicyWhenSettingsWindowIsOpen() {
        let coordinator = AppActivationPolicyCoordinator()

        XCTAssertEqual(
            coordinator.policyAfterUpdatingSettingsWindow(isOpen: true),
            .regular
        )
    }

    @MainActor
    func testReturnsToAccessoryPolicyWhenSettingsWindowClosesWithoutThreads() {
        let coordinator = AppActivationPolicyCoordinator()

        _ = coordinator.policyAfterUpdatingSettingsWindow(isOpen: true)

        XCTAssertEqual(
            coordinator.policyAfterUpdatingSettingsWindow(isOpen: false),
            .accessory
        )
    }
}
