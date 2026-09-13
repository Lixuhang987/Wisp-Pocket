# assets

本目录是多桌宠原型的素材适配层。用于比较形象存在感与资料交付；共享 token 和原始八千代图集直接引用 owning 目录。

## 直接子节点

- `miku-preview.webp`：用户本地 Miku 图集的第 1 行第 1 帧，192×208，lossless WebP；用于第二只桌宠的静态预览。

## 复用记录

| 材料 | 来源 / 使用条件 | 本次用途与限制 |
| --- | --- | --- |
| 八千代动画 | [现有图集](../../../assets/yachiyo.webp)，来源与 hash 见 [owning assets](../../../assets/assets.md) | 直接引用；遵循 `PetSprite.tsx` 的 idle / running / waiting / failed 行与帧时长，减少动态效果时固定首帧 |
| Miku 首帧 | `/Users/mu9/.codex/pets/miku/spritesheet.webp`，用户本机桌宠素材；本次选作第二只桌宠的本地原型参考 | 从 1536×1872、8×9 图集中裁剪；静态预览不能证明完整动画效果 |
| 小八档案 | 复用现有八千代图集 | 用于测试不同身份/提示可以共用外观；没有新增第三套角色美术资产 |
| 共享主题 | `apps/thread-window-web/src/styles/generated-theme.css` | `styles.css` 直接导入 `--ha-*` 变量；没有复制或修改 token 表 |
| 活动 PDF 与窗口背景 | 本次新编的“松林社区读书交换日”场景 | HTML 展示性文件、邀请文案与模拟输出；不是用户真实文档 |

Miku 原图 SHA-256：`70501c4392f93fe1a2f7bc4786c30c71d067510038a9a94e0c256661a1251153`。

首帧 SHA-256：`8b46692a3b8d328ca144b4029b28eef1239b36cc6b59e5df9eb5e022a6ec668e`。

本目录只保留必要裁图；后续若需要验证 Miku 的动作、人设和语音关系，应使用有明确播放合约的完整素材，再记录新的验证边界。
