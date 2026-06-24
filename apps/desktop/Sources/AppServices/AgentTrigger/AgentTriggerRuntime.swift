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
        let installedProviderKinds = Set(packagesById.values.map(\.providerKind))
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
            guard installedProviderKinds.contains(descriptor.kind) else { continue }
            guard let factory = registry.factory(for: descriptor.kind) else { continue }
            let instances = instancesByProvider[descriptor.kind] ?? []
            let instancesById = Dictionary(uniqueKeysWithValues: instances.map { ($0.id, $0) })
            let provider = factory.createHostProvider()
            try provider.start(instances: instances) { [weak self, emit] event in
                DispatchQueue.main.async {
                    guard let self,
                          let instance = instancesById[event.triggerInstanceId] else { return }
                    emit(self.makeFirePayload(from: event, instance: instance))
                }
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
        var rendered = template
            .replacingOccurrences(of: "{{summary}}", with: event.summary)
            .replacingOccurrences(of: "{{providerKind}}", with: event.providerKind)
            .replacingOccurrences(of: "{{triggerInstanceId}}", with: instance.id)
        for (key, value) in event.payload {
            rendered = rendered.replacingOccurrences(of: "{{\(key)}}", with: renderAgentTriggerValue(value))
        }
        return rendered
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
