# 前端伙伴状态

Pet store 是 Electron UI Shell 的唯一伙伴状态源，持久化资料、Workspace / 当前 Thread 关联和桌面显隐、大小与位置。后端不认识 Pet；Thread 消息与执行事实继续直连后端。

## 直接子节点

- frontendPetStore.ts：初始化、资料保存、分配和原子持久化。
- petTypes.ts：仅前端使用的资料形状，不进入 core 协议。

自动打开历史或 Permission 先复用已有伙伴；设置明确选伙伴时隐藏关联可转移，可见伙伴关联绝不可夺取。所有修改必须经 store 一次提交，不允许多 renderer 查询后各自写入。隐藏和换工作区不取消任务。图片采用受管前端数据 URL，不依赖后端 Blob。
