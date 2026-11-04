import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCRM, merchantGroups, contactFields, leadFields, type Entity, type RecordData, type Field } from "@/lib/crm";
import { toast } from "sonner";
import { Info, Save } from "lucide-react";

export default function RecordEditor({ entity, record, onClose, merchantId }: { entity: Entity; record?: RecordData; onClose: () => void; merchantId?: string }) {
  const { merchants, contacts, save } = useCRM();
  const [values, setValues] = useState<RecordData>(() => record ? { ...record } : { id: crypto.randomUUID(), country: "Canada", status: entity === "leads" ? "New" : "Unknown", quality: "Unverified", priority: "Medium", type: "Other", merchantId: merchantId || "", estimatedVolume: null, confirmedVolume: null, source: "Manual entry", sourceId: "", ingestedAt: null });
  const [error, setError] = useState("");
  const groups = entity === "merchants" ? merchantGroups : [{ title: entity === "contacts" ? "Contact information" : "Lead information", fields: entity === "contacts" ? contactFields : leadFields }];
  function update(field: Field, value: string) { setValues(p => ({ ...p, [field.key]: field.type === "number" ? value === "" ? null : Number(value) : value, ...(field.key === "merchantId" ? { contactId: "" } : {}) })); }
  function input(field: Field) {
    const id = `edit-${field.key}`;
    const props = { id, required: field.required, value: values[field.key] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => update(field, e.target.value), className: "field text-[12px]" };
    if (["select", "merchant", "contact"].includes(field.type || "")) {
      const options = field.type === "merchant" ? merchants.map(m => ({ value: m.id, label: String(m.name) })) : field.type === "contact" ? contacts.filter(c => c.merchantId === (entity === "merchants" ? values.id : values.merchantId)).map(c => ({ value: c.id, label: `${c.name}${c.title ? ` — ${c.title}` : ""}` })) : (field.options || []).map(o => ({ value: o, label: o }));
      return <select {...props}><option value="">{field.required ? `Select ${field.label.toLowerCase()}` : "Not specified"}</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
    }
    if (field.type === "textarea") return <textarea {...props} className="field min-h-20 py-2" rows={3} />;
    return <input {...props} type={field.type || "text"} min={field.type === "number" ? 0 : undefined} step={field.type === "number" ? "0.01" : undefined} placeholder={field.type === "number" ? "Unknown — leave blank" : undefined} maxLength={field.type === "number" || field.type === "date" ? undefined : 2000} />;
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean: RecordData = { ...values };
    for (const [key, value] of Object.entries(clean)) if (typeof value === "string") clean[key] = value.trim();
    const required = groups.flatMap(g => g.fields).find(f => f.required && !String(clean[f.key] || "").trim());
    if (required) { setError(`${required.label} is required.`); return; }
    if (entity !== "merchants" && !merchants.some(m => m.id === clean.merchantId)) { setError("Choose an existing merchant."); return; }
    if (entity === "leads" && clean.contactId && !contacts.some(c => c.id === clean.contactId && c.merchantId === clean.merchantId)) { setError("Choose a contact associated with this merchant."); return; }
    save(entity, clean); toast.success(`${entity === "merchants" ? "Merchant" : entity === "contacts" ? "Contact" : "Lead"} ${record ? "updated" : "created"} in demo memory`); onClose();
  }
  const singular = entity === "merchants" ? "merchant" : entity === "contacts" ? "contact" : "lead";
  return <Dialog open onOpenChange={open => !open && onClose()}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-xl p-0"><div className="border-b px-6 py-5"><DialogHeader><DialogTitle className="text-xl tracking-tight">{record ? "Edit" : "Add"} {singular}</DialogTitle><DialogDescription className="text-xs">{record ? "Update the record details below." : "Start with the essentials. You can add more detail later."} * Required fields.</DialogDescription></DialogHeader></div><form onSubmit={submit}><div className="space-y-7 px-6 py-5"><div className="flex gap-2 rounded-lg bg-accent px-3 py-2.5 text-[11px] text-accent-foreground"><Info size={14} className="shrink-0" />Demo only. This record is held in memory and will reset on refresh.</div>{groups.map(g => <section key={g.title}><h3 className="mb-4 border-b pb-2 text-[12px] font-bold">{g.title}</h3>{g.title === "Payment processing" && <p className="mb-4 text-[11px] text-muted-foreground">Leave volumes blank when unknown. No estimates are generated.</p>}{g.title === "Business contact information" && <p className="mb-4 text-[11px] text-muted-foreground">People and their job titles are managed as linked records in Contacts.</p>}<div className="grid gap-4 sm:grid-cols-2">{g.fields.map(f => <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}><label htmlFor={`edit-${f.key}`} className="mb-1.5 block text-[11px] font-medium">{f.label}{f.required && <span className="ml-1 text-primary">*</span>}</label>{input(f)}</div>)}</div></section>)}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div><div className="sticky bottom-0 flex justify-end gap-2 border-t bg-card px-6 py-4"><Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs">Cancel</Button><Button type="submit" className="h-9 gap-2 text-xs"><Save size={14} />{record ? "Save changes" : `Create ${singular}`}</Button></div></form></DialogContent></Dialog>;
}
