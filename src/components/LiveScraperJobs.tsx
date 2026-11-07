import { useEffect, useRef, useState } from "react";
import { Download, Plus, RefreshCw } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Pagination, StatusBadge } from "@/components/CRMShared";
import QueryState from "@/components/QueryState";
import ScraperLaunchDialog from "@/components/ScraperLaunchDialog";
import ScraperResponseDetails from "@/components/ScraperResponseDetails";
import { useLiveScraper } from "@/lib/scraper-jobs";
import { readLiveJobs, responseJson } from "@/lib/scraper-contract";
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
  const statuses = [...new Set(collection.jobs.flatMap(job => job.status === null ? [] : [job.status]))].sort();
  const filtered = collection.jobs.filter(job => !status || job.status === status);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  async function download(id: string) {
    if (downloadLock.current) return;
    downloadLock.current = true; setDownloading(true);
    try { await live.download(id); toast.info("Original CSV received; browser download requested."); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { downloadLock.current = false; setDownloading(false); }
  }
  function inspect(event: React.FormEvent) {
    event.preventDefault();
    const parsed = z.string().uuid().safeParse(manualId.trim());
    if (!parsed.success) { setManualError("Enter the job UUID returned by the backend."); return; }
    setManualError(""); setSelectedId(parsed.data);
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-bold">Live Gosom jobs</h2><p className="mt-1 text-xs text-muted-foreground">Authenticated requests to api.merchanthq.tech. Not Supabase draft history.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={OFFLINE_PREVIEW || live.jobs.isFetching} className="h-9 gap-2 text-xs" onClick={() => void live.jobs.refetch()}><RefreshCw size={14} />Refresh live jobs</Button><Button className="h-9 gap-2 text-xs" onClick={() => setCreating(true)}><Plus size={14} />Launch job</Button></div></div>
    <p className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">Job fields and statuses below come from the API response. No progress percentages or result counts are inferred. Original CSV availability is checked by the backend when you request a download.</p>
    {OFFLINE_PREVIEW ? <EmptyState title="Live jobs unavailable offline" description="Job submission, history and downloads require a connected, approved Super Admin. No jobs or responses are simulated." /> : <>
      {live.jobs.error && <QueryState error={live.jobs.error} retry={() => void live.jobs.refetch()} />}
      {!hasResponse && !live.jobs.error && <QueryState />}
      {hasResponse && <>
        <div className="flex flex-wrap justify-between gap-3 text-[11px] text-muted-foreground"><span>Last successful response: {new Date(live.jobs.dataUpdatedAt).toLocaleString()}{live.jobs.error ? " · refresh failed; retained response shown" : ""}</span><span>Refreshes every 15 seconds while this view is visible.</span></div>
        {collection.recognized ? <section className="panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><p className="text-xs font-semibold">{collection.jobs.length} jobs in returned collection</p><select className="field h-8 w-auto text-xs" aria-label="Filter actual backend status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All returned statuses</option>{statuses.map(value => <option key={value} value={value}>{value}</option>)}</select></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{["Name", "Job UUID", "Backend status", "Actions"].map(label => <th key={label} className="table-head px-4">{label}</th>)}</tr></thead><tbody>{filtered.slice((page - 1) * 20, page * 20).map((job, index) => <tr key={`${job.id || "response-row"}-${index}`} className="border-t hover:bg-muted/30"><td className="max-w-xs px-4 py-3"><p className="truncate font-semibold">{job.name ?? "Not reported"}</p><details className="mt-2"><summary className="cursor-pointer text-[10px] text-primary">Returned fields</summary><pre className="mt-2 max-h-64 max-w-lg overflow-auto whitespace-pre-wrap break-all text-[10px]">{responseJson(job.record)}</pre></details></td><td className="break-all px-4 py-3 font-mono text-[10px]">{job.id ?? "No valid UUID reported"}</td><td className="px-4 py-3">{job.status === null ? "Not reported" : <StatusBadge value={job.status} />}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!job.id} className="h-8 text-[11px]" onClick={() => setSelectedId(job.id)}>Details</Button><Button variant="outline" disabled={!job.id || downloading} className="h-8 gap-2 text-[11px]" onClick={() => job.id && void download(job.id)}><Download size={13} />Original CSV</Button></div></td></tr>)}</tbody></table></div>{!filtered.length && <EmptyState title="No matching jobs in the returned collection" description="Try another status filter or submit a new job. Supabase drafts are shown separately." />}<Pagination page={page} pages={pages} total={filtered.length} pageSize={20} onPage={setPage} /><p className="border-t px-4 py-3 text-[10px] text-muted-foreground">Filtering and pagination are local to the returned collection. The API specification defines no server pagination or overall total.</p></section> : <div role="alert" className="rounded-lg border border-amber-300 p-4 text-xs leading-relaxed">The API returned a response shape without a recognized job collection. This is not treated as an empty history. Inspect the raw response below; a backend job UUID can still be opened directly.</div>}
        <details className="rounded-lg border p-3" open={!collection.recognized}><summary className="cursor-pointer text-xs font-semibold">Actual list response</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-[11px]">{responseJson(live.jobs.data)}</pre></details>
      </>}
      <form className="flex flex-wrap items-end gap-2 rounded-lg border p-3" onSubmit={inspect}><div className="min-w-0 flex-1"><label htmlFor="job-uuid" className="mb-1.5 block text-[11px] font-medium">Inspect an existing backend job UUID</label><input id="job-uuid" className="field text-xs" required value={manualId} onChange={event => setManualId(event.target.value)} placeholder="UUID returned by FastAPI" /></div><Button variant="outline" className="h-9 text-xs" type="submit">Open details</Button>{manualError && <p role="alert" className="w-full text-xs text-destructive">{manualError}</p>}</form>
    </>}
    <ScraperLaunchDialog open={creating} onOpenChange={setCreating} launch={live.launch} />
    <Dialog open={!!selectedId} onOpenChange={value => !value && setSelectedId(null)}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-xl">
        <DialogHeader><DialogTitle>Live backend job details</DialogTitle><DialogDescription className="break-all font-mono text-[10px]">{selectedId}</DialogDescription></DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={OFFLINE_PREVIEW || live.details.isFetching} className="h-8 gap-2 text-xs" onClick={() => void live.details.refetch()}><RefreshCw size={13} />Refresh details</Button>
          <Button variant="outline" disabled={OFFLINE_PREVIEW || downloading} className="h-8 gap-2 text-xs" onClick={() => selectedId && void download(selectedId)}><Download size={13} />{downloading ? "Requesting file…" : "Download original CSV"}</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Actual response from /scraper/jobs/{selectedId}. Status values and other fields are preserved rather than mapped to assumed Gosom states. Download readiness is determined by FastAPI.</p>
        {live.details.error && <QueryState error={live.details.error} retry={() => void live.details.refetch()} />}
        {live.details.dataUpdatedAt > 0 ? <>
          <p className="text-[10px] text-muted-foreground">Last successful response: {new Date(live.details.dataUpdatedAt).toLocaleString()}{live.details.error ? " · retained response; refresh failed" : ""}</p>
          <ScraperResponseDetails value={live.details.data} />
        </> : !live.details.error && <QueryState />}
      </DialogContent>
    </Dialog>
  </div>;
}
