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


- [ ] **CH2 变化与周期采样**：实际切换 app/window 并持续停留，核对变化样本、30 秒周期样本、60 秒截图及目标关联。

### Issue #4：CH2 变化与周期采样

- **验证日期**：2026-09-13。
- **验证环境**：macOS 15.5 (24F74)，同 CH1 的 54d48cb 修复产物（SHA-256 b86c404631a0bb81b1a62ac0624e30770ac06c2a1b94eb9cb6a8b6c14cc95be7）和隔离 home-final-20260913；Host 70353、Node 70357、fixture 76018，Context History 启用。
- **验证过程**：通过真实 Provider 切至 Settings，再切回 fixture Window A；每个目标停留超过一次 5 秒观察，CUA 观察窗口及采样状态。对 fixture 每 5 秒查询实际前台状态，共 14 次，连续 65.31 秒均为 PID 76018 / window 24874。之后经真实索引、批量详情和缩略图接口读回结果，并与持久化元数据核对。
- **证据**：Settings 变化样本 04D27A92-9EA4-45D9-8A04-F0A0CB5DFD21（10:39:56Z）；fixture 变化样本 BEDC87FA-E929-47C3-B8FE-6220890C406A（10:41:04Z），同目标周期样本 461F697A-7AE6-4B14-BADB-F4F455891C9E（10:41:36Z），间隔 32 秒。截图 D07CB80E-152E-44DD-B24D-6C65CE00F892（2026-09-13T10:41:25Z）距上次截图 62 秒，sampleId 指向上述 fixture 变化样本；sample.thumbnailId 反向一致。三个样本的 AX app PID/bundleId、window id/ownerPid 均与活动元数据匹配，collection 正在运行且无错误。原始证据：.cache/issue-4-qa/CH2-final-evidence.jsonl、CH2-monitor.json、CH2-final-verdict.json 与 responses/ch2-final-*。
- **清理状态**：本项保留隔离记录用于 CH3 图片读取，最终统一清理由 HOST1 记录。
- **结论**：CH2 完整通过。
