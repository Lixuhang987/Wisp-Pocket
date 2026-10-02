import { useEffect, useRef, useState } from "react";

const storageKey = "handagent.pet-size";

export function usePetSize(petId: string): [number, (size: number) => void] {
  const storageKey = `handagent.pet-size.${petId}`;
  const [size, setSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      return Number.isFinite(saved) && saved >= 50 && saved <= 150 ? saved : 100;
    } catch { return 100; }
  });
  return [size, (value) => {
    if (!Number.isFinite(value)) return;
    const next = Math.min(150, Math.max(50, value));
    setSize(next);
    try { localStorage.setItem(storageKey, String(next)); } catch { /* 偏好不可写时仍允许本次调整。 */ }
  }];
}

export function PetSizeControl({ size, bottom, onChange, onClose }: {
  size: number;
  bottom: number;
  onChange: (size: number) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  useEffect(() => { sliderRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!panelRef.current?.contains(event.target as Node)) onClose(); };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("blur", onClose);
    return () => { document.removeEventListener("pointerdown", outside, true); window.removeEventListener("blur", onClose); };
  }, [onClose]);

  return <div ref={panelRef} className="pet-size-control" data-pet-interactive role="group" aria-label="角色大小设置"
    style={{ bottom }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>
    <div className="pet-size-heading">
      <label htmlFor="pet-size-slider">桌宠大小</label>
      <output htmlFor="pet-size-slider">{size}%</output>
      <button type="button" aria-label="关闭大小设置" onClick={onClose}>×</button>
    </div>
    <input ref={sliderRef} id="pet-size-slider" type="range" min={50} max={150} step={5} value={size}
      onChange={(event) => onChange(Number(event.target.value))} />
    <button type="button" className="pet-size-reset" aria-label="恢复默认大小" onClick={() => onChange(100)}>恢复默认</button>
  </div>;
}
