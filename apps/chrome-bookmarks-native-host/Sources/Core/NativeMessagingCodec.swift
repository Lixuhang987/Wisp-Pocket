import Foundation

public enum NativeMessagingCodecError: Error, Equatable {
    case frameTooShort
    case invalidLength(Int)
    case unsupportedProtocolVersion(Int)
    case unsupportedMessageType(String)
}

public struct ChromeBookmarksNativeMessage: Codable, Equatable {
    public let type: String
    public let protocolVersion: Int
    public let eventId: String?
    public let bookmarkId: String?
    public let parentId: String?
    public let title: String?
    public let url: String?
    public let profileId: String?
    public let occurredAt: String?
    public let extensionVersion: String?
    public let extensionInstanceId: String?
    public let sentAt: String?

    public init(
        type: String,
        protocolVersion: Int,
        eventId: String? = nil,
        bookmarkId: String? = nil,
        parentId: String? = nil,
        title: String? = nil,
        url: String? = nil,
        profileId: String? = nil,
        occurredAt: String? = nil,
        extensionVersion: String? = nil,
        extensionInstanceId: String? = nil,
        sentAt: String? = nil
    ) {
        self.type = type
        self.protocolVersion = protocolVersion
        self.eventId = eventId
        self.bookmarkId = bookmarkId
        self.parentId = parentId
        self.title = title
        self.url = url
        self.profileId = profileId
        self.occurredAt = occurredAt
        self.extensionVersion = extensionVersion
        self.extensionInstanceId = extensionInstanceId
        self.sentAt = sentAt
    }

    public func validate() throws {
        guard protocolVersion == 1 else {
            throw NativeMessagingCodecError.unsupportedProtocolVersion(protocolVersion)
        }
        switch type {
        case "handagent.bookmarks.hello", "handagent.bookmarks.created":
            return
        default:
            throw NativeMessagingCodecError.unsupportedMessageType(type)
        }
    }
}

public struct NativeHostResponse: Codable, Equatable {
    public let ok: Bool
    public let error: String?

    public init(ok: Bool, error: String? = nil) {
        self.ok = ok
        self.error = error
    }
}

public enum NativeMessagingCodec {
    public static let maxMessageLength = 1_048_576

    public static func decodeMessageFrame(_ frame: Data) throws -> ChromeBookmarksNativeMessage {
        guard frame.count >= 4 else {
            throw NativeMessagingCodecError.frameTooShort
        }
        let length = Int(frame[0])
            | (Int(frame[1]) << 8)
            | (Int(frame[2]) << 16)
            | (Int(frame[3]) << 24)
        guard length >= 0, length <= maxMessageLength else {
            throw NativeMessagingCodecError.invalidLength(length)
        }
        guard frame.count >= 4 + length else {
            throw NativeMessagingCodecError.invalidLength(length)
        }
        let payload = frame.subdata(in: 4..<(4 + length))
        let message = try JSONDecoder().decode(ChromeBookmarksNativeMessage.self, from: payload)
        try message.validate()
        return message
    }

    public static func encodeMessageFrame<T: Encodable>(_ value: T) throws -> Data {
        let payload = try JSONEncoder().encode(value)
        guard payload.count <= maxMessageLength else {
            throw NativeMessagingCodecError.invalidLength(payload.count)
        }
        var frame = Data()
        frame.append(UInt8(payload.count & 0xff))
        frame.append(UInt8((payload.count >> 8) & 0xff))
        frame.append(UInt8((payload.count >> 16) & 0xff))
        frame.append(UInt8((payload.count >> 24) & 0xff))
        frame.append(payload)
        return frame
    }
}
