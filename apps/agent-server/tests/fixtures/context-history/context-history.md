# Context History 共享夹具

这些 JSON / base64 文件在提交 `7e352e7` 中由 Swift 调用真实 `ContextHistoryStore` 生成，Node 默认读取用例直接消费，避免双方自造格式。

- `activities.json` / `screenshots.json`：活动与图片的原子索引格式。
- `ax/`：真实保存的 AX JSON；目标数字在活动中转为字符串，读取时须归一化比较。
- `screenshots/`：original 与 thumbnails 的完整 PNG base64 文本。

索引中的证据绝对路径是生成环境路径；测试复制夹具后只按文件名重定位路径，不改业务字段。它们作为静态跨语言证据保留，常规测试不重新生成或改写夹具。固定 sample / screenshot 标识用于关联，AX id 由 Store 创建。
