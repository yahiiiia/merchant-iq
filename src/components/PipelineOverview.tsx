import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";
import { processingStages, type PipelineSummary } from "@/lib/pipeline-types";
import { Pagination, EmptyState, StatusBadge } from "@/components/CRMShared";
import QueryState from "@/components/QueryState";

type ImportedRow = { id: string; jobId: string | null; merchantId: string | null; source: string; sourceRecordId: string; stage: string; collectedAt: string | null; ingestedAt: string };
export default function PipelineOverview({ summary }: { summary?: PipelineSummary }) {
  const [stage, setStage] = useState(""), [page, setPage] = useState(1);
  const { isAdmin, session } = useSession();
  const result = useQuery({ queryKey: ["pipeline", session?.user.id, "imports", stage, page], enabled: !OFFLINE_PREVIEW && isAdmin, refetchInterval: 15000, queryFn: async () => {
    let query = supabase.from("imported_businesses").select("id,jobId,merchantId,source,sourceRecordId,stage,collectedAt,ingestedAt", { count: "exact" }).order("ingestedAt", { ascending: false }).order("id").range((page - 1) * 20, page * 20 - 1);
    if (stage) query = query.eq("stage", stage);
    const { data, error, count } = await query; if (error) throw error; return { rows: data as ImportedRow[], total: count || 0 };
  } });
  useEffect(() => { if (result.data && page > Math.max(1, Math.ceil(result.data.total / 20))) setPage(Math.max(1, Math.ceil(result.data.total / 20))); }, [result.data, page]);
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{processingStages.map((name, index) => <button key={name} onClick={() => { setStage(stage === name ? "" : name); setPage(1); }} aria-pressed={stage === name} className={`panel p-4 text-left transition-colors hover:border-primary/50 ${stage === name ? "border-primary bg-accent" : ""}`}><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">0{index + 1} · {name}</p><p className="mt-2 text-2xl font-bold tabular-nums">{summary ? (summary.stages[name] || 0).toLocaleString() : "—"}</p><p className="mt-1 text-[10px] text-muted-foreground">{["Original source payload", "Normalized, deduplicated", "Evidence-based checks", "Meets qualification rules"][index]}</p></button>)}</div>
    <p className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">Processing stages are separate from sales status. Existing CRM records are not automatically marked validated or qualified. Stage transitions and scores must be written by a trusted processing worker with evidence; no worker is started here.</p>
    <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b p-4"><h2 className="text-sm font-bold">{stage || "All"} imported businesses</h2>{stage && <button className="text-xs text-primary" onClick={() => { setStage(""); setPage(1); }}>Clear stage filter</button>}</div>
      {OFFLINE_PREVIEW ? <EmptyState title="Pipeline unavailable offline" description="No scraping jobs, processing runs, or imported results are simulated. Connect with an approved Super Admin account to read Supabase history." /> : result.error ? <QueryState error={result.error} retry={() => void result.refetch()} /> : !result.data ? <QueryState /> : <><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{["Source / external ID", "Stage", "Collection date", "Ingested", "Linked merchant"].map(label => <th key={label} className="table-head px-4">{label}</th>)}</tr></thead><tbody>{result.data.rows.map(row => <tr key={row.id} className="border-t"><td className="px-4 py-3"><p className="font-medium">{row.source}</p><p className="max-w-xs truncate font-mono text-[10px] text-muted-foreground" title={row.sourceRecordId}>{row.sourceRecordId}</p></td><td className="px-4 py-3"><StatusBadge value={row.stage} /></td><td className="whitespace-nowrap px-4 py-3">{row.collectedAt ? new Date(row.collectedAt).toLocaleString() : "Unknown"}</td><td className="whitespace-nowrap px-4 py-3">{new Date(row.ingestedAt).toLocaleString()}</td><td className="px-4 py-3 font-mono text-[10px]">{row.merchantId || "Not promoted to CRM"}</td></tr>)}</tbody></table></div>{!result.data.rows.length && <EmptyState title="No imported businesses" description="Records will appear after the trusted backend writes real scraper results to Supabase." />}<Pagination page={page} pages={Math.max(1, Math.ceil(result.data.total / 20))} total={result.data.total} pageSize={20} onPage={setPage} /></>}
    </section>
  </div>;
}
