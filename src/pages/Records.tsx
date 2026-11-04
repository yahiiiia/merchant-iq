import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Download, Upload, SlidersHorizontal, X, ArrowUpRight, Copy, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeading, SearchInput, DataTable, Pagination, StatusBadge, MerchantName, RecordAvatar, type Column } from "@/components/CRMShared";
import RecordEditor from "@/components/RecordEditor";
import ImportMerchants from "@/components/ImportMerchants";
import RecordPicker from "@/components/RecordPicker";
import QueryState from "@/components/QueryState";
import { useCRM, useRecords, useFilterOptions, useDashboard, useUserDirectory, isDuplicate, formatDate, exportCSV, exportRecords, fieldsFor, type Entity, type RecordData, statuses } from "@/lib/crm";
import { useSession } from "@/components/SessionProvider";
import { errorMessage } from "@/lib/errors";
import { toast } from "sonner";

export default function Records({ entity }: { entity: Entity }) {
  const crm = useCRM(), { isAdmin } = useSession();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(""), [debounced, setDebounced] = useState(""), [filters, setFilters] = useState<Record<string, string>>({}), [sort, setSort] = useState({ key: "createdAt", asc: false }), [page, setPage] = useState(1), [selected, setSelected] = useState<string[]>([]), [editing, setEditing] = useState<RecordData | null>(null), [adding, setAdding] = useState(false), [importing, setImporting] = useState(false), [deleting, setDeleting] = useState<string[]>([]), [pageSize, setPageSize] = useState(10), [busy, setBusy] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(search), 250); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { setSelected([]); }, [debounced, filters]);
  const options = { search: debounced, filters, sort: sort.key, asc: sort.asc, page, pageSize };
  const result = useRecords(entity, options), facet = useFilterOptions(entity), dashboard = useDashboard(), directory = useUserDirectory();
  const rows = result.data?.rows || [], total = result.data?.total || 0, totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (result.data && page > totalPages) setPage(totalPages); }, [page, totalPages, result.data]);
  const singular = entity === "merchants" ? "merchant" : entity === "contacts" ? "contact" : "lead";
  const title = entity[0].toUpperCase() + entity.slice(1);
  const displayName = (r: RecordData) => String(entity === "leads" ? r.merchantName || "" : r.name || "");
  const assignee = (id: unknown) => directory.data?.find(u => u.id === id)?.name || (id ? "Previously assigned account" : "Unassigned");
  const filterDefinitions = entity === "merchants" ? [{ key: "province", label: "Province" }, { key: "city", label: "City" }, { key: "industry", label: "Industry" }, { key: "source", label: "Source" }, { key: "status", label: "Status" }] : entity === "contacts" ? [{ key: "type", label: "Contact type" }] : [{ key: "status", label: "Status" }, { key: "priority", label: "Priority" }];
  const columns: Column[] = entity === "merchants" ? [
    { key: "name", label: "Business name", render: r => <div className="flex items-center gap-2"><MerchantName record={r} />{isDuplicate(r) && <span title="Possible duplicate: matching name, phone, email, or website" className="text-amber-700"><Copy size={13} /><span className="sr-only">Possible duplicate</span></span>}</div> },
    { key: "industry", label: "Industry", render: r => <span className="whitespace-nowrap text-muted-foreground">{r.industry || "—"}</span> },
    { key: "city", label: "Location", render: r => <span className="whitespace-nowrap"><span className="block">{r.city || "—"}</span><span className="mt-1 block text-[10px] text-muted-foreground">{r.province || "—"}</span></span> },
    { key: "phone", label: "Contact details", render: r => <span className="whitespace-nowrap"><span className="block">{r.phone || "No phone"}</span><span className="mt-1 block text-[10px] text-muted-foreground">{r.email || "No email"}</span></span> },
    { key: "source", label: "Source", render: r => <span className="whitespace-nowrap rounded-md border px-2 py-1 text-[10px] text-muted-foreground">{r.source || "Unknown"}</span> },
    { key: "status", label: "Status", render: r => <StatusBadge value={r.status} /> },
  ] : entity === "contacts" ? [
    { key: "name", label: "Contact", render: r => <Link to={`/contacts/${r.id}`} className="flex min-w-[150px] items-center gap-3 hover:text-primary"><RecordAvatar name={String(r.name)} /><span><span className="block font-semibold">{r.name}</span><span className="mt-1 block text-[10px] text-muted-foreground">{r.title || "No title"}</span></span></Link> },
    { key: "merchantId", label: "Merchant", render: r => <Link className="whitespace-nowrap hover:text-primary" to={`/merchants/${r.merchantId}`}>{r.merchantName || "—"}</Link> },
    { key: "type", label: "Type", render: r => <StatusBadge value={r.type} /> }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "updatedAt", label: "Last updated", render: r => <span className="whitespace-nowrap text-muted-foreground">{formatDate(r.updatedAt)}</span> },
  ] : [
    { key: "merchantId", label: "Merchant", render: r => <Link to={`/leads/${r.id}`} className="flex min-w-[180px] items-center gap-3 hover:text-primary"><RecordAvatar name={displayName(r)} /><span className="font-semibold">{displayName(r)}</span></Link> },
    { key: "contactId", label: "Primary contact", render: r => r.contactName || "—" },
    { key: "status", label: "Status", render: r => <StatusBadge value={r.status} /> },
    { key: "priority", label: "Priority", render: r => <StatusBadge value={r.priority} /> }, { key: "assignedUser", label: "Assigned to", render: r => assignee(r.assignedUser) },
    { key: "followUp", label: "Follow-up", render: r => <span className="whitespace-nowrap text-muted-foreground">{formatDate(r.followUp)}</span> },
  ];
  async function doExport() {
    setBusy(true);
    try {
      const records = await exportRecords(entity, options, selected);
      exportCSV(records, ["id", ...fieldsFor(entity).map(f => f.key), "createdAt", "updatedAt", "ingestedAt"], `MerchantIQ-${entity}.csv`);
      toast.success(`Exported ${records.length} records`);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }
  async function confirmDelete() {
    setBusy(true);
    try { await crm.remove(entity, deleting); setSelected([]); setDeleting([]); toast.success("Records deleted"); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }
  const hasFilters = search || Object.values(filters).some(Boolean);
  const setFilter = (key: string, value: string) => { setFilters(p => ({ ...p, [key]: value })); setPage(1); };
  const closeEditor = () => { setAdding(false); setEditing(null); if (params.has("new")) setParams({}, { replace: true }); };
  return <>
    <PageHeading title={title} description={entity === "merchants" ? "Your business directory. Organized, searchable, and ready for the next conversation." : entity === "contacts" ? "The people behind your merchants, all in one place." : "Simple follow-ups. Meaningful business relationships."} eyebrow="Business directory"><Button variant="outline" disabled={busy || result.isFetching} className="h-9 gap-2 bg-card text-[11px]" onClick={() => void doExport()}><Download size={14} />{busy ? "Please wait…" : "Export CSV"}</Button>{entity === "merchants" && isAdmin && <Button variant="outline" className="h-9 gap-2 bg-card text-[11px]" onClick={() => setImporting(true)}><Upload size={14} />Import</Button>}<Button className="h-9 gap-2 text-[11px]" onClick={() => setAdding(true)}><Plus size={15} />Add {singular}</Button></PageHeading>
    {entity === "leads" && dashboard.data && <div className="mb-5 grid grid-cols-3 gap-2 md:grid-cols-6">{statuses.map(status => <button key={status} onClick={() => setFilter("status", filters.status === status ? "" : status)} className={`panel px-4 py-3 text-left ${filters.status === status ? "border-primary bg-accent" : "hover:border-primary/40"}`}><span className="text-[10px] text-muted-foreground">{status}</span><span className="mt-1 block text-xl font-semibold">{dashboard.data.leadCounts[status] || 0}</span></button>)}</div>}
    <section className="panel overflow-hidden"><div className="flex items-center justify-between gap-3 border-b px-5 py-4"><div className="flex items-center gap-2"><h2 className="text-[13px] font-bold">All {entity}</h2>{result.data && <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{total}</span>}</div><span className="text-[10px] text-muted-foreground">Server-side directory</span></div>
      <div className="space-y-3 p-4"><div className="flex flex-wrap items-center gap-2"><SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder={entity === "merchants" ? "Search name, phone, email, website..." : `Search ${entity} or merchants...`} /><span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground"><SlidersHorizontal size={13} />Filters</span><select aria-label="Records per page" className="field h-9 w-auto text-[11px]" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}><option value={10}>10 per page</option><option value={25}>25 per page</option><option value={50}>50 per page</option></select></div><div className="flex flex-wrap items-center gap-2">{filterDefinitions.map(f => <select aria-label={`Filter by ${f.label}`} key={f.key} className="field h-8 w-auto max-w-[210px] text-[11px]" value={filters[f.key] || ""} onChange={e => setFilter(f.key, e.target.value)}><option value="">All {f.label.toLowerCase()}</option>{facet.data?.[f.key]?.map(v => <option key={v} value={v}>{v}</option>)}</select>)}{entity === "leads" && <select aria-label="Filter by assigned user" className="field h-8 w-auto text-[11px]" value={filters.assignedUser || ""} onChange={e => setFilter("assignedUser", e.target.value)}><option value="">All assignees</option>{directory.data?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}{hasFilters && <button className="flex items-center gap-1 text-[11px] text-primary" onClick={() => { setSearch(""); setFilters({}); setPage(1); }}><X size={12} />Reset</button>}</div>{entity !== "merchants" && <div className="max-w-sm"><label htmlFor="filter-merchant" className="mb-2 block text-[10px] text-muted-foreground">Filter by associated merchant</label><RecordPicker id="filter-merchant" value={filters.merchantId || ""} onChange={v => setFilter("merchantId", v)} /></div>}{facet.error && <p className="text-[11px] text-destructive">Filter options: {errorMessage(facet.error)}</p>}</div>
      {selected.length > 0 && <div className="flex flex-wrap items-center gap-3 border-t bg-accent/50 px-5 py-2 text-[11px]"><span className="font-medium">{selected.length} selected</span><button className="text-primary" disabled={busy} onClick={() => void doExport()}>Export selected records</button>{isAdmin && <button className="text-destructive" disabled={busy} onClick={() => setDeleting(selected)}>Delete selected</button>}<button className="ml-auto text-muted-foreground" onClick={() => setSelected([])}>Clear</button></div>}
      {result.error ? <QueryState error={result.error} retry={() => void result.refetch()} /> : result.isPending ? <QueryState /> : <><DataTable columns={columns} rows={rows} sort={sort} onSort={key => { setSort(p => ({ key, asc: p.key === key ? !p.asc : true })); setPage(1); }} selected={selected} onSelect={setSelected} actions={r => <div className="flex items-center justify-end gap-1"><Button title="Edit record" aria-label={`Edit ${displayName(r)}`} size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditing(r)}><Pencil size={13} /></Button><Button title="Open details" aria-label={`View ${displayName(r)}`} size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" asChild><Link to={`/${entity}/${r.id}`}><ArrowUpRight size={14} /></Link></Button></div>} /><Pagination page={page} pages={totalPages} total={total} pageSize={pageSize} onPage={setPage} /></>}
    </section><p className="mt-4 text-[10px] text-muted-foreground">{entity === "merchants" ? "Possible duplicates are checked across the database using name, phone, email, or website. Unknown processing volumes remain blank." : "Each record references an existing merchant. Business information is not duplicated."} Exports contain selected records or all matching filtered records.</p>
    {(adding || editing || params.has("new")) && <RecordEditor entity={entity} record={editing || undefined} onClose={closeEditor} />}{importing && isAdmin && <ImportMerchants onClose={() => setImporting(false)} />}
    <AlertDialog open={deleting.length > 0} onOpenChange={v => !v && !busy && setDeleting([])}><AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle>Delete {deleting.length} {singular}{deleting.length === 1 ? "" : "s"}?</AlertDialogTitle><AlertDialogDescription>{entity === "merchants" ? "Linked contacts and leads will also be removed. " : entity === "contacts" ? "These contacts will be unlinked from leads and merchant primary contacts. " : ""}This permanently deletes database records and cannot be undone here.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={e => { e.preventDefault(); void confirmDelete(); }}>{busy ? "Deleting…" : "Delete records"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
