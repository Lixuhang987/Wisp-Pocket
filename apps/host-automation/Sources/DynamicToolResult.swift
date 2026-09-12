import Foundation

@MainActor
public struct DynamicToolResult {
    public let success: Bool
    public let contentItems: [[String: Any]]

    public init(success: Bool = true, contentItems: [[String: Any]]) {
        self.success = success
        self.contentItems = contentItems
    }

    public static func json(_ value: Any, success: Bool = true) -> DynamicToolResult {
        do {
            let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
            return .text(String(decoding: data, as: UTF8.self), success: success)
        } catch {
            return .text("encode_failed: \(error.localizedDescription)", success: false)
        }
    }

    public static func jsonWithImages(_ value: Any, success: Bool = true) -> DynamicToolResult {
        var images: [[String: Any]] = []
        var imageIndexes: [String: Int] = [:]
        func metadata(_ value: Any) -> Any {
            if var object = value as? [String: Any] {
                if let base64 = object["imageBase64"] as? String {
                    let mimeType = object["mimeType"] as? String ?? "image/png"
                    let url = "data:\(mimeType);base64,\(base64)"
                    let index: Int
                    if let existing = imageIndexes[url] {
                        index = existing
                    } else {
                        index = images.count + 1
                        imageIndexes[url] = index
                        images.append(["type": "inputImage", "imageUrl": url])
                    }
                    object.removeValue(forKey: "imageBase64")
                    object.removeValue(forKey: "thumbnailBase64")
                    object["imageContentIndex"] = index
                }
                for key in object.keys.sorted() {
                    if let item = object[key] { object[key] = metadata(item) }
                }
                return object
            }
            if let array = value as? [Any] { return array.map(metadata) }
            return value
        }
        let text = json(metadata(value), success: success)
        return DynamicToolResult(success: text.success, contentItems: text.contentItems + images)
    }

    public static func text(_ value: String, success: Bool = true) -> DynamicToolResult {
        DynamicToolResult(success: success, contentItems: [["type": "inputText", "text": value]])
    }
}
