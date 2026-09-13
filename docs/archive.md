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


- [ ] **CH3 查询与证据可读**：经真实工具读取索引、批量 AX 详情、缩略图和原图，核对内容、时间和标识；损坏/缺失证据与权限失败可定位。

### Issue #4：CH3 查询与证据可读

- **验证日期**：2026-09-13。
- **验证环境**：macOS 15.5 (24F74)，54d48cb 修复产物 SHA-256 b86c404631a0bb81b1a62ac0624e30770ac06c2a1b94eb9cb6a8b6c14cc95be7；隔离 home-final-20260913，Host 70353 / Node 70357，真实 Provider 与系统能力。
- **验证过程**：经 activity_index 核对只返回 id、timestamp、app/window、thumbnailId；按两个 fixture 样本 id 批量读取实际 AX，核对已观察的 QA Input / CH1 in-flight verified。QA 客户端从真实 thumbnails / screenshot_original 的 contentItems[imageContentIndex] 读取 PNG，解码后在图片查看器实际观察到 Window A 与 Saved 文本。
- **证据**：截图 D07CB80E-152E-44DD-B24D-6C65CE00F892 的 sampleId 为 BEDC87FA-E929-47C3-B8FE-6220890C406A，时间 2026-09-13T10:41:25Z；缩略图 480×310、原图 1440×932，PNG 尺寸与返回元数据一致。缺失样本、空 ids、损坏 AX、缺失原图、损坏原图和原图无读取权限均 success:false，分别返回 not_found、invalid_arguments、read_failed 或 invalid_image。将隔离 AX 目录临时设为只读后，真实采集在 collection.lastErrorMessage 和 CUA 设置页共同显示 accessibility_snapshot / activity_sample: write_failed 与无写入权限原因；恢复后工具 lastErrorMessage=null，CUA 恢复“最近采样”。记录见 .cache/issue-4-qa/CH3-positive.json、CH3-negative.json、CH3-collection-failure.json、CH3-final-verdict.json、CH3-final-evidence.jsonl 与 responses/ch3-*。
- **清理状态**：损坏/缺失演练的文件内容与文件权限均已恢复，目录权限恢复，恢复看守进程已停止；本项测试的是隔离数据文件读写权限，没有撤销或声称验证 macOS TCC 拒绝。业务数据保留至 HOST1 统一清理。
- **结论**：CH3 完整通过。


- [ ] **CH4 窗口关闭**：关闭 Settings 与 ThreadWindow 后持续采集，经重新打开后的真实工具读到关闭期间记录。

### Issue #4：CH4 窗口关闭后继续采集

- **验证日期**：2026-09-13。
- **验证环境**：macOS 15.5 (24F74)，同一修复产物 SHA-256 b86c404631a0bb81b1a62ac0624e30770ac06c2a1b94eb9cb6a8b6c14cc95be7；home-final-20260913，Host 70353、Electron 70354、Node 70357、fixture 76018。
- **验证过程**：CUA 查看 Settings 中实际会话窗口快捷键 Command-H；用 osascript 发送后，观察真实 Electron ThreadWindow。分别核对前台 PID 后用 osascript Command-W 关闭 ThreadWindow 和 Settings，再切至 fixture。连续 65.5 秒、14 次系统窗口查询均无 Host/Electron 可见窗口，真实 Provider 始终响应。重开 Settings 后通过真实工具批量读取关闭期间样本及截图。
- **证据**：关闭期间新增 7 个 Activity Sample 与 1 个 Screenshot Record；7 份 AX 详情可读。截图 57E4E898-8AB5-4718-949B-D33B55D62FC8（2026-09-13T11:04:47Z，sampleId=33961BCA-FB2F-47AB-BEF2-65A4B1CDBFCC）原图 1440×932，经工具内容索引取出后以 ImageIO/sips 完整解码。原始时间、前台变化和窗口计数在 .cache/issue-4-qa/CH4-final-evidence.jsonl、CH4-closed-monitor.json、CH4-final-verdict.json、responses/ch4-*。期间用户前台还切至其他已有应用，产品窗口始终关闭；后续外部终端标题变化引起的 context_changed 在工具与 CUA 设置页明确可见，稳定 fixture 下工具状态恢复，未把不一致证据拼接为成功截图。
- **清理状态**：ThreadWindow 保持关闭，Settings 为后续开关验收重新打开；本项没有创建或修改用户 Thread。
- **结论**：CH4 完整通过。


