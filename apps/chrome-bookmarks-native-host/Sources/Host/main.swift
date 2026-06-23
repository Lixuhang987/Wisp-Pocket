import ChromeBookmarksNativeHostCore
import Foundation

let input = FileHandle.standardInput
let output = FileHandle.standardOutput
let forwarder = ChromeBookmarksBridgeForwarder()
let statusStore = ChromeBookmarksExtensionConnectionStatusStore()
var lastHelloMessage: ChromeBookmarksNativeMessage?

while true {
    let lengthData = input.readData(ofLength: 4)
    if lengthData.isEmpty {
        if let lastHelloMessage {
            try? statusStore.writeDisconnected(from: lastHelloMessage)
        }
        break
    }
    if lengthData.count < 4 {
        if let lastHelloMessage {
            try? statusStore.writeDisconnected(from: lastHelloMessage, error: "Invalid native messaging frame.")
        }
        try? output.write(contentsOf: NativeMessagingCodec.encodeMessageFrame(NativeHostResponse(ok: false, error: "Invalid native messaging frame.")))
        break
    }

    let length = Int(lengthData[0])
        | (Int(lengthData[1]) << 8)
        | (Int(lengthData[2]) << 16)
        | (Int(lengthData[3]) << 24)
    let payload = input.readData(ofLength: length)
    var frame = Data()
    frame.append(lengthData)
    frame.append(payload)

    do {
        let message = try NativeMessagingCodec.decodeMessageFrame(frame)
        if message.type == "handagent.bookmarks.hello" {
            lastHelloMessage = message
        }
        let endpoint = try ChromeBookmarksBridgeEndpointLoader.load()
        try await forwarder.forward(message, endpoint: endpoint)
        if message.type == "handagent.bookmarks.hello" {
            try? statusStore.writeConnected(from: message)
        }
        try output.write(contentsOf: NativeMessagingCodec.encodeMessageFrame(NativeHostResponse(ok: true)))
    } catch {
        if let lastHelloMessage {
            try? statusStore.writeDisconnected(from: lastHelloMessage, error: error.localizedDescription)
        }
        try? output.write(contentsOf: NativeMessagingCodec.encodeMessageFrame(
            NativeHostResponse(ok: false, error: error.localizedDescription)
        ))
    }
}
