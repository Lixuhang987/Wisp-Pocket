import Foundation

struct PetImageReference: Codable, Equatable {
    let type: String
    var id: String?
    var blobId: String?
    var mimeType: String?
    var width: Int?
    var height: Int?

    static let builtin = PetImageReference(type: "builtin", id: "yachiyo")
}

struct PetEntry: Codable, Identifiable, Equatable {
    let id: String
    var name: String
    var description: String
    var rolePrompt: String
    var revision: Int
    var imageRef: PetImageReference
    let workspaceId: String
    let rootPath: String
    var isDefault: Bool
}

@MainActor
protocol PetManaging: AnyObject {
    func petCommand(_ type: String, payload: [String: Any]?) async throws -> [String: Any]
}

extension PetManaging {
    func listPets() async throws -> [PetEntry] {
        let payload = try await petCommand("pet.list", payload: nil)
        let data = try JSONSerialization.data(withJSONObject: payload["pets"] ?? [])
        return try JSONDecoder().decode([PetEntry].self, from: data)
    }
}

struct WorkspaceEntry: Codable, Identifiable, Equatable {
    let id: String
    let rootPath: String
    let name: String
    let createdAt: String
}
