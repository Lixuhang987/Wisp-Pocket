import Foundation

struct AgentTriggerPackageManifest: Codable, Equatable, Identifiable {
    let version: Int
    let id: String
    let title: String
    let description: String?
    let providerKind: String
    let configSchema: AgentTriggerConfigSchema
    let defaultPromptTemplate: String
    let defaultDeliveryPolicy: AgentTriggerDeliveryPolicy
    let defaultNotificationPolicy: AgentTriggerNotificationPolicy

    static func decode(_ data: Data) throws -> AgentTriggerPackageManifest {
        try JSONDecoder().decode(AgentTriggerPackageManifest.self, from: data)
    }
}

struct AgentTriggerConfigSchema: Codable, Equatable {
    let fields: [AgentTriggerConfigField]
}

struct AgentTriggerConfigField: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let kind: AgentTriggerConfigFieldKind
    let required: Bool
}

enum AgentTriggerConfigFieldKind: String, Codable, Equatable {
    case string
    case stringList = "string_list"
    case time
    case timeList = "time_list"
    case timezone
}

struct AgentTriggerDeliveryPolicy: Codable, Equatable {
    let persistThread: Bool
    let openThreadWindowOnStart: Bool

    static let `default` = AgentTriggerDeliveryPolicy(
        persistThread: true,
        openThreadWindowOnStart: false
    )
}

struct AgentTriggerNotificationPolicy: Codable, Equatable {
    let mode: AgentTriggerNotificationMode

    static let `default` = AgentTriggerNotificationPolicy(mode: .onAttention)
}

enum AgentTriggerNotificationMode: String, Codable, Equatable {
    case silent
    case onFailure = "on_failure"
    case onAttention = "on_attention"
}

struct AgentTriggerInstance: Codable, Equatable, Identifiable {
    let id: String
    let packageId: String
    let title: String
    let enabled: Bool
    let config: [String: AgentTriggerConfigValue]
    let promptTemplate: String
    let deliveryPolicy: AgentTriggerDeliveryPolicy
    let notificationPolicy: AgentTriggerNotificationPolicy
}

enum AgentTriggerConfigValue: Codable, Equatable {
    case string(String)
    case stringList([String])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(String.self) {
            self = .string(value)
            return
        }
        if let values = try? container.decode([String].self) {
            self = .stringList(values)
            return
        }
        throw DecodingError.typeMismatch(
            AgentTriggerConfigValue.self,
            DecodingError.Context(
                codingPath: decoder.codingPath,
                debugDescription: "Unsupported AgentTriggerConfigValue"
            )
        )
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .stringList(let values):
            try container.encode(values)
        }
    }
}

struct AgentTriggerProviderDescriptor: Equatable {
    let kind: String
    let displayName: String
}

struct AgentTriggerEvent: Equatable {
    let triggerInstanceId: String
    let providerKind: String
    let occurredAt: String
    let summary: String
    let payload: [String: AgentTriggerConfigValue]
}

protocol AgentTriggerProvider: AnyObject {
    var kind: String { get }
    func start(
        instances: [AgentTriggerInstance],
        emit: @escaping (AgentTriggerEvent) -> Void
    ) throws
    func stop() throws
}

protocol AgentTriggerProviderFactory {
    func descriptor() -> AgentTriggerProviderDescriptor
    func createHostProvider() -> any AgentTriggerProvider
}
