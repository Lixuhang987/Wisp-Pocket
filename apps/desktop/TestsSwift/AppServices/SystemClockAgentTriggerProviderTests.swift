import XCTest
@testable import HandAgentDesktop

final class SystemClockAgentTriggerProviderTests: XCTestCase {
    @MainActor
    func testSchedulesNextOccurrenceAndEmitsAtConfiguredTime() throws {
        let clock = FakeAgentTriggerClock(
            now: ISO8601DateFormatter().date(from: "2026-06-18T08:59:00Z")!
        )
        let provider = SystemClockAgentTriggerProvider(
            clock: clock,
            calendar: Calendar(identifier: .gregorian)
        )
        let instance = AgentTriggerInstance(
            id: "daily-study",
            packageId: "system-clock",
            title: "Daily Study",
            enabled: true,
            config: [
                "scheduleAt": .stringList(["09:00"]),
                "timezone": .string("UTC")
            ],
            promptTemplate: "Run scheduled task",
            deliveryPolicy: .default,
            notificationPolicy: .default,
                targetPetId: "pet-test"
        )
        var emittedEvents: [AgentTriggerEvent] = []

        try provider.start(instances: [instance]) { emittedEvents.append($0) }

        XCTAssertEqual(clock.scheduledDates.count, 1)
        XCTAssertEqual(ISO8601DateFormatter().string(from: clock.scheduledDates[0]), "2026-06-18T09:00:00Z")
        XCTAssertEqual(emittedEvents, [])

        clock.fireFirst()

        XCTAssertEqual(emittedEvents.map(\.triggerInstanceId), ["daily-study"])
        XCTAssertEqual(emittedEvents.first?.providerKind, "system.clock")
    }

    @MainActor
    func testSchedulesTomorrowWhenSameDayTimeHasPassed() throws {
        let clock = FakeAgentTriggerClock(
            now: ISO8601DateFormatter().date(from: "2026-06-18T09:01:00Z")!
        )
        let provider = SystemClockAgentTriggerProvider(
            clock: clock,
            calendar: Calendar(identifier: .gregorian)
        )
        let instance = AgentTriggerInstance(
            id: "daily-study",
            packageId: "system-clock",
            title: "Daily Study",
            enabled: true,
            config: [
                "scheduleAt": .stringList(["09:00"]),
                "timezone": .string("UTC")
            ],
            promptTemplate: "Run scheduled task",
            deliveryPolicy: .default,
            notificationPolicy: .default,
                targetPetId: "pet-test"
        )

        try provider.start(instances: [instance]) { _ in }

        XCTAssertEqual(
            ISO8601DateFormatter().string(from: clock.scheduledDates[0]),
            "2026-06-19T09:00:00Z"
        )
    }
}

private final class FakeAgentTriggerClock: AgentTriggerClock {
    var now: Date
    private(set) var scheduledDates: [Date] = []
    private var callbacks: [() -> Void] = []

    init(now: Date) {
        self.now = now
    }

    func schedule(at date: Date, _ callback: @escaping () -> Void) -> any AgentTriggerScheduledTask {
        scheduledDates.append(date)
        callbacks.append {
            callback()
        }
        return FakeAgentTriggerScheduledTask()
    }

    func fireFirst() {
        let callback = callbacks.removeFirst()
        callback()
    }
}

private struct FakeAgentTriggerScheduledTask: AgentTriggerScheduledTask {
    func cancel() {}
}
