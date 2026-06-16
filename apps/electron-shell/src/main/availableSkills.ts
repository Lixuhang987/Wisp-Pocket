import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type AvailableSkill = {
  actionId: string;
  title: string;
  prompt: string;
  description?: string;
};

type PluginManifestDefinition = {
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

export function readAvailableSkillsFromPluginsDirectory(pluginsDirectoryURL: string): AvailableSkill[] {
  try {
    const directories = readdirSync(pluginsDirectoryURL, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(pluginsDirectoryURL, entry.name))
      .sort((a, b) => a.localeCompare(b));

    const skills: AvailableSkill[] = [];
    for (const directory of directories) {
      const pluginId = directory.split("/").pop() ?? directory;
      const manifestURL = join(directory, "plugin.json");
      if (!isReadableFile(manifestURL)) {
        continue;
      }

      const manifest = JSON.parse(readFileSync(manifestURL, "utf8")) as PluginManifestDefinition;
      if (manifest.version !== 1 || manifest.id !== pluginId || manifest.enabled === false) {
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
