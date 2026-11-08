import { useEffect, useRef, useState } from "react";
import { Download, Plus, RefreshCw } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Pagination } from "@/components/CRMShared";
import QueryState from "@/components/QueryState";
import ScraperLaunchDialog from "@/components/ScraperLaunchDialog";
import ScraperResponseDetails from "@/components/ScraperResponseDetails";
import ScraperStatusBadge from "@/components/ScraperStatusBadge";
import { useLiveScraper } from "@/lib/scraper-jobs";
import { readLiveJobs, responseJson } from "@/lib/scraper-contract";
import { scrapeSummary, scraperStatus } from "@/lib/scraper-presentation";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";
import { errorMessage } from "@/lib/errors";
import { toast } from "sonner";

export default function LiveScraperJobs() {
  const [creating, setCreating] = useState(false), [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualId, setManualId] = useState(""), [manualError, setManualError] = useState("");
  const [page, setPage] = useState(1), [status, setStatus] = useState(""), [downloading, setDownloading] = useState(false);
  const downloadLock = useRef(false);
  const live = useLiveScraper(selectedId);
  const hasResponse = live.jobs.dataUpdatedAt > 0;
  const collection = readLiveJobs(live.jobs.data);
  const jobs = collection.jobs.map(job => scrapeSummary(job.record));
  const statuses = [...new Map(jobs.map(job => {
    const presentation = scraperStatus(job.status);
    return [presentation.key, presentation] as const;
  })).values()].sort((a, b) => a.label.localeCompare(b.label));
  const filtered = jobs.filter(job => !status || scraperStatus(job.status).key === status);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  async function download(id: string) {
    if (downloadLock.current) return;
    downloadLock.current = true; setDownloading(true);
    try { await live.download(id); toast.info("Results download requested."); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { downloadLock.current = false; setDownloading(false); }
  }
  function inspect(event: React.FormEvent) {
    event.preventDefault();
    const parsed = z.string().uuid().safeParse(manualId.trim());
    if (!parsed.success) { setManualError("Enter a valid job ID."); return; }
    setManualError(""); setSelectedId(parsed.data);
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-bold">Scraping Jobs</h2><p className="mt-1 text-xs text-muted-foreground">Find businesses on Google Maps and download your results.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={OFFLINE_PREVIEW || live.jobs.isFetching} className="h-9 gap-2 text-xs" onClick={() => void live.jobs.refetch()}><RefreshCw size={14} />Refresh</Button>
        <Button className="h-9 gap-2 text-xs" onClick={() => setCreating(true)}><Plus size={14} />New Scrape</Button>
      </div>
    </div>
    {OFFLINE_PREVIEW ? <EmptyState title="Scraping is unavailable offline" description="Sign in with an approved administrator account to start a scrape or view results." /> : <>
      {live.jobs.error && <QueryState error={live.jobs.error} retry={() => void live.jobs.refetch()} />}
      {!hasResponse && !live.jobs.error && <QueryState />}
      {hasResponse && <>
        <div className="flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
          <span>Updated {new Date(live.jobs.dataUpdatedAt).toLocaleString()}{live.jobs.error ? " · refresh failed; showing the last available jobs" : ""}</span>
          <span>Auto-refresh every 15 seconds</span>
        </div>
        {collection.recognized ? <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <p className="text-xs font-semibold">{jobs.length} scraping {jobs.length === 1 ? "job" : "jobs"}</p>
            <select className="field h-8 w-auto text-xs" aria-label="Filter scraping jobs by status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All statuses</option>{statuses.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr>{["Job name", "Search", "Created", "Status", "Actions"].map(label => <th key={label} scope="col" className="table-head px-4">{label}</th>)}</tr></thead>
            <tbody>{filtered.slice((page - 1) * 20, page * 20).map((job, index) => <tr key={`${job.id || "job"}-${index}`} className="border-t hover:bg-muted/30">
              <td className="max-w-xs px-4 py-3 font-semibold"><span className="block truncate" title={job.name || undefined}>{job.name || "Not available"}</span></td>
              <td className="max-w-xs px-4 py-3"><span className="block truncate" title={job.search}>{job.search}</span></td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{job.created}</td>
              <td className="px-4 py-3"><ScraperStatusBadge value={job.status} /></td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={!job.id} title={!job.id ? "A valid job ID is unavailable." : undefined} aria-label={`Details for ${job.name || "scraping job"}`} className="h-8 text-[11px]" onClick={() => setSelectedId(job.id)}>Details</Button>
                <Button variant="outline" disabled={!job.id || downloading} aria-label={`Download Results for ${job.name || "scraping job"}`} className="h-8 gap-2 text-[11px]" onClick={() => job.id && void download(job.id)}><Download size={13} />Download Results</Button>
              </div></td>
            </tr>)}</tbody>
          </table></div>
          {!filtered.length && <EmptyState title={status ? "No jobs match this status" : "No scraping jobs yet"} description={status ? "Choose another status to see more jobs." : "Start a new scrape to find businesses in your target area."} />}
          <Pagination page={page} pages={pages} total={filtered.length} pageSize={20} onPage={setPage} />
        </section> : <div role="alert" className="rounded-lg border border-amber-300 p-4 text-xs leading-relaxed">We couldn’t display the jobs received. Try refreshing or contact your administrator.</div>}
      </>}
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Technical Details</summary>
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={inspect}>
          <div className="min-w-0 flex-1"><label htmlFor="job-id" className="mb-1.5 block text-[11px] font-medium">Find a job by ID</label><input id="job-id" className="field text-xs" required value={manualId} onChange={event => setManualId(event.target.value)} placeholder="Enter a job ID" /></div>
          <Button variant="outline" className="h-9 text-xs" type="submit">Open Details</Button>
          {manualError && <p role="alert" className="w-full text-xs text-destructive">{manualError}</p>}
        </form>
        {hasResponse && !collection.recognized && <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-all text-[11px]">{responseJson(live.jobs.data)}</pre>}
      </details>
    </>}
    <ScraperLaunchDialog open={creating} onOpenChange={setCreating} launch={live.launch} />
    <Dialog open={!!selectedId} onOpenChange={value => !value && setSelectedId(null)}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-xl">
        <DialogHeader><DialogTitle>Scraping Details</DialogTitle><DialogDescription className="text-xs">Review the search settings and latest status for this scrape.</DialogDescription></DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={OFFLINE_PREVIEW || live.details.isFetching} className="h-8 gap-2 text-xs" onClick={() => void live.details.refetch()}><RefreshCw size={13} />Refresh</Button>
          <Button variant="outline" disabled={OFFLINE_PREVIEW || downloading} className="h-8 gap-2 text-xs" onClick={() => selectedId && void download(selectedId)}><Download size={13} />{downloading ? "Downloading…" : "Download Results"}</Button>
        </div>
        {live.details.error && <QueryState error={live.details.error} retry={() => void live.details.refetch()} />}
        {live.details.dataUpdatedAt > 0 ? <>
          <p className="text-[11px] text-muted-foreground">Updated {new Date(live.details.dataUpdatedAt).toLocaleString()}{live.details.error ? " · refresh failed; showing the last available details" : ""}</p>
          <ScraperResponseDetails value={live.details.data} jobId={selectedId} />
        </> : !live.details.error && <QueryState />}
      </DialogContent>
    </Dialog>
  </div>;
}
