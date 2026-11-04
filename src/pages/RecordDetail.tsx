import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Plus, MapPin, Globe, ContactRound, Mail, Phone, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeading, RecordAvatar, StatusBadge, DataTable, EmptyState, Pagination } from "@/components/CRMShared";
import RecordEditor from "@/components/RecordEditor";
import QueryState from "@/components/QueryState";
import { useCRM, useRecord, useRecords, useUserDirectory, fieldsFor, merchantGroups, formatDate, isDuplicate, type Entity, type Field } from "@/lib/crm";
import { useSession } from "@/components/SessionProvider";
import { errorMessage } from "@/lib/errors";
import { toast } from "sonner";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";

export default function RecordDetail({ entity }: { entity: Entity }) {
  const { id } = useParams(), navigate = useNavigate(), crm = useCRM(), { isAdmin } = useSession();
  const result = useRecord(entity, id), record = result.data;
  const [editing, setEditing] = useState(false), [adding, setAdding] = useState<Entity | null>(null), [deleting, setDeleting] = useState(false), [busy, setBusy] = useState(false), [contactPage, setContactPage] = useState(1), [leadPage, setLeadPage] = useState(1);
  const merchantResult = useRecord("merchants", entity === "merchants" ? undefined : String(record?.merchantId || "") || undefined);
  const merchant = entity === "merchants" ? record : merchantResult.data;
  const primary = useRecord("contacts", String(entity === "merchants" ? record?.primaryContactId || "" : entity === "leads" ? record?.contactId || "" : "") || undefined);
  const contacts = useRecords("contacts", { filters: { merchantId: merchant?.id || "" }, sort: "name", asc: true, page: contactPage, pageSize: 10 }, !!merchant);
  const leads = useRecords("leads", { filters: { merchantId: merchant?.id || "" }, page: leadPage, pageSize: 10 }, !!merchant && entity === "merchants");
  const directory = useUserDirectory();
  if (result.error) return <QueryState error={result.error} retry={() => void result.refetch()} />;
  if (result.isPending) return <QueryState />;
  if (!record) return <><Link to={`/${entity}`} className="flex items-center gap-2 text-xs text-primary"><ArrowLeft size={14} />Back to {entity}</Link><EmptyState title="Record not found" description="This record may have been deleted or is unavailable to your account." /></>;
  if (entity !== "merchants" && merchantResult.isPending) return <QueryState />;
  if (merchantResult.error || primary.error) return <QueryState error={merchantResult.error || primary.error} retry={() => { void merchantResult.refetch(); void primary.refetch(); }} />;
  const title = String(entity === "leads" ? merchant?.name || "Lead" : record.name);
  const assignee = (userId: unknown) => directory.data?.find(u => u.id === userId)?.name || (userId ? "Previously assigned account" : "Unassigned");
  function value(f: Field) {
    const v = record![f.key];
    if (f.type === "merchant") return <Link to={`/merchants/${v}`} className="text-primary hover:underline">{merchant?.name || "—"}</Link>;
    if (f.type === "user") return assignee(v);
    if (f.type === "contact") return primary.data ? <Link className="text-primary hover:underline" to={`/contacts/${primary.data.id}`}>{primary.data.name}<span className="ml-2 text-[10px] text-muted-foreground">{primary.data.title}</span></Link> : v && primary.isPending ? "Loading contact…" : "Not specified";
    if (f.type === "number") return v === null || v === undefined || v === "" ? "Unknown" : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(v));
    if (f.type === "date") return formatDate(v);
    if (["status", "quality", "priority", "type"].includes(f.key) && v) return <StatusBadge value={v} />;
    if (f.key === "website" && v) {
      let href = String(v); if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
      try { const url = new URL(href); if (["http:", "https:"].includes(url.protocol)) return <a className="break-all text-primary hover:underline" href={url.href} target="_blank" rel="noopener noreferrer">{String(v)}</a>; } catch { /* Invalid URL remains plain text. */ }
    }
    return v ? <span className="whitespace-pre-wrap break-words">{String(v)}</span> : <span className="text-muted-foreground">Not specified</span>;
  }
  async function confirmDelete() {
    setBusy(true);
    try { await crm.remove(entity, [record!.id]); navigate(`/${entity}`); toast.success("Record deleted"); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }
  const groups = entity === "merchants" ? merchantGroups : [{ title: entity === "contacts" ? "Contact information" : "Lead information", fields: fieldsFor(entity) }];
  return <>
    <Link to={`/${entity}`} className="mb-5 inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-primary"><ArrowLeft size={13} />Back to {entity}</Link>
    <PageHeading title={title} description={entity === "merchants" ? `${record.industry || "Industry unknown"} · ${record.city || "City unknown"}, ${record.province || "Province unknown"}` : entity === "contacts" ? String(record.title || "Contact profile") : "Merchant lead"}>{(OFFLINE_PREVIEW || isAdmin) && <Button variant="outline" className="h-9 gap-2 bg-card text-xs" onClick={() => setDeleting(true)}><Trash2 size={13} />Delete</Button>}<Button className="h-9 gap-2 text-xs" onClick={() => setEditing(true)}><Pencil size={13} />Edit {entity === "merchants" ? "merchant" : entity === "contacts" ? "contact" : "lead"}</Button></PageHeading>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="min-w-0 space-y-5">{entity === "merchants" && isDuplicate(record) && <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"><Copy size={15} />Possible duplicate. Another merchant has a matching name, phone, email, or website.</div>}{groups.map(g => <section className="panel p-5" key={g.title}><h2 className="mb-5 border-b pb-4 text-[13px] font-bold">{g.title}</h2><dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{g.fields.map(f => <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : "min-w-0"}><dt className="mb-1.5 text-[10px] text-muted-foreground">{f.label}</dt><dd className="text-[12px] leading-relaxed">{value(f)}</dd></div>)}</dl></section>)}
    {entity === "merchants" && <>
      <section className="panel overflow-hidden"><div className="flex items-center justify-between p-5"><div><h2 className="text-[13px] font-bold">Linked contacts <span className="ml-1 font-normal text-muted-foreground">{contacts.data?.total ?? ""}</span></h2><p className="mt-1 text-[10px] text-muted-foreground">People associated with this merchant.</p></div><Button variant="outline" size="sm" className="h-8 gap-1 text-[11px]" onClick={() => setAdding("contacts")}><Plus size={12} />Add contact</Button></div>{contacts.error ? <QueryState error={contacts.error} retry={() => void contacts.refetch()} /> : !contacts.data ? <QueryState /> : <><DataTable rows={contacts.data.rows} columns={[{ key: "name", label: "Full name", render: r => <Link className="font-medium text-primary" to={`/contacts/${r.id}`}>{r.name}</Link> }, { key: "title", label: "Job title" }, { key: "email", label: "Email" }, { key: "type", label: "Contact type" }]} /><Pagination page={contactPage} pages={Math.max(1, Math.ceil(contacts.data.total / 10))} total={contacts.data.total} pageSize={10} onPage={setContactPage} /></>}</section>
      <section className="panel overflow-hidden"><div className="flex items-center justify-between p-5"><h2 className="text-[13px] font-bold">Merchant leads <span className="ml-1 font-normal text-muted-foreground">{leads.data?.total ?? ""}</span></h2><Button variant="outline" size="sm" className="h-8 gap-1 text-[11px]" onClick={() => setAdding("leads")}><Plus size={12} />Add lead</Button></div>{leads.error ? <QueryState error={leads.error} retry={() => void leads.refetch()} /> : !leads.data ? <QueryState /> : <><DataTable rows={leads.data.rows} columns={[{ key: "status", label: "Status", render: r => <Link to={`/leads/${r.id}`}><StatusBadge value={r.status} /></Link> }, { key: "priority", label: "Priority" }, { key: "assignedUser", label: "Assigned to", render: r => assignee(r.assignedUser) }, { key: "followUp", label: "Follow-up", render: r => formatDate(r.followUp) }]} /><Pagination page={leadPage} pages={Math.max(1, Math.ceil(leads.data.total / 10))} total={leads.data.total} pageSize={10} onPage={setLeadPage} /></>}</section>
    </>}</div>
    <aside className="space-y-5"><section className="panel p-5"><div className="mb-4"><RecordAvatar name={String(merchant?.name || title)} size="large" /></div><h2 className="text-[14px] font-bold">{merchant?.name || title}</h2>{merchant && <><p className="mt-1 text-[11px] text-muted-foreground">{merchant.industry}</p><div className="mt-4"><StatusBadge value={merchant.status} /></div><div className="mt-5 space-y-3 border-t pt-4 text-[11px] text-muted-foreground"><div className="flex items-center gap-2"><MapPin size={13} />{merchant.city || "Unknown location"}, {merchant.province || "—"}</div><div className="flex items-center gap-2"><Phone size={13} />{merchant.phone || "No phone added"}</div><div className="flex items-center gap-2 break-all"><Mail size={13} />{merchant.email || "No email added"}</div><div className="flex items-center gap-2"><ContactRound size={13} />{contacts.data?.total ?? "…"} linked contacts</div></div>{entity !== "merchants" && <Button variant="outline" className="mt-5 h-9 w-full gap-2 text-[11px]" asChild><Link to={`/merchants/${merchant.id}`}>View merchant profile<Globe size={12} /></Link></Button>}</>}</section><section className="panel p-5"><h2 className="mb-4 text-[12px] font-bold">Record information</h2><dl className="space-y-4 text-[11px]"><div><dt className="text-muted-foreground">Date added</dt><dd className="mt-1">{formatDate(record.createdAt)}</dd></div><div><dt className="text-muted-foreground">Last updated</dt><dd className="mt-1">{formatDate(record.updatedAt)}</dd></div><div><dt className="text-muted-foreground">Ingestion timestamp</dt><dd className="mt-1">{record.ingestedAt ? new Date(String(record.ingestedAt)).toLocaleString() : "Not ingested"}</dd></div><div><dt className="text-muted-foreground">Stable record ID</dt><dd className="mt-1 break-all font-mono text-[10px]">{record.id}</dd></div></dl></section></aside></div>
    {editing && <RecordEditor entity={entity} record={record} onClose={() => setEditing(false)} />}{adding && <RecordEditor entity={adding} merchantId={record.id} onClose={() => setAdding(null)} />}
    <AlertDialog open={deleting} onOpenChange={v => !busy && setDeleting(v)}><AlertDialogContent className="rounded-xl"><AlertDialogHeader><AlertDialogTitle>Delete this record?</AlertDialogTitle><AlertDialogDescription>{entity === "merchants" ? "All associated contacts and leads will also be deleted. " : entity === "contacts" ? "Associated leads and merchants will have their primary contact cleared. " : ""}{OFFLINE_PREVIEW ? "Only local test records are removed. Reloading restores the fictional dataset." : "This permanently deletes the database record and cannot be undone here."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={e => { e.preventDefault(); void confirmDelete(); }}>{busy ? "Deleting…" : "Delete record"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
