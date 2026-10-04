# assets

- `yachiyo.webp`：月见八千代透明动画图集，复制自用户本地 `~/.codex/pets/yachiyo/spritesheet.webp`。

图集尺寸为 1536×1872，8 列 × 9 行，单帧 192×208。SHA-256：`53cb761d21793fffe1ec9e3e02fa34477eee31859f697bdf0a13d915589c4aac`。

播放合约依据本地 hatch-pet 的 `references/animation-rows.md` 核实，已逐行查看 contact sheet。当前 `PetSprite.tsx` 使用 idle、running-right、failed、waiting、running 行及原帧时长；不播放各行末尾的透明空格。减少动态效果时固定 idle 第一帧。

[共享伙伴表单](../../../../thread-window-web/src/src.md)也直接复用此图集，以静态 idle 首帧展示设置画廊与管理预览；更换图集行列布局时同步更新该预览的裁切约定。