- [ ] **CH5 停机与重启**：禁用后和完全退出后均无新写入；重启遵守配置并能读取旧活动、AX 与图片。

### CH5：禁用、退出与重启

- **验证日期**：2026-09-13。
- **验证环境**：macOS 15.5 (24F74)，`codex/issue-4-builtin-modules` 的 `dist/Wisp Pocket.app`；主程序 SHA-256 `b86c404631a0bb81b1a62ac0624e30770ac06c2a1b94eb9cb6a8b6c14cc95be7`。内置数据隔离在 `.cache/issue-4-qa/home-final-20260913`，真实 Dynamic Tool Provider 与真实 macOS 能力；模型为 mock。
- **验证过程**：CUA 禁用 Context History 后，旧声明调用明确返回 `context_history is disabled`，工具数 21→17；观察 65.22 秒，340 个历史文件无内容、大小或 mtime 变化。CUA 重新启用并核对配置两个 true、21 个工具后，经 `osascript` 核对前台 PID 并发送 Command-Q。再观察 65.22 秒，370 个文件完全不变。确认 Host 70353、Electron 70354、Node 70357 均已退出；同 home 重启到 Host 22071 / Node 22083，CUA 工具页仍显示两个开关 on，采集恢复。
- **证据**：`.cache/issue-4-qa/CH5-final-evidence.jsonl`、`ch5-{disabled,exited}-verdict.json`、`CH5-restarted-verdict.json`、`responses/ch5-*`。真实工具重新读到 CH2 的活动与 AX `461F697A-7AE6-4B14-BADB-F4F455891C9E`、`BEDC87FA-E929-47C3-B8FE-6220890C406A`，AX 保留受控文本；原图 `D07CB80E-152E-44DD-B24D-6C65CE00F892` 的 sampleId、1440×932 尺寸与内容一致，解码后 SHA-256 仍为 `d548ba238de665fdd0cc5838b2791a142603fc87abafe6126e69ea9f06e4846c`。
- **证据边界**：首次退出辅助脚本只等 12 秒，并将 Node 的 `Z / defunct` 记录判为存活；后续确认两个服务端口关闭、Electron/Node 均消失，以上最终证据为准。索引查询一次超出公开上限返回明确错误，改用合法 `limit:200` 后读回；辅助解析误读图片层级不计作产品失败。
- **结论**：CH5 全部步骤通过；开关恢复为本项开始时的两个 on。进程、隔离数据与原始图片待 HOST1 统一清理，未改动用户 Thread。


- [ ] **AU1 录制与保存**：实际受控操作跨工具调用保留会话，停止保存 Trace；验证显式事件与真实用户事件、证据时间/引用及监听清理。

### AU1：跨调用录制、真实事件与监听清理

