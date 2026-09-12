import { useEffect, useState } from "react";
import spriteURL from "./assets/yachiyo.webp";

// hatch-pet/references/animation-rows.md: 8 × 9 atlas, 192 × 208 cells.
const animations = {
  idle: { row: 0, durations: [280, 110, 110, 140, 140, 320] },
  moving: { row: 1, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  failed: { row: 5, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
  waiting: { row: 6, durations: [150, 150, 150, 150, 150, 260] },
  running: { row: 7, durations: [120, 120, 120, 120, 120, 220] },
} as const;

export function PetSprite({ state }: { state: keyof typeof animations }) {
  const [frame, setFrame] = useState({ row: 0, column: 0 });
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    const play = () => {
      clearTimeout(timer);
      if (reducedMotion.matches) { setFrame({ row: 0, column: 0 }); return; }
      const animation = animations[state];
      let column = 0;
      const tick = () => {
        setFrame({ row: animation.row, column });
        const duration = animation.durations[column];
        column = (column + 1) % animation.durations.length;
        timer = setTimeout(tick, duration);
      };
      tick();
    };
    play();
    reducedMotion.addEventListener("change", play);
    return () => { clearTimeout(timer); reducedMotion.removeEventListener("change", play); };
  }, [state]);
  return <span aria-hidden="true" className="pet-sprite" style={{ backgroundImage: `url(${spriteURL})`, backgroundPosition: `${-frame.column * 192}px ${-frame.row * 208}px` }} />;
}
