import { createContext, useContext, useState, type ReactNode } from "react";

export type Entity = "merchants" | "contacts" | "leads";
export type RecordData = { id: string; [key: string]: string | number | null };
export type Field = { key: string; label: string; type?: "text" | "email" | "date" | "number" | "textarea" | "select" | "merchant" | "contact"; options?: string[]; required?: boolean };
export const statuses = ["New", "Contacted", "Interested", "Qualified", "Won", "Lost"];
export const provinces = ["Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"];
export const merchantGroups: { title: string; fields: Field[] }[] = [
  { title: "Business identification", fields: [
    { key: "name", label: "Business name", required: true }, { key: "legalName", label: "Legal business name" },
    { key: "industry", label: "Industry", required: true }, { key: "website", label: "Website" },
    { key: "description", label: "Business description", type: "textarea" },
    { key: "status", label: "Business status", type: "select", required: true, options: ["Active", "Unknown", "Closed"] }, { key: "source", label: "Data source" },
  ] },
  { title: "Location", fields: [{ key: "address", label: "Street address" }, { key: "city", label: "City" }, { key: "province", label: "Province", type: "select", options: provinces }, { key: "postalCode", label: "Postal code" }, { key: "country", label: "Country" }] },
  { title: "Business contact information", fields: [{ key: "phone", label: "Business phone" }, { key: "email", label: "Business email", type: "email" }, { key: "primaryContactId", label: "Primary contact / title", type: "contact" }] },
  { title: "Payment processing", fields: [{ key: "estimatedVolume", label: "Estimated monthly card volume (CAD)", type: "number" }, { key: "confirmedVolume", label: "Confirmed monthly card volume (CAD)", type: "number" }, { key: "processor", label: "Current payment processor" }, { key: "pos", label: "POS system / terminal" }, { key: "processingNotes", label: "Processing notes", type: "textarea" }] },
  { title: "Data management", fields: [{ key: "lastVerified", label: "Last verified", type: "date" }, { key: "quality", label: "Data quality", type: "select", options: ["Unverified", "Needs review", "Verified"] }, { key: "sourceId", label: "External source ID" }, { key: "notes", label: "Internal notes", type: "textarea" }] },
];
export const contactFields: Field[] = [{ key: "name", label: "Full name", required: true }, { key: "merchantId", label: "Associated merchant", type: "merchant", required: true }, { key: "title", label: "Job title" }, { key: "type", label: "Contact type", type: "select", options: ["Owner", "Manager", "Director", "Other"] }, { key: "phone", label: "Phone" }, { key: "email", label: "Email", type: "email" }, { key: "notes", label: "Notes", type: "textarea" }];
export const leadFields: Field[] = [{ key: "merchantId", label: "Associated merchant", type: "merchant", required: true }, { key: "contactId", label: "Primary contact", type: "contact" }, { key: "status", label: "Lead status", type: "select", required: true, options: statuses }, { key: "assignedUser", label: "Assigned user (demo label)" }, { key: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High"] }, { key: "lastContact", label: "Last contact date", type: "date" }, { key: "followUp", label: "Next follow-up date", type: "date" }, { key: "notes", label: "Notes", type: "textarea" }];
export const fieldsFor = (entity: Entity) => entity === "merchants" ? merchantGroups.flatMap(g => g.fields) : entity === "contacts" ? contactFields : leadFields;
const businesses = [
  ["Juniper & Oak Café", "Food & beverage", "Toronto", "Ontario", "jo", "Active"],
  ["Northline Dental Studio", "Healthcare", "Vancouver", "British Columbia", "nd", "Active"],
  ["Evergreen Market", "Retail", "Ottawa", "Ontario", "em", "Active"],
  ["Forma Fitness Club", "Health & fitness", "Calgary", "Alberta", "ff", "Active"],
  ["Atelier Lumière", "Beauty & wellness", "Montréal", "Quebec", "al", "Active"],
  ["Westward Auto Care", "Automotive", "Edmonton", "Alberta", "wa", "Active"],
  ["The Little Pantry", "Food & beverage", "Toronto", "Ontario", "lp", "Active"],
  ["Cedar House Interiors", "Retail", "Victoria", "British Columbia", "ch", "Active"],
  ["Harbourview Pharmacy", "Healthcare", "Halifax", "Nova Scotia", "hp", "Unknown"],
  ["Milo's Kitchen", "Food & beverage", "Winnipeg", "Manitoba", "mk", "Active"],
  ["Fieldwork Supply", "Retail", "Hamilton", "Ontario", "fs", "Active"],
  ["Studio Solstice", "Beauty & wellness", "Québec City", "Quebec", "ss", "Active"],
  ["Prairie Movement", "Health & fitness", "Saskatoon", "Saskatchewan", "pm", "Unknown"],
  ["Bay Street Bistro", "Food & beverage", "Toronto", "Ontario", "bb", "Closed"],
  ["Peak Performance Auto", "Automotive", "Calgary", "Alberta", "pa", "Active"],
  ["Maple & Main", "Retail", "Kingston", "Ontario", "mm", "Active"],
];
function seed() {
  const merchants: RecordData[] = businesses.map(([name, industry, city, province, code, status], i) => ({
    id: `demo-merchant-${i + 1}`, name, industry, city, province, status, legalName: "", website: i % 5 === 0 ? "" : `https://${code}.example`,
    email: i % 4 === 0 ? "" : `hello@${code}.example`, phone: i % 6 === 0 ? "" : `+1 416 555 ${String(100 + i).padStart(4, "0")}`,
    address: `${120 + i * 11} Example Street`, postalCode: "", country: "Canada", source: i % 3 === 0 ? "Manual entry" : "Sample import",
    description: "Fictional business record for exploring MerchantIQ.", quality: i % 3 === 0 ? "Needs review" : "Unverified",
    estimatedVolume: null, confirmedVolume: null, processor: "", pos: "", processingNotes: "", notes: "Demonstration data. Not a real business lead.",
    sourceId: "", ingestedAt: null, lastVerified: "", createdAt: `2026-01-${String(28 - i).padStart(2, "0")}T10:00:00Z`, updatedAt: `2026-01-${String(28 - i).padStart(2, "0")}T10:00:00Z`,
  }));
  const names = ["Alex Morgan", "Jamie Chen", "Taylor Wilson", "Sam Patel", "Camille Roy", "Jordan Lee", "Robin Clark", "Avery Martin", "Charlie Brown", "Morgan Scott"];
  const contacts: RecordData[] = names.map((name, i) => ({ id: `demo-contact-${i + 1}`, name, merchantId: merchants[i % 8].id, title: i % 2 ? "General manager" : "Business owner", type: i % 2 ? "Manager" : "Owner", phone: `+1 416 555 ${String(150 + i).padStart(4, "0")}`, email: `${name.split(" ")[0].toLowerCase()}@contact.example`, notes: "Fictional demonstration contact.", updatedAt: "2026-01-28T10:00:00Z", createdAt: "2026-01-28T10:00:00Z" }));
  const leads: RecordData[] = merchants.slice(0, 8).map((m, i) => ({ id: `demo-lead-${i + 1}`, merchantId: m.id, contactId: contacts[i].id, status: statuses[i % 6], priority: ["High", "Medium", "Low"][i % 3], assignedUser: "Demo user", notes: "Sample lead. No outreach has been performed.", lastContact: "", followUp: "", createdAt: "2026-01-28T10:00:00Z", updatedAt: "2026-01-28T10:00:00Z" }));
  return { merchants, contacts, leads };
}
type Store = ReturnType<typeof seed>;
type CRM = Store & { save: (entity: Entity, record: RecordData) => void; remove: (entity: Entity, ids: string[]) => void; importMerchants: (records: RecordData[]) => void };
const Context = createContext<CRM | null>(null);
export function CRMProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(seed);
  const save = (entity: Entity, record: RecordData) => setData(previous => {
    const now = new Date().toISOString();
    const exists = previous[entity].some(r => r.id === record.id);
    const next = { ...previous, [entity]: exists ? previous[entity].map(r => r.id === record.id ? { ...record, updatedAt: now } : r) : [{ ...record, createdAt: now, updatedAt: now }, ...previous[entity]] };
    if (entity === "contacts") {
      next.leads = previous.leads.map(l => l.contactId === record.id && l.merchantId !== record.merchantId ? { ...l, contactId: "", updatedAt: now } : l);
      next.merchants = previous.merchants.map(m => m.primaryContactId === record.id && m.id !== record.merchantId ? { ...m, primaryContactId: "", updatedAt: now } : m);
    }
    return next;
  });
  const remove = (entity: Entity, ids: string[]) => setData(previous => {
    const next = { ...previous, [entity]: previous[entity].filter(r => !ids.includes(r.id)) };
    if (entity === "merchants") {
      const removedContacts = previous.contacts.filter(c => ids.includes(String(c.merchantId))).map(c => c.id);
      next.contacts = previous.contacts.filter(c => !ids.includes(String(c.merchantId)));
      next.leads = previous.leads.filter(l => !ids.includes(String(l.merchantId))).map(l => removedContacts.includes(String(l.contactId)) ? { ...l, contactId: "" } : l);
    }
    if (entity === "contacts") {
      const now = new Date().toISOString();
      next.leads = previous.leads.map(l => ids.includes(String(l.contactId)) ? { ...l, contactId: "", updatedAt: now } : l);
      next.merchants = previous.merchants.map(m => ids.includes(String(m.primaryContactId)) ? { ...m, primaryContactId: "", updatedAt: now } : m);
    }
    return next;
  });
  return <Context.Provider value={{ ...data, save, remove, importMerchants: records => setData(p => ({ ...p, merchants: [...records, ...p.merchants] })) }}>{children}</Context.Provider>;
}
export function useCRM() { const value = useContext(Context); if (!value) throw new Error("CRMProvider required"); return value; }
export function formatDate(value: unknown) { return value ? new Date(String(value)).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "—"; }
const normal = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function isDuplicate(record: RecordData, merchants: RecordData[]) { return merchants.some(other => other.id !== record.id && ["name", "phone", "email", "website"].some(key => normal(record[key]) && normal(record[key]) === normal(other[key]))); }
export function exportCSV(records: RecordData[], columns: string[], filename: string) {
  const escape = (v: unknown) => { let text = String(v ?? ""); if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
  const csv = [columns, ...records.map(r => columns.map(k => r[k]))].map(row => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else { quoted = !quoted; } } else if (c === "," && !quoted) { row.push(cell); cell = ""; } else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; } else cell += c; }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  row.push(cell); if (row.some(Boolean)) rows.push(row); return rows;
}