- **验证日期**：2026-09-13。
- **验证环境**：macOS 15.5 (24F74)，本 worktree 已验证的构建（SHA-256 `b86c404631a0bb81b1a62ac0624e30770ac06c2a1b94eb9cb6a8b6c14cc95be7`），隔离 home-final-20260913，真实 Swift Provider、fixture PID 76018；Context History 暂停，Automation 启用，已有系统授权有效。
- **验证过程**：CUA 实际点击输入框、设置 `AU1 recorded 中文 Ω 2026`、点击 Apply，`osascript` 向核对过的前台 fixture 发送 Command-A；经五次 `record_event` 登记动作与断言，停止保存 `au1-explicit2-trace-20260913`。五个事件共享 recordingId，具有独立 timestamp 和前后证据，全部取证目标均为 fixture；CUA 和工具 PNG 均确认 Saved 文本。
- **证据**：`AU1-explicit-verdict.json`、`AU1-live-verdict.json`、`AU1-final-evidence.jsonl` 与 `responses/au1-*` 位于 `.cache/issue-4-qa/`。真实事件 Trace `au1-live-native-trace` 记录 `command+left`、`command+shift+right` 两条 `macos_event_tap` 事件，时间分别为 11:59:16.541Z / 11:59:16.753Z；停止证据时间 11:59:17Z，CUA 确认选中 `au1live93`。两条事件均通过 `evidenceRef=finalEvidence` 引用共享证据、标记 `recording_stop`，没有重复内联前后图片；工具图片内容索引有效，PNG 1440×932 可解码。
- **清理证据**：`CGGetEventTapList` 按 Host PID 核对，开始前 0、录制中 1、正常停止后 0。有效禁用轮 `au1-live-disable2` 在 34.16 秒观察内随 CUA 关闭开关释放监听；工具声明退至 9，旧调用明确禁用失败，重新启用后旧会话明确不存在。退出轮监听也为 1→0；经 `osascript` Command-Q，Host 22071 / Electron 22072 / Node 22083 全部退出。同 home 重启 Host 40110 / Node 40126 后无监听，旧录制不存在，Automation 仍启用。
- **证据边界**：首份显式 Trace 的前台证据混入其他应用，不计通过；CUA 注入事件未进入 event tap 的空 Trace、被辅助计时器先行停止的禁用轮均不计通过。有效实时录制使用上述原生快捷键。未撤销用户既有 macOS TCC 授权来制造权限拒绝。
- **结论**：AU1 完整通过；本次录制均已结束，两个有效 Trace 留在隔离目录供后续验证，原始桌面证据待 HOST1 清理。


- [ ] **AU2 持久流程重跑**：保存 Trace/Policy 后重启，按 policyId 在真实窗口执行步骤、条件与断言，经 history 核对结果与证据。

### AU2：Policy 持久化与重启后真实执行

- **验证日期**：2026-09-13。
- **验证环境**：macOS 15.5 (24F74)，本 worktree 构建 SHA-256 `b86c404631a0bb81b1a62ac0624e30770ac06c2a1b94eb9cb6a8b6c14cc95be7`，隔离 home-final-20260913，真实 Provider 与 fixture；Automation on，Context History off。
- **验证过程**：从 AU1 的有效 Trace 创建 `au2-trace-20260913` v1；通过 branch 入口创建 `au2-branch-20260913` v1；通过完整 policy 入口创建 `au2-policy-20260913` v7。核对返回内容与磁盘对象一致。将受控窗口改成基准文本，经 `osascript` Command-Q 退出并同 home 重启 Host 43006 / Node 43020；三个 Policy 和原 Trace 的 SHA-256 均不变。分别按 policyId 真实执行，CUA 确认 Saved 文本依次为 `AU1 recorded 中文 Ω 2026`、`AU2 branch 中文 Ω 2026`、`AU2 explicit policy 中文 2026`。
- **证据**：`.cache/issue-4-qa/AU2-before-restart.json`、`AU2-{trace,branch,policy,history}-verdict.json`、`AU2-final-evidence.jsonl`、`responses/au2-*`。对应 Run `8C477DBF-B0FD-4752-B185-D50BECC17FAB`、`BFF04BD2-1F62-4B09-AB2D-1AB445F00339`、`A1642C64-F4AC-446F-B708-FC3AE9C7FD3D` 均 completed，分别保留 5/4/4 个已完成步骤及版本 1/1/7；后两个 Run 匹配 QA Input 条件、完成 waitFor 与 Saved 断言。真实 history 返回相同版本、分支、进度、AX 与图片，图片 SHA 与各 Run 响应一致；最终 PNG 的 fixture 裁剪已实际查看，与 CUA 相符。
- **退出观察**：原 Host 40110 已退出，Node 40126 曾为僵尸、Electron 40111 曾停在 NSAlert；后续核对三个 PID 均不存在。未取得该模态框错误正文，不将其当作已诊断缺陷；退出可靠性仍在 HOST1 收尾时核对。
- **结论**：AU2 的保存、重启、真实步骤/条件/断言执行及历史读回完整通过；未调用真实外部模型。
