import Foundation

@MainActor
protocol AgentTriggerRuntimeReloading: AnyObject {
    func reload() throws
}

@MainActor
final class AgentTriggerRuntime: AgentTriggerRuntimeReloading {
    private let registry: AgentTriggerRegistry
    private let store: AgentTriggerStore
    private let emit: (ElectronAgentTriggerFirePayload) -> Void

    @ObservationIgnored private var activeProviders: [String: any AgentTriggerProvider] = [:]

    init(
        registry: AgentTriggerRegistry,
        store: AgentTriggerStore,
        emit: @escaping (ElectronAgentTriggerFirePayload) -> Void = { _ in }
    ) {
        self.registry = registry
        self.store = store
        self.emit = emit
    }

    func reload() throws {
        let packagesById = Dictionary(uniqueKeysWithValues: store.listInstalledPackages().map { ($0.id, $0) })
        let instancesByProvider = Dictionary(
            grouping: store.loadInstances().filter(\.enabled),
            by: { instance in
                packagesById[instance.packageId]?.providerKind ?? "__missing__"
            }
        )

        for provider in activeProviders.values {
            try provider.stop()
        }
        activeProviders.removeAll()

        for descriptor in registry.descriptors() {
            guard let factory = registry.factory(for: descriptor.kind) else { continue }
            let instances = instancesByProvider[descriptor.kind] ?? []
            guard !instances.isEmpty else { continue }
            let instancesById = Dictionary(uniqueKeysWithValues: instances.map { ($0.id, $0) })
            let provider = factory.createHostProvider()
            try provider.start(instances: instances) { [emit] event in
                guard let instance = instancesById[event.triggerInstanceId] else { return }
                emit(self.makeFirePayload(from: event, instance: instance))
            }
            activeProviders[descriptor.kind] = provider
        }
    }

    private func makeFirePayload(
        from event: AgentTriggerEvent,
        instance: AgentTriggerInstance
    ) -> ElectronAgentTriggerFirePayload {
        let renderedPrompt = renderPromptTemplate(instance.promptTemplate, event: event, instance: instance)
        return ElectronAgentTriggerFirePayload(
            triggerInstanceId: instance.id,
            threadTitleHint: instance.title,
            userInput: PromptUserInput(items: [
                .text(id: UUID().uuidString, text: renderedPrompt)
            ]),
            notificationPolicy: ElectronAgentTriggerNotificationPolicy(mode: instance.notificationPolicy.mode.rawValue),
            sourceEvent: ElectronAgentTriggerSourceEvent(
                triggerInstanceId: event.triggerInstanceId,
                providerKind: event.providerKind,
                occurredAt: event.occurredAt,
                summary: event.summary,
                payload: event.payload.mapValues(renderAgentTriggerValue)
            )
        )
    }

    private func renderPromptTemplate(
        _ template: String,
        event: AgentTriggerEvent,
        instance: AgentTriggerInstance
    ) -> String {
        template
            .replacingOccurrences(of: "{{summary}}", with: event.summary)
            .replacingOccurrences(of: "{{providerKind}}", with: event.providerKind)
            .replacingOccurrences(of: "{{triggerInstanceId}}", with: instance.id)
    }

    private func renderAgentTriggerValue(_ value: AgentTriggerConfigValue) -> String {
        switch value {
        case .string(let value):
            return value
        case .stringList(let values):
            return values.joined(separator: ", ")
        }
    }
}
