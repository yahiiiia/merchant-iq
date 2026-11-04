import { fieldsFor, statuses, type Entity, type RecordData } from "@/lib/crm-fields";
import type { Dashboard, ListOptions, ListResult } from "@/lib/crm";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";

if (!OFFLINE_PREVIEW) throw new Error("Local test data is only available in explicitly enabled development preview.");

type Store = Record<Entity, RecordData[]>;
const testId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const directory = [
  { id: testId(901), name: "Alex — fictional local assignee" },
  { id: testId(902), name: "Sam — fictional local assignee" },
];
const businesses = [
  ["Maple Test Café", "Food & Beverage", "Toronto", "Ontario"],
  ["Pacific Sample Books", "Retail", "Vancouver", "British Columbia"],
  ["Prairie Preview Cycles", "Retail", "Calgary", "Alberta"],
  ["Harbour Test Studio", "Services", "Halifax", "Nova Scotia"],
  ["Cedar Sample Bakery", "Food & Beverage", "Ottawa", "Ontario"],
  ["Northern Preview Dental", "Healthcare", "Winnipeg", "Manitoba"],
  ["Birch Test Florist", "Retail", "Victoria", "British Columbia"],
  ["River Sample Fitness", "Wellness", "Edmonton", "Alberta"],
  ["Spruce Preview Market", "Retail", "Regina", "Saskatchewan"],
  ["Lakeside Test Workshop", "Services", "Hamilton", "Ontario"],
  ["Acorn Sample Kitchen", "Food & Beverage", "Montreal", "Quebec"],
  ["Coastal Preview Optics", "Healthcare", "Moncton", "New Brunswick"],
];
function seed(): Store {
  const merchants: RecordData[] = businesses.map(([name, industry, city, province], i) => ({
    id: testId(i + 1), name, industry, city, province, country: "Canada",
    phone: i % 4 === 0 ? null : `416-555-${String(100 + i).padStart(4, "0")}`,
    email: i % 3 === 0 ? null : `merchant${i + 1}@offline.example`,
    website: `https://merchant${i + 1}.example`, status: i === 10 ? "Unknown" : "Active",
    source: "Fictional local test data", quality: "Unverified", estimatedVolume: null, confirmedVolume: null,
    primaryContactId: i < 8 ? testId(101 + i) : null,
    notes: "OFFLINE PREVIEW ONLY — fictional business. Never sync or import into production.",
    createdAt: `2026-01-${String(i + 1).padStart(2, "0")}T12:00:00.000Z`,
    updatedAt: `2026-01-${String(i + 1).padStart(2, "0")}T12:00:00.000Z`,
  }));
  const contacts: RecordData[] = merchants.slice(0, 8).map((m, i) => ({
    id: testId(101 + i), merchantId: m.id, name: `Test Contact ${i + 1}`, title: i % 2 ? "Manager" : "Owner",
    type: i % 2 ? "Manager" : "Owner", email: `contact${i + 1}@offline.example`,
    notes: "Fictional local test contact", createdAt: m.createdAt, updatedAt: m.updatedAt,
  }));
  const leads: RecordData[] = merchants.slice(0, 6).map((m, i) => ({
    id: testId(201 + i), merchantId: m.id, contactId: contacts[i].id,
    status: statuses[i], priority: ["High", "Medium", "Low"][i % 3], assignedUser: directory[i % 2].id,
    followUp: `2026-02-${String(i + 1).padStart(2, "0")}`, notes: "Fictional local test opportunity",
    createdAt: m.createdAt, updatedAt: m.updatedAt,
  }));
  return { merchants, contacts, leads };
}
// Memory only: no localStorage, IndexedDB, session keys, sync queue, or network client.
let store = seed();
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
function joined(entity: Entity, row: RecordData): RecordData {
  if (entity === "merchants") return { ...row, possibleDuplicate: store.merchants.some(other => other.id !== row.id && ["name", "email", "website", "phone"].some(key => {
    const comparable = (r: RecordData) => key === "phone" ? String(r[key] || "").replace(/\D/g, "") : normalize(r[key]);
    return !!comparable(row) && comparable(row) === comparable(other);
  })) };
  return { ...row, merchantName: store.merchants.find(m => m.id === row.merchantId)?.name || "", contactName: entity === "leads" ? store.contacts.find(c => c.id === row.contactId)?.name || "" : "" };
}
export function listRecords(entity: Entity, options: ListOptions = {}): ListResult {
  const { search = "", filters = {}, sort = "createdAt", asc = false, page = 1, pageSize = 25 } = options;
  const needle = normalize(search);
  const rows = store[entity].map(row => joined(entity, row)).filter(row =>
    Object.entries(filters).every(([key, value]) => !value || String(row[key] ?? "") === value) &&
    (!needle || Object.values(row).some(value => normalize(value).includes(needle)) || (needle.replace(/\D/g, "").length >= 4 && String(row.phone || "").replace(/\D/g, "").includes(needle.replace(/\D/g, ""))))
  ).sort((a, b) => {
    const left = a[sort], right = b[sort];
    const order = typeof left === "number" && typeof right === "number" ? left - right : String(left ?? "").localeCompare(String(right ?? ""));
    return (asc ? order : -order) || a.id.localeCompare(b.id);
  });
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
}
export function filterOptions(entity: Entity): Record<string, string[]> {
  return Object.fromEntries(fieldsFor(entity).map(field => [field.key, [...new Set(store[entity].map(row => String(row[field.key] ?? "")).filter(Boolean))].sort()]));
}
export function dashboard(): Dashboard {
  const counts = (key: string) => {
    const result = new Map<string, number>();
    store.merchants.forEach(row => { const name = String(row[key] || "Unknown"); result.set(name, (result.get(name) || 0) + 1); });
    return [...result].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };
  return { merchants: store.merchants.length, contacts: store.contacts.length, leads: store.leads.length,
    phone: store.merchants.filter(m => m.phone).length, email: store.merchants.filter(m => m.email).length,
    industries: counts("industry"), provinces: counts("province"),
    leadCounts: Object.fromEntries(statuses.map(status => [status, store.leads.filter(l => l.status === status).length])),
    recent: listRecords("merchants", { pageSize: 5 }).rows };
}
function validate(entity: Entity, row: RecordData, target: Store) {
  for (const field of fieldsFor(entity)) {
    const value = row[field.key];
    if (field.required && !String(value ?? "").trim()) throw new Error(`${field.label} is required.`);
    if (value !== null && value !== undefined && value !== "") {
      if (field.options && !field.options.includes(String(value))) throw new Error(`Invalid ${field.label.toLowerCase()}.`);
      if (field.type === "number" && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw new Error(`${field.label} must be a nonnegative finite number.`);
    }
  }
  if (entity !== "merchants" && !target.merchants.some(m => m.id === row.merchantId)) throw new Error("Choose an existing local test merchant.");
  const contactId = entity === "merchants" ? row.primaryContactId : entity === "leads" ? row.contactId : null;
  if (contactId && !target.contacts.some(c => c.id === contactId && c.merchantId === (entity === "merchants" ? row.id : row.merchantId))) throw new Error("The contact must belong to the selected merchant.");
  if (entity === "leads" && row.assignedUser && !directory.some(u => u.id === row.assignedUser)) throw new Error("Choose a fictional local assignee.");
}
export function save(entity: Entity, record: RecordData, editing: boolean) {
  const existing = store[entity].find(row => row.id === record.id);
  if (editing && !existing) throw new Error("The local test record no longer exists.");
  if (!editing && existing) throw new Error("This local test record ID already exists.");
  const now = new Date().toISOString();
  const row: RecordData = { ...existing, ...record, createdAt: existing?.createdAt || now, updatedAt: now };
  validate(entity, row, store);
  if (entity === "contacts" && existing && existing.merchantId !== row.merchantId) {
    store.merchants = store.merchants.map(m => m.primaryContactId === row.id ? { ...m, primaryContactId: null, updatedAt: now } : m);
    store.leads = store.leads.map(l => l.contactId === row.id ? { ...l, contactId: null, updatedAt: now } : l);
  }
  store[entity] = editing ? store[entity].map(r => r.id === row.id ? row : r) : [...store[entity], row];
}
export function remove(entity: Entity, ids: string[]) {
  if (ids.some(id => !store[entity].some(r => r.id === id))) throw new Error("Some local test records no longer exist.");
  const contactIds = entity === "merchants" ? store.contacts.filter(c => ids.includes(String(c.merchantId))).map(c => c.id) : entity === "contacts" ? ids : [];
  store[entity] = store[entity].filter(row => !ids.includes(row.id));
  if (entity === "merchants") {
    store.contacts = store.contacts.filter(c => !ids.includes(String(c.merchantId)));
    store.leads = store.leads.filter(l => !ids.includes(String(l.merchantId)));
  }
  if (contactIds.length) {
    store.merchants = store.merchants.map(m => contactIds.includes(String(m.primaryContactId)) ? { ...m, primaryContactId: null } : m);
    store.leads = store.leads.map(l => contactIds.includes(String(l.contactId)) ? { ...l, contactId: null } : l);
  }
}
export function importMerchants(records: RecordData[]) {
  if (!records.length || records.length > 2000) throw new Error("Import between 1 and 2,000 local test merchants.");
  const now = new Date().toISOString();
  const rows = records.map(record => ({ ...record, id: crypto.randomUUID(), primaryContactId: null, createdAt: now, updatedAt: now, ingestedAt: now }));
  rows.forEach(row => validate("merchants", row, store));
  store.merchants = [...store.merchants, ...rows];
  return rows.length;
}
export function exportRecords(entity: Entity, options: ListOptions, selected: string[]) {
  if (!selected.length) return listRecords(entity, { ...options, page: 1, pageSize: store[entity].length || 1 }).rows;
  const rows = store[entity].filter(row => selected.includes(row.id));
  if (rows.length !== selected.length) throw new Error("Some selected local test records no longer exist.");
  return rows.map(row => joined(entity, row));
}
export function reset() { store = seed(); }
