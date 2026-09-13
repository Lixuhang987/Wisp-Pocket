# 实机验收归档

本文保存已经完整通过的实机验收项及其证据。尚未通过的项目见 [manual-qa](./manual-qa.md)，当前缺陷见 [bugs](./bugs.md)。


- [ ] **CH1 默认与持久化**：确认两个开关默认关闭，启用后立即声明对应工具，重启遵守保存选择，声明刷新保留在途调用。

### Issue #4：CH1 默认与持久化

- **验证日期**：2026-09-13。
- **验证环境**：macOS 15.5 (24F74)，codex/issue-4-builtin-modules / 54d48cb，dist/Wisp Pocket.app，SHA-256 b86c404631a0bb81b1a62ac0624e30770ac06c2a1b94eb9cb6a8b6c14cc95be7。Web、Swift test/build、打包与签名检查通过；mock 仅替代模型，工具经过真实 server、Dynamic Tool bridge、Swift Provider 与系统实现。数据隔离于 .cache/issue-4-qa/home-final-20260913。
- **验证过程**：新 home 配置缺失，CUA 观察两个开关 off / 已关闭，没有历史文件，Provider 声明 9 个原生工具。CUA 启用后显示 on / 等待首次采样，配置保存两个 true，声明变为 13、21 个工具。osascript 核对前台 PID 后发送 Command-Q，Host 62747 / Node 62759 均退出；同 home、同产物重启为 Host 70353 / Node 70357，CUA 开关、磁盘配置与 21 个工具声明均保持。随后在真实 Automation 等待期间用 CUA 关闭/重开 Context History，再点击 fixture Apply；Window A 显示 Saved: CH1 in-flight verified，最终两步及断言成功。
- **证据**：调用 ch1-final-inflight2-run 从 2026-09-13T10:28:02.903Z 至 2026-09-13T10:31:55.815Z（UTC，约 233 秒）；swift-host 于 2026-09-13T10:31:16.238Z 声明 17 个工具，于 2026-09-13T10:31:17.015Z 恢复 21 个工具，均位于同一调用期间。Run 67814A36-F764-490A-9908-BD74EDC892A1 的 activateApp / waitFor 两步完成，success:true / completed，无 offline 或默认 15 秒超时。原始记录为 .cache/issue-4-qa/CH1-final-evidence.jsonl、CH1-final-verdict.json、provider-hellos.jsonl、launches-evidence.jsonl、shutdown-evidence.jsonl 和 responses/ch1-final-inflight2-run.json。前次 60 秒等待先于按钮提交超时，不计入通过依据。
- **清理状态**：隔离数据及受控 fixture 暂留供后续验收，最终清理由 HOST1 记录。
- **结论**：CH1 完整通过。
