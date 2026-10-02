import type { PermissionResolution } from "../../permission/PermissionPolicy.ts";
export type PermissionPending = {
  resolve: (value: PermissionResolution) => void;
  timer: ReturnType<typeof setTimeout>;
};
