---
status: proposed
---

# 桌宠身份贯穿对话，可选详情窗不承担运行门槛

多桌宠主入口的推荐设计让一个 Thread 永久归属一个桌宠档案，创建时保存实际角色提示快照；同屏或单席位切换只改变展示，不重建历史或运行队列。共享 Workspace 继续是文件根与默认工作位置，不能推导共享全部对话或每宠 OS 隔离。正式实现前仍应核对[完整设计](../design/pet-dialogue/pet-dialogue.md)与验证门槛；此 ADR 尚未落地。

没有采用“所有宠物共享一段群聊、切宠即换 system prompt”，因为它会混淆历史来源、未答请求和执行配置；也没有采用“每宠一个独立 App/后端”，因为窗口数量不应复制权限、工具和持久化 owner。跨宠物转交创建目标的独立 Thread，并明确带入的材料和来源。

ThreadRegistry/Thread 继续唯一拥有运行状态。主入口成立还要求服务健康与可选 ThreadWindow 预热解耦，关闭或崩溃的详情窗不能阻断桌宠输入、请求回执或 Dynamic Tool Provider。桌宠会话面板可展开，但必须沿用同一角色与 Thread，不能只给旧 ThreadWindow 改名后宣称完成迁移。
