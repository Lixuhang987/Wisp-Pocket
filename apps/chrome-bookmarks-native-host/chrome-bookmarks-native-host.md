# chrome-bookmarks-native-host

Chrome Native Messaging stdio helper。Chrome 会按 native host manifest 启动该可执行文件；它不创建 session、不读取 AgentTrigger 实例，只把扩展消息转发给 Swift desktop 的本地 bridge。

## 文件

| 文件 | 职责 |
|------|------|
| `Sources/Core/NativeMessagingCodec.swift` | Chrome Native Messaging 4 字节 little-endian 长度前缀 JSON framing，校验协议版本和消息类型 |
| `Sources/Core/BridgeForwarder.swift` | 读取 `~/.spotAgent/agent-triggers/chrome-bookmarks-extension/bridge.json`，把消息 POST 到 Swift loopback bridge；定义扩展连接状态 DTO 和 `status.json` 写入器 |
| `Sources/Host/main.swift` | stdio executable 入口：循环读取 Chrome 消息、hello 成功转发到 Swift bridge 后写 connected 状态、stdio 结束或转发失败时写 disconnected 状态、向扩展返回 `{ ok }` 或 `{ ok:false,error }` |
| `Tests/NativeMessagingCodecTests.swift` | Swift 测试覆盖 frame encode/decode、hello 解码、连接状态文件写入与协议版本拒绝 |

## 本地文件约定

Swift desktop 的 `ChromeBookmarksExtensionBridgeServer` 启动时写入：

```text
~/.spotAgent/agent-triggers/chrome-bookmarks-extension/bridge.json
```

文件包含 loopback host、port、token 和更新时间。helper 每次收到扩展消息后读取该文件，并用 `Authorization: Bearer <token>` 转发到 Swift bridge。

Chrome Native Messaging Host manifest 写入：

```text
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.handagent.chrome_bookmarks.json
```

desktop 只在启动环境提供 `HANDAGENT_CHROME_BOOKMARKS_EXTENSION_ID` 时写 manifest，避免把占位 extension id 写进 Chrome 配置。打包 App 会把 `HandAgentChromeBookmarksNativeHost` 复制到 `Contents/Resources/`，manifest path 默认指向该资源；开发运行可用 `HANDAGENT_CHROME_BOOKMARKS_NATIVE_HOST_PATH` 覆盖。

扩展连接状态写入：

```text
~/.spotAgent/agent-triggers/chrome-bookmarks-extension/status.json
```

helper 收到扩展 `handagent.bookmarks.hello` 且成功转发到当前 Swift bridge 后写 `connected`，Chrome 关闭 native messaging stdio 或 helper 转发失败时写 `disconnected`。Settings 读取该文件判断扩展到 Swift bridge 的链路是否真实可用，不能只依赖 manifest/helper 是否存在；`status.json.updatedAt` 必须不早于当前 `bridge.json.updatedAt`，避免桌面重启后旧 connected 状态误报可用。

## 验证命令

```bash
bash ./scripts/swiftw test --filter NativeMessagingCodecTests
bash ./scripts/swiftw build --product HandAgentChromeBookmarksNativeHost
```
