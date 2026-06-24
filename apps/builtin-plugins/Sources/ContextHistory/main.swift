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

Task.detached {
    var tick = 0
    while !Task.isCancelled {
        let sample = try? await collector.collectActivitySample()
        tick += 1
        if tick % 2 == 0 {
            _ = try? await collector.collectScreenshot(sampleId: sample?.id)
        }
        try? await Task.sleep(for: .seconds(30))
    }
}

runLineDelimitedPluginServer { namespace, tool, arguments in
    router.handle(namespace: namespace, tool: tool, arguments: arguments)
}
