// Renderer 与原生窗口共用角色锚点；对话列不参与角色缩放。
export const petWindowLayout = {
  character: { width: 192, height: 208, defaultScale: 2 / 3, right: 200 },
  conversationLeft: 208,
  sizes: {
    pet: { width: 208, height: 208 },
    compact: { width: 496, height: 336 },
    expanded: { width: 496, height: 640 },
  },
} as const;

export type PetLayout = keyof typeof petWindowLayout.sizes;
