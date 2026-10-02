import { lstat, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { isNotFoundError } from "../../utils/nodeErrors.ts";

export function requirePetRoot(rootPath?: string): string {
  if (!rootPath || !isAbsolute(rootPath)) throw new Error("Thread Pet rootPath is required");
  return rootPath;
}

function ensureInside(root: string, target: string): void {
  const path = relative(root, target);
  if (isAbsolute(path) || path.split(sep).includes("..")) throw new Error(`Path escapes Pet root: ${target}`);
}

// Resolve the nearest existing ancestor, including symlinks before missing directories.
async function resolveAncestor(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (error) {
    if (!isNotFoundError(error)) throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(await resolveAncestor(parent), basename(path));
  }
}

export async function resolvePetWritePath(rootPath: string, relativePath: string): Promise<string> {
  if (isAbsolute(relativePath)) throw new Error("relativePath must not be absolute");
  if (!relativePath.trim() || relativePath.split(/[\\/]/).includes("..")) throw new Error("Path escapes Pet root or is empty");
  const root = await realpath(requirePetRoot(rootPath));
  const target = resolve(root, relativePath);
  ensureInside(root, target);
  if (target === root) throw new Error("Write target must be a file");
  const parent = await resolveAncestor(dirname(target));
  ensureInside(root, parent);
  const resolved = join(parent, basename(target));
  try {
    if ((await lstat(resolved)).isSymbolicLink()) throw new Error(`Refuse to write through symlink at target: ${relativePath}`);
    // realpath also unifies existing case aliases on case-insensitive volumes.
    const canonical = await realpath(resolved);
    ensureInside(root, canonical);
    return canonical;
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    return resolved;
  }
}
