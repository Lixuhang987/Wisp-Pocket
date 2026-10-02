import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { decodeImage } from "./ReadImage.ts";

const id = z.string().refine((value) => value.trim().length > 0 && value !== "." && value !== ".." && !/[\\/]/.test(value));
const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const strings = z.record(z.string(), z.string());
const sampleSchema = z.object({ id, timestamp, app: strings, window: strings, axSummaryId: id.nullish(), thumbnailId: id.nullish() });
const screenshotSchema = z.object({ id, timestamp, originalPath: z.string().min(1), thumbnailPath: z.string().min(1), width: z.number().int().positive().max(32768), height: z.number().int().positive().max(32768), sampleId: id.nullish() });
type Sample = z.infer<typeof sampleSchema>;
type Screenshot = z.infer<typeof screenshotSchema>;
export type HistoryDate = number | string;

/** Reads the Swift atomic-file format; never triggers collection or guesses its live state. */
export class ContextHistoryReader {
  constructor(private readonly root: string) {}

  async activityIndex(limit: number) {
    const samples = await this.activities();
    return { samples: newest(samples).slice(0, limit).map(({ axSummaryId: _ax, ...sample }) => ({ ...sample, thumbnailId: sample.thumbnailId ?? null })) };
  }

  async sampleDetails(ids: string[]) {
    const samples = await this.activities();
    return { samples: await Promise.all(ids.map(async (id) => {
      const sample = samples.find((sample) => sample.id === id);
      if (!sample) throw new Error(`not_found: Activity Sample ${id}`);
      if (!sample.axSummaryId) throw new Error(`missing_evidence: Activity Sample ${id} has no AX evidence`);
      const ax = await jsonFile(join(this.root, "ax", `${sample.axSummaryId}.json`));
      validateAX(ax, sample);
      const { axSummaryId: _ax, ...summary } = sample;
      return { ...summary, thumbnailId: sample.thumbnailId ?? null, axSummary: ax };
    })) };
  }

  async thumbnails(limit: number, start?: HistoryDate, end?: HistoryDate) {
    const lower = parseDate(start); const upper = parseDate(end);
    if (lower !== undefined && upper !== undefined && lower > upper) throw new Error("invalid_arguments: start must not follow end");
    const screenshots = await this.screenshots();
    // Read samples after screenshots: a newly published screenshot cannot depend on a future sample.
    const samples = await this.activities();
    const selected = newest(screenshots).filter((shot) => (lower === undefined || Date.parse(shot.timestamp) >= lower) && (upper === undefined || Date.parse(shot.timestamp) <= upper)).slice(0, limit);
    return this.imageResult(selected, samples, false);
  }

  async screenshotOriginal(id: string) {
    const screenshots = await this.screenshots();
    const record = screenshots.find((shot) => shot.id === id);
    if (!record) throw new Error(`not_found: screenshot ${id}`);
    return this.imageResult([record], await this.activities(), true);
  }

  private async imageResult(records: Screenshot[], samples: Sample[], original: boolean) {
    const images = await Promise.all(records.map(async (record) => {
      if (record.sampleId && !samples.some((sample) => sample.id === record.sampleId)) throw new Error(`missing_evidence: screenshot ${record.id} references missing sample ${record.sampleId}`);
      const path = original ? record.originalPath : record.thumbnailPath;
      const encoded = await readFile(path, "utf8");
      if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error(`invalid_image: invalid base64 at ${path}`);
      const bytes = Buffer.from(encoded, "base64");
      if (bytes.toString("base64") !== encoded) throw new Error(`invalid_image: non-canonical base64 at ${path}`);
      const image = await decodeImage(bytes, "image/png");
      if (original ? image.width !== record.width || image.height !== record.height : image.width > record.width || image.height > record.height) throw new Error(`invalid_image: screenshot ${record.id} dimensions disagree with evidence`);
      return { record, image, encoded };
    }));
    const metadata = images.map(({ record, image }, index) => ({ id: record.id, timestamp: record.timestamp, sampleId: record.sampleId ?? null, mimeType: image.mimeType, dimensions: { width: image.width, height: image.height }, imageContentIndex: index + 1 }));
    return { success: true, contentItems: [
      { type: "inputText", text: JSON.stringify(original ? { screenshot: metadata[0] } : { thumbnails: metadata }) },
      ...images.map(({ encoded }) => ({ type: "inputImage", imageUrl: `data:image/png;base64,${encoded}` })),
    ] };
  }

  private async activities(): Promise<Sample[]> {
    return readIndex(join(this.root, "activities.json"), sampleSchema);
  }
  private async screenshots(): Promise<Screenshot[]> {
    return readIndex(join(this.root, "screenshots.json"), screenshotSchema);
  }
}

async function jsonFile(path: string): Promise<unknown> {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { throw new Error(`read_failed: ${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
}
async function readIndex<T extends { id: string }>(path: string, schema: z.ZodType<T>): Promise<T[]> {
  let json: unknown;
  try { json = JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error(`read_failed: ${path}: ${String(error)}`);
  }
  const result = schema.array().safeParse(json);
  if (!result.success) throw new Error(`invalid_data: ${path}: ${result.error.message}`);
  if (new Set(result.data.map((item) => item.id)).size !== result.data.length) throw new Error(`invalid_data: duplicate record id in ${path}`);
  return result.data;
}
function newest<T extends { timestamp: string }>(rows: T[]): T[] { return rows.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)); }
function parseDate(value?: HistoryDate): number | undefined {
  if (value === undefined) return undefined;
  const date = typeof value === "number" ? value * 1000 : Date.parse(value);
  if (!Number.isFinite(date)) throw new Error("invalid_arguments: expected ISO8601 timestamp or epoch seconds");
  return date;
}
function object(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function validateAX(value: unknown, sample: Sample): void {
  if (!object(value)) throw new Error("invalid_data: AX evidence must be an object");
  const root = value.root === undefined ? value : value.root;
  if (!object(root) || typeof root.role !== "string" || !/^AX\S+$/.test(root.role) || (root.children !== undefined && (!Array.isArray(root.children) || !root.children.every(object)))) throw new Error("invalid_data: AX evidence requires an AX root");
  if (value.app !== undefined || value.window !== undefined) {
    if (!object(value.app) || !object(value.window)) throw new Error("missing_evidence: AX target is incomplete");
    const target = (app: Record<string, unknown>, window: Record<string, unknown>) => {
      const pid = Number(app.pid); const windowId = Object.keys(window).length ? Number(window.id) : undefined;
      if (!Number.isInteger(pid) || pid <= 0 || (windowId !== undefined && (!Number.isInteger(windowId) || windowId <= 0)) || (window.ownerPid !== undefined && Number(window.ownerPid) !== pid)) throw new Error("missing_evidence: invalid AX target");
      return [pid, windowId, String(window.title ?? "")];
    };
    if (JSON.stringify(target(sample.app, sample.window)) !== JSON.stringify(target(value.app, value.window))) throw new Error("context_changed: AX evidence does not match Activity Sample target");
  }
}
