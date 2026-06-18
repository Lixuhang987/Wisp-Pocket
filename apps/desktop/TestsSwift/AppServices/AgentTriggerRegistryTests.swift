import XCTest
@testable import HandAgentDesktop

final class AgentTriggerRegistryTests: XCTestCase {
    @MainActor
    func testRegistryReturnsDescriptorsInStableOrder() {
        let registry = AgentTriggerRegistry(factories: [
            FakeAgentTriggerProviderFactory(kind: "system.clock"),
            FakeAgentTriggerProviderFactory(kind: "chrome.bookmarks"),
        ])

        XCTAssertEqual(
            registry.descriptors(),
            [
                AgentTriggerProviderDescriptor(kind: "chrome.bookmarks", displayName: "chrome.bookmarks"),
                AgentTriggerProviderDescriptor(kind: "system.clock", displayName: "system.clock"),
            ]
        )
    }

    @MainActor
    func testRegistryReturnsFactoryByKind() throws {
        let chromeFactory = FakeAgentTriggerProviderFactory(kind: "chrome.bookmarks")
        let registry = AgentTriggerRegistry(factories: [chromeFactory])

        let resolved = try XCTUnwrap(registry.factory(for: "chrome.bookmarks"))

        XCTAssertEqual(resolved.descriptor().kind, "chrome.bookmarks")
        XCTAssertNil(registry.factory(for: "system.clock"))
    }
}

private final class FakeAgentTriggerProviderFactory: AgentTriggerProviderFactory {
    private let providerKind: String

    init(kind: String) {
        self.providerKind = kind
    }

    func descriptor() -> AgentTriggerProviderDescriptor {
        AgentTriggerProviderDescriptor(kind: providerKind, displayName: providerKind)
    }

    func createHostProvider() -> any AgentTriggerProvider {
        FakeAgentTriggerProvider(kind: providerKind)
    }
}

private final class FakeAgentTriggerProvider: AgentTriggerProvider {
    let kind: String

    init(kind: String) {
        self.kind = kind
    }

    func start(
        instances: [AgentTriggerInstance],
        emit: @escaping (AgentTriggerEvent) -> Void
    ) throws {
        _ = instances
        _ = emit
    }
    func stop() throws {}
}
