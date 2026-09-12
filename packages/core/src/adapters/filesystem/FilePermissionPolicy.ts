import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { stampsEqual, type FileStamp } from "../../utils/fileStamp.ts";
import type {
  PermissionDecision,
  PermissionPolicy,
  PermissionRequest,
  PermissionResolution,
  PermissionScope,
} from "../../permission/PermissionPolicy.ts";

import type { PersistedRule, PersistedFile, AskResolver, FilePermissionPolicyOptions } from "./types/PermissionFile.ts";
export type { AskResolver, FilePermissionPolicyOptions } from "./types/PermissionFile.ts";

export class FilePermissionPolicy implements PermissionPolicy {
  private readonly filePath: string;
  private readonly askResolver: AskResolver;
  private readonly now: () => string;

  private cache: PersistedRule[] | null = null;
  private cacheStamp: FileStamp | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(options: FilePermissionPolicyOptions) {
    this.filePath = options.filePath;
    this.now = options.now ?? (() => new Date().toISOString());
    this.askResolver =
      options.askResolver ?? (async () => ({ decision: "ask" as never }));
  }

  async check(request: PermissionRequest): Promise<PermissionDecision> {
    const persisted = this.loadSync().find((r) => r.toolName === request.toolName);
    if (persisted) return persisted.decision;

    return "ask";
  }

  async resolveAsk(request: PermissionRequest): Promise<PermissionResolution> {
    return this.askResolver(request);
  }

  async remember(
    request: PermissionRequest,
    resolution: PermissionResolution,
  ): Promise<void> {
    if (resolution.remember !== "always") return;
    await this.writeRules(() => {
      const rules = this.loadSync().filter((r) => r.toolName !== request.toolName);
      rules.push({ toolName: request.toolName, decision: resolution.decision, createdAt: this.now() });
      return rules;
    });
  }

  listPersistedRules(): PersistedRule[] {
    return this.loadSync().map((r) => ({ ...r }));
  }

  async revoke(toolName: string): Promise<void> {
    await this.writeRules(() => this.loadSync().filter((r) => r.toolName !== toolName));
  }

  private writeRules(update: () => PersistedRule[]): Promise<void> {
    const task = this.writing.then(() => this.persist(update()));
    this.writing = task.catch(() => {});
    return task;
  }

  private loadSync(): PersistedRule[] {
    const currentStamp = this.readFileStamp();
    if (this.cache && stampsEqual(this.cacheStamp, currentStamp)) {
      return this.cache;
    }
    if (!currentStamp) {
      this.cache = [];
      this.cacheStamp = null;
      return this.cache;
    }
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as PersistedFile;
      this.cache = parsed.version === 2 && Array.isArray(parsed.rules) ? parsed.rules.filter((rule) => typeof rule.toolName === "string" && ["allow", "deny"].includes(rule.decision) && !("argHash" in rule)) : [];
    } catch {
      this.cache = [];
    }
    this.cacheStamp = this.readFileStamp();
    return this.cache;
  }

  private async persist(rules: PersistedRule[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const data: PersistedFile = { version: 2, rules };
    const temporary = `${this.filePath}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2), "utf8");
    await rename(temporary, this.filePath);
    this.cache = rules;
    this.cacheStamp = this.readFileStamp();
  }

  private readFileStamp(): FileStamp | null {
    if (!existsSync(this.filePath)) return null;
    const info = statSync(this.filePath);
    return { mtimeMs: info.mtimeMs, size: info.size };
  }
}

export type { PersistedRule } from "./types/PermissionFile.ts";
