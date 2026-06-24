import Foundation
import HandAgentPluginSupport

let directory = ProcessInfo.processInfo.environment["HANDAGENT_CONTEXT_HISTORY_DIR"]
    .map { URL(fileURLWithPath: $0, isDirectory: true) }
    ?? FileManager.default
    .homeDirectoryForCurrentUser
    .appendingPathComponent(".spotAgent/context-history", isDirectory: true)

let router = ContextHistoryToolRouter(store: ContextHistoryStore(directoryURL: directory))
let collector = ContextHistoryCollector(
    store: ContextHistoryStore(directoryURL: directory),
    capabilityClient: LocalManifestPluginPeerClient()
)
let scheduler = ContextHistorySamplingScheduler(collector: collector)

Task.detached {
    while !Task.isCancelled {
        _ = try? await scheduler.tick()
        try? await Task.sleep(for: .seconds(5))
    }
}

runLineDelimitedPluginServer { namespace, tool, arguments in
    router.handle(namespace: namespace, tool: tool, arguments: arguments)
}
