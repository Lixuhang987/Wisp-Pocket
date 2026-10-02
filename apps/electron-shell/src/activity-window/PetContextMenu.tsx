import { useEffect, useRef, type KeyboardEvent } from "react";

export type PetMenuAction = "manager" | "history" | "size" | "hide";

const actions: Array<{ action: PetMenuAction; label: string }> = [
  { action: "manager", label: "伙伴" },
  { action: "history", label: "对话" },
  { action: "size", label: "调整大小" },
  { action: "hide", label: "隐藏" },
];

export function PetContextMenu({ name, petId, bottom, onSelect, onClose, onEscape }: {
  name: string;
  petId: string;
  bottom: number;
  onSelect: (action: PetMenuAction) => void;
  onClose: () => void;
  onEscape: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  function handleKey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      onEscape();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...menuRef.current!.querySelectorAll<HTMLButtonElement>("button")];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus({ preventScroll: true });
  }

  return <div ref={menuRef} className="pet-context-menu" data-pet-interactive role="menu" aria-label="桌宠菜单"
    style={{ bottom }} onKeyDown={handleKey}>
    <div className="pet-context-identity" role="presentation">{name} · {petId.slice(-6)}</div>
    {actions.map(({ action, label }) => <button key={action} type="button" role="menuitem" tabIndex={-1}
      onClick={() => onSelect(action)}>{label}</button>)}
  </div>;
}
