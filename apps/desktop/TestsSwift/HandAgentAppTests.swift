import AppKit
import HandAgentHostAutomation
import XCTest
@testable import HandAgentDesktop

@MainActor
final class HandAgentAppTests: XCTestCase {
    func testTerminationWaitsForInFlightRunToBeCancelledAndSaved() async throws {
        let fixture = try AutomationUseCaseFixture()
        defer { fixture.cleanup() }
        fixture.settings.update { $0.automationEnabled = true }
        _ = try await fixture.call("policy_create", [
            "policyId": "terminate-policy",
            "branch": ["id": "main", "steps": [
                ["kind": "activateApp", "bundleId": "test.editor"],
                ["kind": "typeText", "value": "in-flight action"],
                ["kind": "setValue", "value": "must not run"],
            ], "assertions": []],
        ])
        _ = try await fixture.call("record_start", ["captureUserEvents": true])
        let coordinator = AppCoordinator(services: .testing(builtinFeatures: fixture.features))
        let delegate = WispPocketApplicationDelegate()
        delegate.coordinator = coordinator
        let replied = expectation(description: "AppKit may exit after the Run was saved")
        var replyCount = 0
        delegate.replyToTermination = { _, shouldTerminate in
            replyCount += 1
            XCTAssertTrue(shouldTerminate)
            XCTAssertEqual(try? fixture.store.listRuns().first?.status, "cancelled")
            replied.fulfill()
        }
        let entered = expectation(description: "system action started")
        fixture.host.suspendAction = true
        fixture.host.onActionStarted = { entered.fulfill() }
        let pending = Task { @MainActor in
            let response = try await fixture.call("run", ["policyId": "terminate-policy"], expectSuccess: false)
            return (response.value["run"] as? [String: Any])?["status"] as? String
        }
        await fulfillment(of: [entered], timeout: 2)
        let running = try XCTUnwrap(fixture.store.listRuns().first)
        XCTAssertEqual(running.status, "running")
        XCTAssertEqual(running.steps.count, 1)

        let listenerStopped = expectation(description: "shutdown stopped the event listener")
        fixture.liveRecorder.onStop = { listenerStopped.fulfill() }
        let reply = delegate.applicationShouldTerminate(NSApplication.shared)
        XCTAssertEqual(reply, .terminateLater, "AppKit must not exit while the Run still needs cancellation persistence")
        XCTAssertEqual(delegate.applicationShouldTerminate(NSApplication.shared), .terminateLater)
        await fulfillment(of: [listenerStopped], timeout: 2)
        XCTAssertEqual(replyCount, 0)
        XCTAssertEqual(try fixture.store.listRuns().first?.status, "running")
        fixture.host.releaseAction()
        let status = try await pending.value
        await fulfillment(of: [replied], timeout: 2)

        XCTAssertEqual(status, "cancelled")
        XCTAssertEqual(replyCount, 1)
        XCTAssertEqual(delegate.applicationShouldTerminate(NSApplication.shared), .terminateNow)
        let restored = AutomationStore(directoryURL: fixture.home.appendingPathComponent(".spotAgent/automation"))
        let cancelled = try XCTUnwrap(restored.listRuns().first)
        XCTAssertEqual(cancelled.id, running.id)
        XCTAssertEqual(cancelled.status, "cancelled")
        XCTAssertEqual(cancelled.steps.count, 1)
        XCTAssertEqual(cancelled.failureStage, "steps")
        XCTAssertEqual(cancelled.failedStepIndex, 1)
        XCTAssertEqual(cancelled.failureReason, "automation run cancelled")
        XCTAssertTrue(try restored.listRepairRequests().isEmpty)
        XCTAssertEqual(fixture.host.value, "")
        XCTAssertTrue(fixture.liveRecorder.recordingIds.isEmpty)
    }

    func testApplicationTerminationShutsDownCoordinatorOnce() async {
        let appServer = RecordingLifecycleAppServer()
        let coordinator = AppCoordinator(
            services: AppServices(
                appServer: appServer,
                threadWindowCommandClient: NopThreadWindowCommandClient(),
                hotkeyRegistrar: NopHotkeyRegistrar(),
                settingsWindowPresenter: NopSettingsWindowPresenter(),
                fatalAlertPresenter: NopFatalAlertPresenter(),
                setActivationPolicy: { _ in },
                showsFatalAlert: false
            )
        )
        let delegate = WispPocketApplicationDelegate()
        delegate.coordinator = coordinator
        let replied = expectation(description: "AppKit termination reply")
        var replyCount = 0
        delegate.replyToTermination = { _, shouldTerminate in
            replyCount += 1
            XCTAssertTrue(shouldTerminate)
            XCTAssertEqual(appServer.stopCount, 1)
            replied.fulfill()
        }

        let reply = delegate.applicationShouldTerminate(NSApplication.shared)
        XCTAssertEqual(reply, .terminateLater)
        XCTAssertEqual(delegate.applicationShouldTerminate(NSApplication.shared), .terminateLater)
        await fulfillment(of: [replied], timeout: 2)

        XCTAssertEqual(delegate.applicationShouldTerminate(NSApplication.shared), .terminateNow)
        XCTAssertEqual(replyCount, 1)
        XCTAssertEqual(appServer.stopCount, 1)
    }
}

@MainActor
private final class RecordingLifecycleAppServer: AppServerManaging {
    var isAvailable = true
    var startupErrorMessage: String?
    var onAvailabilityChange: ((Bool) -> Void)?
    var onFatalError: ((String) -> Void)?
    var onHostTerminationRequest: (() -> Void)?
    private(set) var stopCount = 0

    func start() {}

    func stop() {
        stopCount += 1
    }
}
