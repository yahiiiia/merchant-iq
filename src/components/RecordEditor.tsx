import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCRM, useUserDirectory, merchantGroups, contactFields, leadFields, type Entity, type RecordData, type Field } from "@/lib/crm";
import RecordPicker from "@/components/RecordPicker";
import { errorMessage } from "@/lib/errors";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function RecordEditor({ entity, record, onClose, merchantId }: { entity: Entity; record?: RecordData; onClose: () => void; merchantId?: string }) {
  const { save } = useCRM();
  const directory = useUserDirectory();
  const [values, setValues] = useState<RecordData>(() => record ? { ...record } : { id: crypto.randomUUID(), country: "Canada", status: entity === "leads" ? "New" : "Unknown", quality: "Unverified", priority: "Medium", type: "Other", merchantId: merchantId || "", estimatedVolume: null, confirmedVolume: null, source: "Manual entry" });
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const groups = entity === "merchants" ? merchantGroups : [{ title: entity === "contacts" ? "Contact information" : "Lead information", fields: entity === "contacts" ? contactFields : leadFields }];
  const singular = entity === "merchants" ? "merchant" : entity === "contacts" ? "contact" : "lead";
  function update(field: Field, value: string) { setValues(p => ({ ...p, [field.key]: field.type === "number" ? value === "" ? null : Number(value) : value, ...(field.key === "merchantId" ? { contactId: "" } : {}) })); }
  function input(field: Field) {
    const id = `edit-${field.key}`, value = String(values[field.key] ?? "");
    if (field.type === "merchant" || field.type === "contact") return <RecordPicker id={id} entity={field.type === "merchant" ? "merchants" : "contacts"} label={field.type === "merchant" ? "merchant" : "contact"} value={value} required={field.required} merchantId={entity === "merchants" ? record?.id : String(values.merchantId || "")} onChange={v => update(field, v)} />;
    const props = { id, required: field.required, value, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => update(field, e.target.value), className: "field text-[12px]", disabled: busy };
    if (field.type === "user") return <><select {...props}><option value="">Unassigned</option>{directory.data?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}{value && !directory.data?.some(u => u.id === value) && <option value={value}>Previously assigned account</option>}</select>{directory.error && <p className="mt-1 text-[10px] text-destructive">{errorMessage(directory.error)}</p>}</>;
    if (field.type === "select") return <select {...props}><option value="">{field.required ? `Select ${field.label.toLowerCase()}` : "Not specified"}</option>{field.options?.map(o => <option key={o} value={o}>{o}</option>)}</select>;
    if (field.type === "textarea") return <textarea {...props} className="field min-h-20 py-2" rows={3} />;
    return <input {...props} type={field.type || "text"} min={field.type === "number" ? 0 : undefined} step={field.type === "number" ? "0.01" : undefined} placeholder={field.type === "number" ? "Unknown — leave blank" : undefined} maxLength={field.type === "number" || field.type === "date" ? undefined : 2000} />;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const required = groups.flatMap(g => g.fields).find(f => f.required && !String(values[f.key] || "").trim());
    if (required) { setError(`${required.label} is required.`); return; }
    setBusy(true);
    try { await save(entity, values, !!record); toast.success(`${singular[0].toUpperCase() + singular.slice(1)} ${record ? "updated" : "created"}`); onClose(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => !open && !busy && onClose()}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-xl p-0"><div className="border-b px-6 py-5"><DialogHeader><DialogTitle className="text-xl tracking-tight">{record ? "Edit" : "Add"} {singular}</DialogTitle><DialogDescription className="text-xs">Changes are saved to your CRM database. * Required fields.</DialogDescription></DialogHeader></div><form onSubmit={submit}><fieldset disabled={busy}><div className="space-y-7 px-6 py-5">{groups.map(g => <section key={g.title}><h3 className="mb-4 border-b pb-2 text-[12px] font-bold">{g.title}</h3>{g.title === "Payment processing" && <p className="mb-4 text-[11px] text-muted-foreground">Leave volumes blank when unknown. No estimates are generated.</p>}{g.title === "Business contact information" && <p className="mb-4 text-[11px] text-muted-foreground">Create the merchant first, then add linked contacts and select a primary contact.</p>}<div className="grid gap-4 sm:grid-cols-2">{g.fields.map(f => <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}><label htmlFor={`edit-${f.key}`} className="mb-1.5 block text-[11px] font-medium">{f.label}{f.required && <span className="ml-1 text-primary">*</span>}</label>{input(f)}</div>)}</div></section>)}{entity === "contacts" && record && <p className="text-[11px] text-muted-foreground">Moving a contact to another merchant clears incompatible primary-contact references.</p>}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div></fieldset><div className="sticky bottom-0 flex justify-end gap-2 border-t bg-card px-6 py-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose} className="h-9 text-xs">Cancel</Button><Button type="submit" disabled={busy} className="h-9 gap-2 text-xs"><Save size={14} />{busy ? "Saving…" : record ? "Save changes" : `Create ${singular}`}</Button></div></form></DialogContent></Dialog>;
}
