import { z } from "zod";

const coordinate = (min: number, max: number) => z.string().trim().min(1, "Coordinates are required.").refine(value => Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max, `Enter a coordinate between ${min} and ${max}.`);

// FastAPI accepts seconds; its Gosom forwarding conversion belongs to the backend.
export const scraperCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  keywords: z.array(z.string().trim().min(1)).min(1).max(5),
  lang: z.string().trim().min(1),
  zoom: z.number().int().min(1).max(21),
  lat: coordinate(-90, 90),
  lon: coordinate(-180, 180),
  fast_mode: z.boolean(),
  radius: z.number().int().min(100).max(Number.MAX_SAFE_INTEGER),
  depth: z.number().int().min(1).max(10),
  email: z.boolean(),
  max_time: z.number().int().min(30).max(3600),
  proxies: z.array(z.string()).optional(),
}).strict();
export type ScraperCreateInput = z.infer<typeof scraperCreateSchema>;

// openapi.json declares {} for every successful response. Do not invent a
// response DTO, status enum, progress counter, or pagination contract.
export const scraperResponseSchema = z.unknown();
export type LiveJob = { record: Record<string, unknown>; id: string | null; name: string | null; status: string | null };
const recordSchema = z.record(z.unknown());
const uuid = z.string().uuid();

export function jobField(record: Record<string, unknown>, names: string[]): unknown {
  const key = Object.keys(record).find(key => names.includes(key.replace(/_/g, "").toLowerCase()));
  return key === undefined ? undefined : record[key];
}
export function readLiveJob(value: unknown): LiveJob {
  const record = recordSchema.parse(value);
  const rawId = jobField(record, ["id", "jobid"]);
  const name = jobField(record, ["name"]);
  const status = jobField(record, ["status"]);
  return { record, id: uuid.safeParse(rawId).success ? String(rawId) : null, name: typeof name === "string" ? name : null, status: (typeof status === "string" && status.length > 0) || typeof status === "number" ? String(status) : null };
}

export function readLiveJobs(value: unknown): { jobs: LiveJob[]; recognized: boolean } {
  let rows: unknown = value;
  if (!Array.isArray(rows)) {
    const parsed = recordSchema.safeParse(rows);
    if (!parsed.success) return { jobs: [], recognized: false };
    // Recognize collection fields only when actually present. Other envelopes
    // remain visible as raw responses, never silently presented as zero jobs.
    rows = parsed.data.jobs ?? parsed.data.data;
  }
  const parsed = z.array(recordSchema).safeParse(rows);
  return parsed.success ? { jobs: parsed.data.map(readLiveJob), recognized: true } : { jobs: [], recognized: false };
}

export function responseJson(value: unknown): string {
  return JSON.stringify(value, (key, item: unknown) => /^(proxies|authorization|access_token|refresh_token|password|secret)$/i.test(key) ? "[redacted]" : item, 2) ?? "null";
}
