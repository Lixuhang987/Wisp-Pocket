export type FileStamp = {
  mtimeMs: number;
  size: number;
};

export function stampsEqual(left: FileStamp | null, right: FileStamp | null): boolean {
  if (!left || !right) return left === right;
  return left.mtimeMs === right.mtimeMs && left.size === right.size;
}
