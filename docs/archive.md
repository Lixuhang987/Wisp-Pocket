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


- [ ] **AU3 失败与显式修复**：失败保留进度、原因和证据；修复数据应用不改写失败 Run，只有真实重跑才产生新成功记录。

### AU3：失败、显式修复、真实重跑与退出取消

- **验证日期**：2026-09-13。
- **验证环境**：macOS 15.5 (24F74)，codex/issue-4-builtin-modules worktree；真实 Swift Dynamic Tool Provider、macOS 系统能力和隔离业务 home-final-20260913，模型为 mock。最终取消复验使用修复提交 1381718 的签名包；Swift 主程序 SHA-256 ee8652922c8291e0a1f6e1dd2e38a81b5143a4f8ca7d9d6193311c9a12e516fb，Electron bridge SHA-256 edcf5250ad107b88ed8e9668d2726bdd85056d5dc757f9963669b0c389425cab。
- **验证过程**：经实际工具分别触发步骤、条件和断言失败，检查进度、原因、阶段与可读图片。默认仅产生 pending Repair Request。显式 repair_apply 升至 v2，重复请求及过期 Patch/Request 均明确失败；应用修复不新增 Run、不改写旧失败文件。v2 真实执行后再以隔离持久 Patch fixture 验证 apply_patch 升至 v3，并再次实际执行，CUA 确认两个 Saved 结果。分别通过设置禁用和正常退出取消正在等待的流程，重启经 history 核对取消与旧记录。
- **证据**：下列 Run 均经最终真实 history 读回；四个旧失败 Run 原文件 SHA 一致，v2/v3 成功 Run 图片与最初响应 SHA 一致，修复请求仍为 applied。

| 场景 | Run | 结果 |
| --- | --- | --- |
| 步骤失败 | 09191C4E-920F-455F-B881-F8DAAFFF6D32 | failed，完成 2 步，steps |
| 过期修复的来源失败 | 240A2346-E446-4068-B38B-692C81F3992A | failed，完成 2 步，steps |
| 条件失败 | 5F5C173E-3434-4625-8482-E3FD0DCCAF79 | failed，完成 0 步，conditions |
| 断言失败 | FF956139-0091-43D4-84ED-5415C883A606 | failed，完成 3 步，assertions |
| v2 修复后重跑 | 86F8BA6C-AC49-4D2E-97C3-90F91B9B2517 | completed，完成 4 步，Saved: AU3 repair run verified 中文 |
| v3 已有 Patch 入口后重跑 | 930BE25B-F82B-46D9-8207-8F53B2543159 | completed，完成 4 步，Saved: AU3 saved patch run verified 中文 |
| 禁用取消 | 12F1AA4F-08EA-42E4-B02E-C875704F4905 | cancelled，保留 2 步，无新增修复请求 |
| 正常退出取消 | 7410F4B8-E149-44A1-9BCC-572A52B75EDF | cancelled，保留 2 步，无新增修复请求 |

- **退出证据**：单一辅助进程确认磁盘 running/两步完成后立即 osascript Command-Q，2.088 秒内 Host 95304、Electron 95308、Node 95367 全部结束。取消记录为 failureStage=steps、failedStepIndex=2、failureReason=automation run cancelled、evidence.cancelled=true；文件 SHA-256 f0a48ab84e25d759a0da7a03b188898b215aa8a76a8b096787125f0c40c64b0c，重启后不变。CUA 确认输入为 au3-cancel-persist reached，Saved 仍保留上次结果，等待后的 Apply 未执行。退出令工具连接关闭、辅助 HTTP 调用报 500；取消结论来自可信磁盘终态及重启后的实际 Provider history。
- **修复与检查**：实测发现的 EPIPE 与退出未保存取消状态分别经 b22c542、1381718 修复，均完成红/绿回归、完整 Web、Swift test/build/package、签名核验和独立文档审核。较早的 AX cannot_complete 轮次不计为取消通过；旧包遗留 running 的缺陷文本与文件哈希见历史提交 40719ac，原始文件已随 HOST1 清理，不作为本轮成功结果。
- **证据位置**：.cache/issue-4-qa/AU3-final-history-verdict.json、AU3-{apply,run_repair,run_patch,cancel-disable}-verdict.json、au3-cancel-persist-{pending,verdict}.json、cancel-shutdown-fixed-artifact.json。原始桌面响应、整屏图片及 AU3-final-evidence.jsonl 已随 HOST1 清理，保留本脱敏记录与上述汇总。
- **结论**：通过。全局配置恢复、受控窗口和数据清理结果见后续 HOST1 归档。


- [ ] **HOST1 宿主能力与清理**：验证保留的宿主读取/操作、可消费图片和明确参数失败；核对产物/进程，恢复配置并清理本次测试资源。

