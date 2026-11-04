export type Entity = "merchants" | "contacts" | "leads";
export type RecordData = { id: string; [key: string]: string | number | boolean | null };
export type Field = { key: string; label: string; type?: "text" | "email" | "date" | "number" | "textarea" | "select" | "merchant" | "contact" | "user"; options?: string[]; required?: boolean };
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
export const leadFields: Field[] = [{ key: "merchantId", label: "Associated merchant", type: "merchant", required: true }, { key: "contactId", label: "Primary contact", type: "contact" }, { key: "status", label: "Lead status", type: "select", required: true, options: statuses }, { key: "assignedUser", label: "Assigned user", type: "user" }, { key: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High"] }, { key: "lastContact", label: "Last contact date", type: "date" }, { key: "followUp", label: "Next follow-up date", type: "date" }, { key: "notes", label: "Notes", type: "textarea" }];
export const fieldsFor = (entity: Entity) => entity === "merchants" ? merchantGroups.flatMap(g => g.fields) : entity === "contacts" ? contactFields : leadFields;
export function formatDate(value: unknown) { return value ? new Date(String(value)).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—"; }
export function isDuplicate(record: RecordData) { return record.possibleDuplicate === true; }
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
