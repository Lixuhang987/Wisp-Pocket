import Foundation

struct WorkspaceEntry: Codable, Identifiable, Equatable {
    let id: String
    let rootPath: String
    let name: String
    let createdAt: String
}

@MainActor
protocol WorkspaceManaging: AnyObject {
    func workspaceCommand(_ type: String, payload: [String: Any]?) async throws -> [String: Any]
}

extension WorkspaceManaging {
    func listWorkspaces() async throws -> [WorkspaceEntry] {
        let payload = try await workspaceCommand("workspace.list", payload: nil)
        let data = try JSONSerialization.data(withJSONObject: payload["workspaces"] ?? [])
        return try JSONDecoder().decode([WorkspaceEntry].self, from: data)
    }
}
