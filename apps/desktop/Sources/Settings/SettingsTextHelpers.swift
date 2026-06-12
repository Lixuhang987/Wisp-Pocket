import Foundation

func trimmed(_ value: String) -> String {
    value.trimmingCharacters(in: .whitespacesAndNewlines)
}

func optionalTrimmed(_ value: String) -> String? {
    let value = trimmed(value)
    return value.isEmpty ? nil : value
}

func normalizedIdentifier(_ value: String) -> String {
    trimmed(value)
        .lowercased()
        .replacingOccurrences(of: #"[^a-z0-9_-]+"#, with: "-", options: .regularExpression)
        .trimmingCharacters(in: CharacterSet(charactersIn: "-_"))
}
