export type {
  Workspace,
  WorkspaceSummary,
  WorkspaceRegistration,
  WorkspaceUpdate,
  WorkspaceRegistry,
} from "./types/Workspace.ts";
export {
  FileWorkspaceRegistry,
  type FileWorkspaceRegistryOptions,
} from "../adapters/filesystem/FileWorkspaceRegistry.ts";
