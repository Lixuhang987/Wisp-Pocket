import { useEffect, useRef } from "react";

export function usePetSize(petId: string, size = 100, onError?: (message: string) => void): [number, (size: number) => void] {
  return [size, value => {
    if (!Number.isFinite(value)) return;
    const next = Math.min(150, Math.max(50, value));
    void window.handAgentSettings?.setPetSize(petId, next).catch(error => onError?.(error instanceof Error ? error.message : "大小保存失败"));
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
