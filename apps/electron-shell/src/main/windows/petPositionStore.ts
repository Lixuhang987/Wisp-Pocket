import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// 角色右下角的屏幕 DIP 坐标，不随气泡展开高度改变。
export type PetPosition = { right: number; bottom: number; display?: { id: string; x: number; y: number } };

export class PetPositionStore {
  constructor(
    private readonly filePath: string,
    private readonly onError: (error: unknown) => void = () => {},
  ) {}

  load(): PetPosition | null {
    try {
      const value = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<PetPosition> | null;
      if (value && Number.isFinite(value.right) && Number.isFinite(value.bottom)) {
        return { right: value.right!, bottom: value.bottom!, ...(value.display && typeof value.display.id === "string" && Number.isFinite(value.display.x) && Number.isFinite(value.display.y) ? {display:value.display} : {}) };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") this.onError(error);
    }
    return null;
  }

  save(position: PetPosition): void {
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    try {
      mkdirSync(dirname(this.filePath), { recursive: true, mode: 0o700 });
      writeFileSync(temporaryPath, JSON.stringify(position), { mode: 0o600 });
      renameSync(temporaryPath, this.filePath);
    } catch (error) {
      this.onError(error);
    } finally {
      try { rmSync(temporaryPath, { force: true }); } catch { /* 位置不可写不妨碍窗口交互。 */ }
    }
  }
}
