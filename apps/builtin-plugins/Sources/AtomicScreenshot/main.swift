import CoreGraphics
import Foundation
import HandAgentPluginSupport
import ImageIO
import ScreenCaptureKit
import UniformTypeIdentifiers

runLineDelimitedPluginServer { namespace, tool, _ in
    guard namespace == "screenshot" else {
        return .text("unsupported namespace: \(namespace)", success: false)
    }
    switch tool {
    case "capture", "thumbnail":
        do {
            let image = try await captureMainDisplay()
            guard let base64 = pngBase64(from: image) else {
                return .text("screen capture encode failed", success: false)
            }
            return .json([
                "imageBase64": base64,
                "thumbnailBase64": base64,
                "mimeType": "image/png",
                "width": image.width,
                "height": image.height,
            ])
        } catch {
            return .text(error.localizedDescription, success: false)
        }
    default:
        return .text("unsupported screenshot tool: \(tool)", success: false)
    }
}

private func captureMainDisplay() async throws -> CGImage {
    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
    guard let display = content.displays.first else {
        throw NSError(
            domain: "HandAgentAtomicScreenshotPlugin",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "No displays available"]
        )
    }
    let configuration = SCStreamConfiguration()
    configuration.width = display.width
    configuration.height = display.height
    configuration.showsCursor = false
    return try await SCScreenshotManager.captureImage(
        contentFilter: SCContentFilter(display: display, excludingWindows: []),
        configuration: configuration
    )
}

private func pngBase64(from image: CGImage) -> String? {
    let data = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else {
        return nil
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { return nil }
    return (data as Data).base64EncodedString()
}
