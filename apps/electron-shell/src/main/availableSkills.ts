import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type AvailableSkill = {
  actionId: string;
  title: string;
  prompt: string;
  description?: string;
};

type ActionManifestDefinition = {
  version: number;
  id: string;
  title: string;
  description?: string;
  enabled?: boolean;
  prompts: Array<{
    name: string;
    trigger: string;
    title: string;
    description?: string;
    template: string;
  }>;
};

export function readAvailableSkillsFromActionsDirectory(actionsDirectoryURL: string): AvailableSkill[] {
  try {
    const directories = readdirSync(actionsDirectoryURL, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(actionsDirectoryURL, entry.name))
      .sort((a, b) => a.localeCompare(b));

    const skills: AvailableSkill[] = [];
    for (const directory of directories) {
      const actionPackageId = directory.split("/").pop() ?? directory;
      const manifestURL = join(directory, "action.json");
      if (!isReadableFile(manifestURL)) {
        continue;
      }

      const manifest = JSON.parse(readFileSync(manifestURL, "utf8")) as ActionManifestDefinition;
      if (manifest.version !== 1 || manifest.id !== actionPackageId || manifest.enabled === false) {
        continue;
      }

      for (const prompt of manifest.prompts ?? []) {
        skills.push({
          actionId: `${manifest.id}/${prompt.name}`,
          title: prompt.title,
          prompt: prompt.template,
          ...(prompt.description ? { description: prompt.description } : {}),
        });
      }
    }
    return skills;
  } catch {
    return [];
  }
}

function isReadableFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
