import Foundation

struct AgentTriggerRegistry {
    private let factoriesByKind: [String: any AgentTriggerProviderFactory]

    init(factories: [any AgentTriggerProviderFactory]) {
        var byKind: [String: any AgentTriggerProviderFactory] = [:]
        for factory in factories {
            byKind[factory.descriptor().kind] = factory
        }
        self.factoriesByKind = byKind
    }

    func factory(for providerKind: String) -> (any AgentTriggerProviderFactory)? {
        factoriesByKind[providerKind]
    }

    func descriptors() -> [AgentTriggerProviderDescriptor] {
        factoriesByKind.values
            .map { $0.descriptor() }
            .sorted { $0.kind < $1.kind }
    }
}
