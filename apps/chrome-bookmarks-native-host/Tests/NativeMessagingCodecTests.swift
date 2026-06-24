import Foundation
import XCTest
@testable import ChromeBookmarksNativeHostCore

final class NativeMessagingCodecTests: XCTestCase {
    func testDecodesLittleEndianLengthPrefixedMessage() throws {
        let payload = """
        {
          "type": "handagent.bookmarks.created",
          "protocolVersion": 1,
          "eventId": "event-1",
          "bookmarkId": "bookmark-1",
          "parentId": "folder-a",
          "title": "OpenAI",
          "url": "https://openai.com",
          "profileId": "Default",
          "occurredAt": "2026-06-23T00:00:00.000Z"
        }
        """.data(using: .utf8)!
        let frame = try makeFrame(payload)

        let message = try NativeMessagingCodec.decodeMessageFrame(frame)

        XCTAssertEqual(message.type, "handagent.bookmarks.created")
        XCTAssertEqual(message.protocolVersion, 1)
        XCTAssertEqual(message.url, "https://openai.com")
        XCTAssertEqual(message.parentId, "folder-a")
    }

    func testEncodesLittleEndianLengthPrefixedResponse() throws {
        let frame = try NativeMessagingCodec.encodeMessageFrame(NativeHostResponse(ok: true))
        let length = Int(frame[0])
            | (Int(frame[1]) << 8)
            | (Int(frame[2]) << 16)
            | (Int(frame[3]) << 24)

        XCTAssertEqual(length, frame.count - 4)
        let response = try JSONDecoder().decode(NativeHostResponse.self, from: frame.subdata(in: 4..<frame.count))
        XCTAssertEqual(response, NativeHostResponse(ok: true))
    }

    func testRejectsUnsupportedProtocolVersion() throws {
        let payload = """
        {
          "type": "handagent.bookmarks.created",
          "protocolVersion": 2
        }
        """.data(using: .utf8)!
        let frame = try makeFrame(payload)

        XCTAssertThrowsError(try NativeMessagingCodec.decodeMessageFrame(frame)) { error in
            XCTAssertEqual(error as? NativeMessagingCodecError, .unsupportedProtocolVersion(2))
        }
    }

    func testDecodesHelloMessage() throws {
        let payload = """
        {
          "type": "handagent.bookmarks.hello",
          "protocolVersion": 1,
          "extensionVersion": "1.0.0",
          "extensionInstanceId": "extension-instance",
          "profileId": "Default",
          "sentAt": "2026-06-23T00:00:00.000Z"
        }
        """.data(using: .utf8)!
        let frame = try makeFrame(payload)

        let message = try NativeMessagingCodec.decodeMessageFrame(frame)

        XCTAssertEqual(message.type, "handagent.bookmarks.hello")
        XCTAssertEqual(message.extensionVersion, "1.0.0")
        XCTAssertEqual(message.extensionInstanceId, "extension-instance")
        XCTAssertEqual(message.profileId, "Default")
        XCTAssertEqual(message.sentAt, "2026-06-23T00:00:00.000Z")
    }

    func testDecodesFolderTreeSnapshotMessage() throws {
        let payload = """
        {
          "type": "handagent.bookmarks.folderTreeSnapshot",
          "protocolVersion": 1,
          "profileId": "Default",
          "updatedAt": "2026-06-23T00:00:00.000Z",
          "folders": [
            {
              "id": "1",
              "title": "书签栏",
              "childCount": 2,
              "children": [
                {
                  "id": "6",
                  "title": "a",
                  "childCount": 1,
                  "children": []
                }
              ]
            }
          ]
        }
        """.data(using: .utf8)!
        let frame = try makeFrame(payload)

        let message = try NativeMessagingCodec.decodeMessageFrame(frame)

        XCTAssertEqual(message.type, "handagent.bookmarks.folderTreeSnapshot")
        XCTAssertEqual(message.profileId, "Default")
        XCTAssertEqual(message.folders?.first?.id, "1")
        XCTAssertEqual(message.folders?.first?.children.first?.title, "a")
    }

    func testConnectionStatusStoreWritesConnectedAndDisconnectedStatus() throws {
        let homeURL = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: homeURL) }
        let statusURL = ChromeBookmarksExtensionConnectionStatusStore.defaultStatusURL(homeDirectoryURL: homeURL)
        let store = ChromeBookmarksExtensionConnectionStatusStore(
            statusURL: statusURL,
            now: { "2026-06-23T00:01:00.000Z" }
        )
        let message = ChromeBookmarksNativeMessage(
            type: "handagent.bookmarks.hello",
            protocolVersion: 1,
            profileId: "Default",
            extensionVersion: "1.0.0",
            extensionInstanceId: "extension-instance",
            sentAt: "2026-06-23T00:00:00.000Z"
        )

        try store.writeConnected(from: message)
        let connected = try JSONDecoder().decode(
            ChromeBookmarksExtensionConnectionStatus.self,
            from: Data(contentsOf: statusURL)
        )
        XCTAssertEqual(connected.state, "connected")
        XCTAssertEqual(connected.updatedAt, "2026-06-23T00:01:00.000Z")

        try store.writeDisconnected(from: message, error: "port closed")
        let disconnected = try JSONDecoder().decode(
            ChromeBookmarksExtensionConnectionStatus.self,
            from: Data(contentsOf: statusURL)
        )
        XCTAssertEqual(disconnected.state, "disconnected")
        XCTAssertEqual(disconnected.updatedAt, "2026-06-23T00:01:00.000Z")
        XCTAssertEqual(disconnected.error, "port closed")
    }

    private func makeFrame(_ payload: Data) throws -> Data {
        var frame = Data()
        frame.append(UInt8(payload.count & 0xff))
        frame.append(UInt8((payload.count >> 8) & 0xff))
        frame.append(UInt8((payload.count >> 16) & 0xff))
        frame.append(UInt8((payload.count >> 24) & 0xff))
        frame.append(payload)
        return frame
    }

    private func makeTemporaryDirectory() throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("handagent-native-host-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
}
