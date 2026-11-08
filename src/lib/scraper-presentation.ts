import { jobField, readLiveJob } from "@/lib/scraper-contract";

export type ScraperStatusTone = "success" | "active" | "waiting" | "failure" | "neutral";

export function scraperStatus(value: unknown): { label: string; key: string; tone: ScraperStatusTone } {
  const raw = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  switch (raw.toLowerCase()) {
    case "ok": return { label: "Completed", key: "status:completed", tone: "success" };
    case "working": case "running": return { label: "In Progress", key: "status:active", tone: "active" };
    case "pending": case "queued": return { label: "Queued", key: "status:queued", tone: "waiting" };
    case "failed": case "error": return { label: "Failed", key: "status:failed", tone: "failure" };
    case "cancelled": case "canceled": return { label: "Cancelled", key: "status:cancelled", tone: "neutral" };
    default: return { label: raw || "Unknown", key: raw ? `raw:${raw}` : "absent", tone: "neutral" };
  }
}

function settingsFrom(record: Record<string, unknown>): Record<string, unknown> {
  let data = jobField(record, ["data"]);
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { return record; }
  }
  return data !== null && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : record;
}

export function formatScrapeDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(value)) return "Not available";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (year <= 1 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return "Not available";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00` : value);
  if (!Number.isFinite(date.getTime())) return "Not available";
  return dateOnly ? date.toLocaleDateString() : date.toLocaleString();
}

export function scrapeSummary(value: unknown) {
  const record = value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const job = readLiveJob(record);
  const settings = settingsFrom(record);
  const keywords = jobField(settings, ["keywords"]);
  const search = Array.isArray(keywords) ? keywords.filter((item): item is string => typeof item === "string" && !!item.trim()).join(", ") : typeof keywords === "string" ? keywords.trim() : "";
  const text = (field: string) => {
    const item = jobField(settings, [field]);
    return typeof item === "string" && item.trim() ? item : typeof item === "number" && Number.isFinite(item) ? String(item) : null;
  };
  const radius = text("radius");
  const language = text("lang");
  const optionalFields: [string, string | null][] = [
    ["Latitude", text("lat")], ["Longitude", text("lon")],
    ["Search radius", radius !== null && Number.isFinite(Number(radius)) && Number(radius) >= 0 ? `${(Number(radius) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} km` : null],
    ["Language", language === "en" ? "English" : language === "fr" ? "French" : language],
    ["Zoom", text("zoom")], ["Search depth", text("depth")],
  ];
  for (const [key, label] of [["email", "Collect email addresses"], ["fastmode", "Fast mode"]]) {
    const item = jobField(settings, [key]);
    if (typeof item === "boolean") optionalFields.push([label, item ? "Yes" : "No"]);
  }
  return { ...job, search: search || "Not available", created: formatScrapeDate(jobField(record, ["date", "createdat"])), settings: optionalFields.filter((field): field is [string, string] => field[1] !== null) };
}
