import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Download, Pencil, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, PageHeading, Pagination, SearchInput, StatusBadge, type Column } from "@/components/CRMShared";
import QueryState from "@/components/QueryState";
import RecordEditor from "@/components/RecordEditor";
import { useFilterOptions, useUserDirectory, formatDate, exportCSV, type RecordData } from "@/lib/crm";
import { fetchLeadExplorer, useLeadExplorer } from "@/lib/lead-workspace";
import type { LeadView } from "@/lib/pipeline-types";
import { statuses } from "@/lib/crm-fields";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";
import { errorMessage } from "@/lib/errors";
import { toast } from "sonner";

export default function LeadExplorer() {
  const [params, setParams] = useSearchParams();
  const view = (["all", "available", "mine", "due"].includes(params.get("view") || "") ? params.get("view") : "all") as LeadView;
  const [search, setSearch] = useState(""), [debounced, setDebounced] = useState(""), [filters, setFilters] = useState<Record<string, string>>({}), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25), [sort, setSort] = useState({ key: "createdAt", asc: false }), [selected, setSelected] = useState<string[]>([]), [editing, setEditing] = useState<RecordData | null>(null), [adding, setAdding] = useState(false), [exporting, setExporting] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(search), 250); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { setSelected([]); setPage(1); }, [view, debounced, filters]);
  const options = { search: debounced, filters, sort: sort.key, asc: sort.asc, page, pageSize };
  const result = useLeadExplorer(options, view), facets = useFilterOptions("merchants"), directory = useUserDirectory();
  const total = result.data?.total || 0, pages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (result.data && page > pages) setPage(pages); }, [page, pages, result.data]);
  const setFilter = (key: string, value: string) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(1); };
  const columns: Column[] = [
    { key: "merchantName", label: "Business / lead ID", render: row => <Link to={`/leads/${row.id}`} className="block min-w-[180px] max-w-[250px] text-primary"><span className="block truncate font-semibold" title={String(row.merchantName)}>{row.merchantName}</span><span title={row.id} className="mt-1 block font-mono text-[9px] text-muted-foreground">{row.id.slice(0, 8)}</span></Link> },
    { key: "industry", label: "Industry" }, { key: "contactName", label: "Contact" },
    { key: "phone", label: "Phone / email", render: row => <span className="block min-w-[140px]"><span className="block whitespace-nowrap">{row.phone || row.contactPhone || "Unknown"}</span><span className="mt-1 block text-[10px] text-muted-foreground">{row.email || row.contactEmail || "No email recorded"}</span></span> },
    { key: "city", label: "City" }, { key: "province", label: "Province" }, { key: "source", label: "Source" },
    { key: "dataQualityScore", label: "Quality / 100", render: row => <span className="tabular-nums">{row.dataQualityScore ?? "Unknown"}</span> },
    { key: "status", label: "Sales status", render: row => <StatusBadge value={row.status} /> },
    { key: "assignedName", label: "Assigned salesperson", render: row => row.assignedName || (row.assignedUser ? "Previously assigned account" : "Unassigned") },
    { key: "lastContact", label: "Last contact", render: row => formatDate(row.lastContact) },
    { key: "followUp", label: "Next follow-up", render: row => formatDate(row.followUp) },
  ];
  async function download() {
    setExporting(true);
    try {
      const records: RecordData[] = [];
      for (let exportPage = 1; ; exportPage++) {
        const batch = await fetchLeadExplorer({ ...options, filters: selected.length ? { ...filters, selectedIds: selected.join(",") } : filters, page: exportPage, pageSize: 1000 }, view);
        records.push(...batch.rows); if (!batch.rows.length || records.length >= batch.total) break;
      }
      if (selected.length && records.length !== selected.length) throw new Error("Some selected leads are no longer available. Refresh and select again.");
      exportCSV(records, ["id", "merchantName", "industry", "contactName", "phone", "contactPhone", "email", "contactEmail", "city", "province", "website", "source", "dataQualityScore", "salesPriorityScore", "status", "assignedUser", "assignedName", "lastContact", "followUp"], `MerchantIQ-${OFFLINE_PREVIEW ? "OFFLINE-TEST-" : ""}lead-explorer.csv`);
      toast.success(`Exported ${records.length} ${OFFLINE_PREVIEW ? "local test " : ""}leads`);
    } catch (e) { toast.error(errorMessage(e)); } finally { setExporting(false); }
  }
  return <>
    <PageHeading eyebrow={OFFLINE_PREVIEW ? "Local test workspace" : "Sales workspace"} title="Lead Explorer" description="Search Canadian businesses, review contact details, and manage sales follow-ups.">
      <Button variant="outline" className="h-9 bg-card text-xs" asChild><Link to="/leads/directory">Classic directory</Link></Button>
      <Button variant="outline" className="h-9 gap-2 bg-card text-xs" disabled={result.isFetching} onClick={() => void result.refetch()}><RefreshCw size={13} />Refresh</Button>
      <Button variant="outline" className="h-9 gap-2 bg-card text-xs" disabled={exporting || result.isFetching || !result.data || !!result.error || selected.length > 1000} onClick={() => void download()}><Download size={13} />{exporting ? "Exporting…" : selected.length ? `Export ${selected.length} selected` : "Export matching"}</Button>
      <Button className="h-9 gap-2 text-xs" onClick={() => setAdding(true)}><Plus size={14} />Add lead</Button>
    </PageHeading>
    <nav aria-label="Lead views" className="mb-4 flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">{[{ key: "all", label: "All leads" }, { key: "available", label: "Available" }, { key: "mine", label: "My leads" }, { key: "due", label: "Follow-ups due" }].map(tab => <button key={tab.key} aria-current={view === tab.key ? "page" : undefined} onClick={() => { setParams(tab.key === "all" ? {} : { view: tab.key }); setPage(1); }} className={`whitespace-nowrap rounded-md px-4 py-2 text-xs font-medium ${view === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{tab.label}</button>)}</nav>
    <section className="panel overflow-hidden"><div className="space-y-3 border-b p-4"><div className="flex flex-wrap items-center gap-3"><SearchInput value={search} onChange={value => { setSearch(value); setPage(1); }} placeholder="Business, contact, phone, email, website, lead ID…" /><span className="ml-auto text-[11px] text-muted-foreground">{result.data && !result.error ? `${total.toLocaleString()} matching leads` : ""}</span><select aria-label="Leads per page" className="field h-8 w-auto text-xs" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>{[10, 25, 50, 100].map(size => <option key={size} value={size}>{size} per page</option>)}</select></div><div className="flex flex-wrap gap-2">{["province", "industry", "source"].map(key => <select key={key} aria-label={`Filter by ${key}`} className="field h-8 w-auto max-w-[220px] text-xs" value={filters[key] || ""} onChange={e => setFilter(key, e.target.value)}><option value="">All {key === "province" ? "provinces" : key === "industry" ? "industries" : "sources"}</option>{facets.data?.[key]?.map(value => <option key={value}>{value}</option>)}</select>)}<select aria-label="Sales status filter" className="field h-8 w-auto text-xs" value={filters.status || ""} onChange={e => setFilter("status", e.target.value)}><option value="">All sales statuses</option>{statuses.map(status => <option key={status}>{status}</option>)}</select><select aria-label="Assigned salesperson filter" className="field h-8 w-auto text-xs" value={filters.assignedUser || ""} onChange={e => setFilter("assignedUser", e.target.value)}><option value="">All salespeople</option>{directory.data?.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select>{(search || Object.values(filters).some(Boolean)) && <button className="px-2 text-xs text-primary" onClick={() => { setSearch(""); setFilters({}); setPage(1); }}>Clear filters</button>}</div>{facets.error && <p role="alert" className="text-xs text-destructive">Filters: {errorMessage(facets.error)}</p>}{directory.error && <p role="alert" className="text-xs text-destructive">Assignment directory: {errorMessage(directory.error)}</p>}</div>
      {selected.length > 0 && <div className="flex items-center justify-between bg-accent px-4 py-2 text-xs"><span>{selected.length} selected across pages{selected.length > 1000 ? " · export up to 1,000 selected leads at a time" : ""}</span><button className="text-primary" onClick={() => setSelected([])}>Clear selection</button></div>}
      {result.error ? <QueryState error={result.error} retry={() => void result.refetch()} /> : !result.data ? <QueryState /> : <><div className="[&_td]:h-12 [&_td]:px-3 [&_td]:text-[11px] [&_th]:h-10 [&_th]:px-3"><DataTable columns={columns} rows={result.data.rows} sort={sort} onSort={key => { setSort(previous => ({ key, asc: previous.key === key ? !previous.asc : true })); setPage(1); }} selected={selected} onSelect={setSelected} actions={row => <div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit lead for ${row.merchantName}`} onClick={() => setEditing(row)}><Pencil size={12} /></Button><Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Open lead for ${row.merchantName}`} asChild><Link to={`/leads/${row.id}`}><ArrowUpRight size={13} /></Link></Button></div>} /></div><Pagination page={page} pages={pages} total={total} pageSize={pageSize} onPage={setPage} /></>}
    </section><p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">{OFFLINE_PREVIEW ? "Isolated fictional records only. My leads is empty because offline preview has no authenticated user." : "Search, filters, sorting and pagination run in PostgreSQL under database RLS. My leads uses your authenticated user ID; follow-ups due uses the current UTC date."} Quality scores stay unknown without an evidence-backed assessment. Available is a filter, not a claim operation.</p>
    {(adding || params.has("new")) && <RecordEditor entity="leads" onClose={() => { setAdding(false); const next = new URLSearchParams(params); next.delete("new"); setParams(next, { replace: true }); }} />}{editing && <RecordEditor entity="leads" record={editing} onClose={() => setEditing(null)} />}
  </>;
}
