import Foundation

@MainActor
protocol AppServerManaging: AnyObject {
    var isAvailable: Bool { get }
    var startupErrorMessage: String? { get }
    var onAvailabilityChange: ((Bool) -> Void)? { get set }
    var onFatalError: ((String) -> Void)? { get set }
    var onHostTerminationRequest: (() -> Void)? { get set }

    func start()
    func stop()
}

@MainActor
final class DynamicToolProviderConnectionClient {
    private let connection: AppServerConnection
    private let providerService: DynamicToolProviderService

    init(
        connection: AppServerConnection,
        providerService: DynamicToolProviderService
    ) {
        self.connection = connection
        self.providerService = providerService
        connection.onStateChange = { [weak self] state in
            Task { @MainActor in
                guard state == .connected, let self else { return }
                self.sendHello()
            }
        }
        connection.onTextMessage = { [weak self] text in
            Task { @MainActor in
                await self?.providerService.handleIncoming(raw: text) { [weak self] response in
                    self?.connection.send(text: response)
                }
            }
        }
    }

    func connect() {
        connection.connect()
    }

    func disconnect() {
        connection.disconnect()
    }

    private func sendHello() {
        connection.send(text: providerService.makeHelloMessage())
    }
}
