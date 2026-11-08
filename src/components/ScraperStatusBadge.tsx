import { scraperStatus, type ScraperStatusTone } from "@/lib/scraper-presentation";

const tones: Record<ScraperStatusTone, string> = {
  success: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  active: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  waiting: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  failure: "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  neutral: "bg-muted text-muted-foreground",
};

export default function ScraperStatusBadge({ value }: { value: unknown }) {
  const status = scraperStatus(value);
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium ${tones[status.tone]}`}>
    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
    <span className="break-words">{status.label}</span>
  </span>;
}
