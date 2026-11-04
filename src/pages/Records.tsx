import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Download, Upload, SlidersHorizontal, X, ArrowUpRight, Copy, Trash2, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeading, SearchInput, DataTable, Pagination, StatusBadge, MerchantName, RecordAvatar, type Column } from "@/components/CRMShared";
import RecordEditor from "@/components/RecordEditor";
import ImportMerchants from "@/components/ImportMerchants";
import { useCRM, isDuplicate, formatDate, exportCSV, fieldsFor, type Entity, type RecordData, statuses } from "@/lib/crm";
import { toast } from "sonner";

export default function Records({ entity }: { entity: Entity }) {
  const crm = useCRM(), rows = crm[entity];
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(""), [filters, setFilters] = useState<Record<string, string>>({}), [sort, setSort] = useState({ key: "createdAt", asc: false }), [page, setPage] = useState(1), [selected, setSelected] = useState<string[]>([]), [editing, setEditing] = useState<RecordData | null>(null), [adding, setAdding] = useState(false), [importing, setImporting] = useState(false), [deleting, setDeleting] = useState<string[]>([]), [pageSize, setPageSize] = useState(10);
  const singular = entity === "merchants" ? "merchant" : entity === "contacts" ? "contact" : "lead";
  const title = entity[0].toUpperCase() + entity.slice(1);
  const merchant = (id: unknown) => crm.merchants.find(m => m.id === id);
  const displayName = (r: RecordData) => String(entity === "leads" ? merchant(r.merchantId)?.name || "" : r.name || "");
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim(); const digits = q.replace(/\D/g, "");
    return rows.filter(r => {
      const m = entity === "merchants" ? r : crm.merchants.find(m => m.id === r.merchantId);
      const searchable = [r.name, r.phone, r.email, m?.name, m?.website, entity === "leads" ? r.assignedUser : null].some(v => String(v || "").toLowerCase().includes(q));
      const phoneMatch = digits.length >= 3 && String(r.phone || m?.phone || "").replace(/\D/g, "").includes(digits);
      return (!q || searchable || phoneMatch) && Object.entries(filters).every(([key, value]) => !value || String(r[key] || "") === value);
    }).sort((a, b) => {
      const val = (r: RecordData) => sort.key === "merchantId" ? crm.merchants.find(m => m.id === r.merchantId)?.name || "" : r[sort.key] ?? "";
      return String(val(a)).localeCompare(String(val(b)), "en", { numeric: true }) * (sort.asc ? 1 : -1);
    });
  }, [rows, crm.merchants, entity, search, filters, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)), safePage = Math.min(page, totalPages);
  const filterDefinitions = entity === "merchants" ? [{ key: "province", label: "Province" }, { key: "city", label: "City" }, { key: "industry", label: "Industry" }, { key: "source", label: "Source" }, { key: "status", label: "Status" }] : entity === "contacts" ? [{ key: "merchantId", label: "Merchant" }, { key: "type", label: "Contact type" }] : [{ key: "status", label: "Status" }, { key: "priority", label: "Priority" }, { key: "assignedUser", label: "Assignee" }, { key: "merchantId", label: "Merchant" }];
  const columns: Column[] = entity === "merchants" ? [
    { key: "name", label: "Business name", render: r => <div className="flex items-center gap-2"><MerchantName record={r} />{isDuplicate(r, crm.merchants) && <span title="Possible duplicate: matching name, phone, email, or website" className="text-amber-700"><Copy size={13} /><span className="sr-only">Possible duplicate</span></span>}</div> },
    { key: "industry", label: "Industry", render: r => <span className="whitespace-nowrap text-muted-foreground">{r.industry || "—"}</span> },
    { key: "city", label: "Location", render: r => <span className="whitespace-nowrap"><span className="block">{r.city || "—"}</span><span className="mt-1 block text-[10px] text-muted-foreground">{r.province || "—"}</span></span> },
    { key: "phone", label: "Contact details", render: r => <span className="whitespace-nowrap"><span className="block">{r.phone || "No phone"}</span><span className="mt-1 block text-[10px] text-muted-foreground">{r.email || "No email"}</span></span> },
    { key: "source", label: "Source", render: r => <span className="whitespace-nowrap rounded-md border px-2 py-1 text-[10px] text-muted-foreground">{r.source || "Unknown"}</span> },
    { key: "status", label: "Status", render: r => <StatusBadge value={r.status} /> },
  ] : entity === "contacts" ? [
    { key: "name", label: "Contact", render: r => <Link to={`/contacts/${r.id}`} className="flex min-w-[150px] items-center gap-3 hover:text-primary"><RecordAvatar name={String(r.name)} /><span><span className="block font-semibold">{r.name}</span><span className="mt-1 block text-[10px] text-muted-foreground">{r.title || "No title"}</span></span></Link> },
    { key: "merchantId", label: "Merchant", render: r => <Link className="whitespace-nowrap hover:text-primary" to={`/merchants/${r.merchantId}`}>{merchant(r.merchantId)?.name || "—"}</Link> },
    { key: "type", label: "Type", render: r => <StatusBadge value={r.type} /> }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "updatedAt", label: "Last updated", render: r => <span className="whitespace-nowrap text-muted-foreground">{formatDate(r.updatedAt)}</span> },
  ] : [
    { key: "merchantId", label: "Merchant", render: r => <Link to={`/leads/${r.id}`} className="flex min-w-[180px] items-center gap-3 hover:text-primary"><RecordAvatar name={displayName(r)} /><span className="font-semibold">{displayName(r)}</span></Link> },
    { key: "contactId", label: "Primary contact", render: r => crm.contacts.find(c => c.id === r.contactId)?.name || "—" },
    { key: "status", label: "Status", render: r => <StatusBadge value={r.status} /> },
    { key: "priority", label: "Priority", render: r => <StatusBadge value={r.priority} /> }, { key: "assignedUser", label: "Assigned to" },
    { key: "followUp", label: "Follow-up", render: r => <span className="whitespace-nowrap text-muted-foreground">{formatDate(r.followUp)}</span> },
  ];
  function doExport() {
    const records = selected.length ? filtered.filter(r => selected.includes(r.id)) : filtered;
    const fields = ["id", ...fieldsFor(entity).map(f => f.key), "createdAt", "updatedAt", ...(entity === "merchants" ? ["ingestedAt"] : [])];
    exportCSV(records, fields, `MerchantIQ-demo-${entity}.csv`); toast.success(`Exported ${records.length} demonstration records`);
  }
  const hasFilters = search || Object.values(filters).some(Boolean);
  const closeEditor = () => { setAdding(false); setEditing(null); if (params.has("new")) setParams({}, { replace: true }); };
  return <>
    <PageHeading title={title} description={entity === "merchants" ? "Your business directory. Organized, searchable, and ready for the next conversation." : entity === "contacts" ? "The people behind your merchants, all in one place." : "Simple follow-ups. Meaningful business relationships."} eyebrow="Business directory"><Button variant="outline" className="h-9 gap-2 bg-card text-[11px]" onClick={doExport}><Download size={14} />Export CSV</Button>{entity === "merchants" && <Button variant="outline" className="h-9 gap-2 bg-card text-[11px]" onClick={() => setImporting(true)}><Upload size={14} />Import</Button>}<Button className="h-9 gap-2 text-[11px]" onClick={() => setAdding(true)} disabled={entity !== "merchants" && !crm.merchants.length}><Plus size={15} />Add {singular}</Button></PageHeading>
    {entity === "leads" && <div className="mb-5 grid grid-cols-3 gap-2 md:grid-cols-6">{statuses.map(status => <button key={status} onClick={() => { setFilters(p => ({ ...p, status: p.status === status ? "" : status })); setPage(1); }} className={`panel px-4 py-3 text-left ${filters.status === status ? "border-primary bg-accent" : "hover:border-primary/40"}`}><span className="text-[10px] text-muted-foreground">{status}</span><span className="mt-1 block text-xl font-semibold">{rows.filter(r => r.status === status).length}</span></button>)}</div>}
    <section className="panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div className="flex items-center gap-2"><h2 className="text-[13px] font-bold">All {entity}</h2><span className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{rows.length}</span></div><span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Users size={12} />Demo records · not persisted</span></div>
      <div className="space-y-3 p-4"><div className="flex flex-wrap items-center gap-2"><SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder={entity === "merchants" ? "Search name, phone, email, website..." : `Search ${entity} or merchants...`} /><span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground"><SlidersHorizontal size={13} />Filters</span><select aria-label="Records per page" className="field h-9 w-auto text-[11px]" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}><option value={10}>10 per page</option><option value={25}>25 per page</option><option value={50}>50 per page</option></select></div><div className="flex flex-wrap items-center gap-2">{filterDefinitions.map(f => <select aria-label={`Filter by ${f.label}`} key={f.key} className="field h-8 w-auto max-w-[210px] text-[11px]" value={filters[f.key] || ""} onChange={e => { setFilters(p => ({ ...p, [f.key]: e.target.value })); setPage(1); }}><option value="">All {f.label.toLowerCase()}{f.label === "City" ? " locations" : ""}</option>{[...new Set(rows.map(r => String(r[f.key] || "")).filter(Boolean))].sort().map(v => <option key={v} value={v}>{f.key === "merchantId" ? merchant(v)?.name : v}</option>)}</select>)}{hasFilters && <button className="flex items-center gap-1 text-[11px] text-primary" onClick={() => { setSearch(""); setFilters({}); setPage(1); }}><X size={12} />Reset</button>}</div></div>
      {selected.length > 0 && <div className="flex flex-wrap items-center gap-3 border-t bg-accent/50 px-5 py-2 text-[11px]"><span className="font-medium">{selected.length} selected</span><button className="text-primary" onClick={doExport}>Export selected matching records</button><button className="text-destructive" onClick={() => setDeleting(selected)}>Delete selected (demo)</button><button className="ml-auto text-muted-foreground" onClick={() => setSelected([])}>Clear</button></div>}
      <DataTable columns={columns} rows={filtered.slice((safePage - 1) * pageSize, safePage * pageSize)} sort={sort} onSort={key => setSort(p => ({ key, asc: p.key === key ? !p.asc : true }))} selected={selected} onSelect={setSelected} actions={r => <div className="flex items-center justify-end gap-1"><Button title="Edit record" aria-label={`Edit ${displayName(r)}`} size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditing(r)}><Pencil size={13} /></Button><Button title="Open details" aria-label={`View ${displayName(r)}`} size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" asChild><Link to={`/${entity}/${r.id}`}><ArrowUpRight size={14} /></Link></Button></div>} />
      <Pagination page={safePage} pages={totalPages} total={filtered.length} pageSize={pageSize} onPage={setPage} />
    </section><p className="mt-4 text-[10px] text-muted-foreground">{entity === "merchants" ? "Possible duplicates are flagged when a name, phone, email, or website matches. Processing volumes remain unknown unless provided." : "Every record references an existing merchant. Business information is not duplicated."} Exports and deletion here are unrestricted demo tools, not role-authorized operations.</p>
    {(adding || editing || params.has("new")) && <RecordEditor entity={entity} record={editing || undefined} onClose={closeEditor} />}{importing && <ImportMerchants onClose={() => setImporting(false)} />}
    <AlertDialog open={deleting.length > 0} onOpenChange={v => !v && setDeleting([])}><AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle>Delete {deleting.length} demo {singular}{deleting.length === 1 ? "" : "s"}?</AlertDialogTitle><AlertDialogDescription>{entity === "merchants" ? "Linked contacts and leads will also be removed. " : entity === "contacts" ? "These contacts will be unlinked from leads. " : ""}This only changes demo memory. Refreshing restores the sample dataset.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { crm.remove(entity, deleting); setSelected([]); setDeleting([]); toast.success("Demo records deleted"); }}>Delete records</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
