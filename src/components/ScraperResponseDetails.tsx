import { responseJson } from "@/lib/scraper-contract";
import { scrapeSummary } from "@/lib/scraper-presentation";
import ScraperStatusBadge from "@/components/ScraperStatusBadge";

export default function ScraperResponseDetails({ value, jobId }: { value: unknown; jobId?: string | null }) {
  const job = scrapeSummary(value);
  return <div className="space-y-4">
    <dl className="grid gap-4 rounded-xl border p-4 text-xs sm:grid-cols-2">
      <div><dt className="text-[11px] text-muted-foreground">Job name</dt><dd className="mt-1 break-words font-semibold">{job.name || "Not available"}</dd></div>
      <div><dt className="mb-1 text-[11px] text-muted-foreground">Status</dt><dd><ScraperStatusBadge value={job.status} /></dd></div>
      <div><dt className="text-[11px] text-muted-foreground">Created</dt><dd className="mt-1">{job.created}</dd></div>
      <div><dt className="text-[11px] text-muted-foreground">Search</dt><dd className="mt-1 break-words">{job.search}</dd></div>
      {job.settings.map(([label, item]) => <div key={label}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{item}</dd></div>)}
    </dl>
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-xs font-semibold">Technical Details</summary>
      <dl className="mt-4 text-xs"><dt className="text-[11px] text-muted-foreground">Job ID</dt><dd className="mt-1 break-all font-mono">{job.id || jobId || "Not available"}</dd></dl>
      <p className="mb-2 mt-4 text-[11px] text-muted-foreground">Response data · sensitive fields redacted</p>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-[11px]">{responseJson(value)}</pre>
    </details>
  </div>;
}
