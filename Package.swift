// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "HandAgent",
    platforms: [
        .macOS(.v15)
    ],
    products: [
        .executable(name: "HandAgentDesktop", targets: ["HandAgentDesktop"]),
        .executable(name: "HandAgentChromeBookmarksNativeHost", targets: ["HandAgentChromeBookmarksNativeHost"]),
        .executable(name: "HandAgentAtomicAppWindowPlugin", targets: ["HandAgentAtomicAppWindowPlugin"]),
        .executable(name: "HandAgentAtomicScreenshotPlugin", targets: ["HandAgentAtomicScreenshotPlugin"]),
        .executable(name: "HandAgentAtomicAXPlugin", targets: ["HandAgentAtomicAXPlugin"]),
        .executable(name: "HandAgentContextHistoryPlugin", targets: ["HandAgentContextHistoryPlugin"]),
        .executable(name: "HandAgentAutomationPlugin", targets: ["HandAgentAutomationPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/sindresorhus/KeyboardShortcuts", from: "2.0.0"),
        .package(url: "https://github.com/SimplyDanny/SwiftLintPlugins", from: "0.63.3")
    ],
    targets: [
        .executableTarget(
            name: "HandAgentDesktop",
            dependencies: [
                .product(name: "KeyboardShortcuts", package: "KeyboardShortcuts")
            ],
            path: "apps/desktop",
            exclude: ["TestsSwift", "desktop.md"]
        ),
        .target(
            name: "ChromeBookmarksNativeHostCore",
            path: "apps/chrome-bookmarks-native-host/Sources/Core"
        ),
        .executableTarget(
            name: "HandAgentChromeBookmarksNativeHost",
            dependencies: ["ChromeBookmarksNativeHostCore"],
            path: "apps/chrome-bookmarks-native-host/Sources/Host"
        ),
        .target(
            name: "HandAgentPluginSupport",
            path: "apps/builtin-plugins/Sources/Support"
        ),
        .executableTarget(
            name: "HandAgentAtomicAppWindowPlugin",
            dependencies: ["HandAgentPluginSupport"],
            path: "apps/builtin-plugins/Sources/AtomicAppWindow"
        ),
        .executableTarget(
            name: "HandAgentAtomicScreenshotPlugin",
            dependencies: ["HandAgentPluginSupport"],
            path: "apps/builtin-plugins/Sources/AtomicScreenshot"
        ),
        .executableTarget(
            name: "HandAgentAtomicAXPlugin",
            dependencies: ["HandAgentPluginSupport"],
            path: "apps/builtin-plugins/Sources/AtomicAX"
        ),
        .executableTarget(
            name: "HandAgentContextHistoryPlugin",
            dependencies: ["HandAgentPluginSupport"],
            path: "apps/builtin-plugins/Sources/ContextHistory"
        ),
        .executableTarget(
            name: "HandAgentAutomationPlugin",
            dependencies: ["HandAgentPluginSupport"],
            path: "apps/builtin-plugins/Sources/Automation"
        ),
        .testTarget(
            name: "HandAgentDesktopTests",
            dependencies: ["HandAgentDesktop"],
            path: "apps/desktop/TestsSwift"
        ),
        .testTarget(
            name: "ChromeBookmarksNativeHostCoreTests",
            dependencies: ["ChromeBookmarksNativeHostCore"],
            path: "apps/chrome-bookmarks-native-host/Tests"
        ),
        .testTarget(
            name: "HandAgentPluginSupportTests",
            dependencies: ["HandAgentPluginSupport"],
            path: "apps/builtin-plugins/Tests"
        )
    ]
)