### HOST1：原生宿主工具、产物与清理

- **验证日期**：2026-09-13。
- **验证环境**：macOS 15.5 (24F74)，本 worktree 的最终签名包（代码提交 1381718）；真实 Dynamic Tool Provider 与 macOS 能力，LLM 为 mock。Swift 主程序 SHA-256 ee8652922c8291e0a1f6e1dd2e38a81b5143a4f8ca7d9d6193311c9a12e516fb；包内 Electron bridge SHA-256 edcf5250ad107b88ed8e9668d2726bdd85056d5dc757f9963669b0c389425cab，与当前构建资源一致。
- **验证过程**：通过 app_list、app_activate、app_frontmost、window_list 核对 fixture PID 76018 / window 24874 及其所有者；经 app/window/element 三种 AX 入口读取并定位 QA Input 与 Apply。实际 click、set_value、type_text 与 hotkey 操作后由 CUA 核对界面。读取剪贴板只检查返回结构，未改写或展示内容。
- **输入证据**：set_value 得到 HOST1 set_value 中文 Ω 🙂 café；键盘输入得到 HOST1 输入 Ω 🙂 café 2026。Command+Left / Command+Shift+Right 选择整行，Option+Shift+Left 替换单词，Control+A 移到开头，Shift+keycode:123 替换末字符，字符串与数组键值均成功。最终 CUA 与 Provider AX 读取结果均为 Saved: >prefix 🙂-中文；fixture 磁盘文件未单独复核，已随清理移除。Command-A 在该无 Edit 菜单的 fixture 中经工具和 osascript 均无选择效果，该初轮未用于判定工具失败；后续使用 CUA 已确认的原生编辑快捷键完成验证。
- **图片与 OCR 证据**：screen_capture(window) 返回可消费的 PNG inputImage，真实尺寸 820×548 与元数据一致，SHA-256 508e94b369f339639a7780ba6557c08e9d0afee43a3c9f26b902658be3e4972f。实际打开图片确认窗口标题、输入和 Saved 内容与 CUA 一致。ocr_read 只接收该图片，在 en-US 下识别 Wisp Pocket、Apply、Saved 等 8 行内容；未将此结果表述为中文 OCR 验收。
- **失败边界证据**：14 个非法调用分别覆盖 App 标识类型/不存在、截图目标类型/显示器标识/不存在/区域坐标、非法图片、AX 目标类型、重复 elementId 字段、缺失 value，以及未知/仅 modifier/歧义/越界快捷键，均 success=false 并携带 invalid_argument 或 not_found。AX 深度 7 按既有约定截断至 6，子节点最多 25；此行为与已有解析用例一致。系统沿用已有辅助功能和屏幕录制授权，未撤销 macOS TCC 授权来实测拒绝；无窗口 Host 自激活仍未记为通过。
- **产物与进程证据**：签名通过，包内没有五个旧 Plugin 可执行入口，运行时没有对应 Plugin 进程。最终任务进程为 Host 96542、Electron 96543、Node 96553，业务由 Swift Host 运行；无 Automation event tap。SwiftPM 当前仅保留桌面 App 与 Chrome Bookmarks Native Host 两个可执行产品。
- **配置与停止证据**：CUA 将 Context History/Automation 均恢复 off，配置文件两项均 false，声明退至 9 个原生工具；两项旧调用均明确 disabled，event tap 为 0。正常 osascript Command-Q 后 Host/Electron/Node 均消失，无 EPIPE/僵尸残余；fixture 经路径核对后停止。此时 4317/43294 均空闲。
- **清理与恢复证据**：移除旧/当前两个隔离业务 home、原始 Provider 响应、整屏图片、日志、token、fixture bundle 和临时脚本，共 1569 个文件 / 385514942 字节。保留脱敏汇总与两张已查看的 fixture 图片，保留最终构建；清理没有操作真实用户业务目录。随后使用原有 /tmp/issue1-live/launch.sh 恢复 /tmp/issue1-live/app/Wisp Pocket.app，核对 Host PID 7775、4317 listener PID 7780；原启动配置文件未修改。4317 此时属于恢复的旧实例。
- **证据位置**：.cache/issue-4-qa/HOST1-{setvalue,keyboard,image,invalid,ui,clipboard,process,restored,stopped,cleanup}-verdict.json、HOST1-old-instance-restored.json、HOST1-window.png、FINAL-QA-SUMMARY.json；AU2-policy-fixture.png 为保留的先前脱敏图片。原始桌面证据已按本项清理，已提交归档的文本和哈希保留。
- **结论**：通过。CH1–CH5、AU1–AU3、HOST1 九项已逐项验收归档；已说明的权限与无窗口激活边界不计作通过场景。全部代码检查、打包、签名和独立文档审核已完成，修改仅在本地分支提交。
