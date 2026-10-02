import Foundation

enum ActivityWindowCommandKind: Equatable {
    case show
    case petVisibility(petId: String, visible: Bool)
}

struct ActivityWindowCommandResult: Equatable {
    let commandId: String
    let kind: ActivityWindowCommandKind
    let ok: Bool
    let error: String?
}

@MainActor
protocol ActivityWindowCommanding: AnyObject {
    var onActivityWindowCommandResult: ((ActivityWindowCommandResult) -> Void)? { get set }

    @discardableResult
    func showActivityWindow() throws -> String
    func setPetVisible(petId: String, visible: Bool) throws -> String
}

extension ActivityWindowCommanding {
    func setPetVisible(petId: String, visible: Bool) throws -> String {
        throw SwiftThreadClientError.startFailed("桌宠窗口控制不可用")
    }
}
