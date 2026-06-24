import Foundation

@MainActor
protocol AgentTriggerRuntimeReloading: AnyObject {
    func reload() throws
    func stop() throws
}

@MainActor
protocol AgentTriggerSubmitting: AnyObject {
    func submit(_ prompt: PromptSubmission)
}

typealias AgentTriggerRuntimeService = AgentTriggerRuntimeReloading & AgentTriggerSubmitting

@MainActor
final class AgentTriggerRuntime: AgentTriggerRuntimeReloading, AgentTriggerSubmitting {
    private let registry: AgentTriggerRegistry
    private let store: AgentTriggerStore
    private let submitPrompt: (PromptSubmission) -> Void

    @ObservationIgnored private var activeProviders: [String: any AgentTriggerProvider] = [:]

    init(
        registry: AgentTriggerRegistry,
        store: AgentTriggerStore,
        submit: @escaping (PromptSubmission) -> Void = { _ in }
    ) {
        self.registry = registry
        self.store = store
        self.submitPrompt = submit
    }

    func submit(_ prompt: PromptSubmission) {
        submitPrompt(prompt)
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

        try stop()

        for descriptor in registry.descriptors() {
            guard installedProviderKinds.contains(descriptor.kind) else { continue }
            guard let factory = registry.factory(for: descriptor.kind) else { continue }
            let instances = instancesByProvider[descriptor.kind] ?? []
            let instancesById = Dictionary(uniqueKeysWithValues: instances.map { ($0.id, $0) })
            let provider = factory.createHostProvider()
            try provider.start(instances: instances) { [weak self, submitPrompt] event in
                DispatchQueue.main.async {
                    guard let self,
                          let instance = instancesById[event.triggerInstanceId] else { return }
                    submitPrompt(self.makePromptSubmission(from: event, instance: instance))
                }
            }
            activeProviders[descriptor.kind] = provider
        }
    }

    func stop() throws {
        for provider in activeProviders.values {
            try provider.stop()
        }
        activeProviders.removeAll()
    }

    private func makePromptSubmission(
        from event: AgentTriggerEvent,
        instance: AgentTriggerInstance
    ) -> PromptSubmission {
        let renderedPrompt = renderPromptTemplate(instance.promptTemplate, event: event, instance: instance)
        return PromptSubmission(
            userInput: PromptUserInput(items: [
                .text(id: UUID().uuidString, text: renderedPrompt)
            ]),
            summary: instance.title.isEmpty ? event.summary : instance.title
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
