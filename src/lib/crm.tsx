import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { fieldsFor, type Entity, type RecordData } from "@/lib/crm-fields";
export * from "@/lib/crm-fields";

export type ListOptions = { search?: string; filters?: Record<string, string>; sort?: string; asc?: boolean; page?: number; pageSize?: number };
export type ListResult = { rows: RecordData[]; total: number };
export type Dashboard = { merchants: number; contacts: number; leads: number; phone: number; email: number; industries: { name: string; count: number }[]; provinces: { name: string; count: number }[]; leadCounts: Record<string, number>; recent: RecordData[] };
export async function fetchRecords(entity: Entity, options: ListOptions = {}): Promise<ListResult> {
  const { search = "", filters = {}, sort = "createdAt", asc = false, page = 1, pageSize = 25 } = options;
  const { data, error } = await supabase.rpc("crm_list", { p_entity: entity, p_search: search, p_filters: filters, p_sort: sort, p_asc: asc, p_offset: (page - 1) * pageSize, p_limit: pageSize });
  if (error) throw error;
  return data as ListResult;
}
export function useRecords(entity: Entity, options: ListOptions = {}, enabled = true) {
  const { session, profile } = useSession();
  return useQuery({ queryKey: ["crm", session?.user.id, "list", entity, options], queryFn: () => fetchRecords(entity, options), enabled: enabled && profile?.status === "approved" });
}
export function useRecord(entity: Entity, id?: string) {
  const { session, profile } = useSession();
  return useQuery({ queryKey: ["crm", session?.user.id, "record", entity, id], enabled: !!id && profile?.status === "approved", queryFn: async () => {
    const result = await fetchRecords(entity, { filters: { id: id! }, pageSize: 1 });
    return result.rows[0] || null;
  } });
}
export function useDashboard() {
  const { session, profile } = useSession();
  return useQuery({ queryKey: ["crm", session?.user.id, "dashboard"], enabled: profile?.status === "approved", queryFn: async () => {
    const { data, error } = await supabase.rpc("crm_dashboard"); if (error) throw error; return data as Dashboard;
  } });
}
export function useFilterOptions(entity: Entity) {
  const { session, profile } = useSession();
  return useQuery({ queryKey: ["crm", session?.user.id, "filters", entity], enabled: profile?.status === "approved", queryFn: async () => {
    const { data, error } = await supabase.rpc("crm_filter_options", { p_entity: entity }); if (error) throw error; return data as Record<string, string[]>;
  } });
}
export function useUserDirectory() {
  const { session, profile } = useSession();
  return useQuery({ queryKey: ["crm", session?.user.id, "directory"], enabled: profile?.status === "approved", queryFn: async () => {
    const { data, error } = await supabase.rpc("crm_user_directory"); if (error) throw error; return data as { id: string; name: string }[];
  } });
}
export function cleanRecord(entity: Entity, record: RecordData) {
  const result: Record<string, string | number | null> = {};
  for (const field of fieldsFor(entity)) {
    const value = record[field.key];
    if (value === undefined) continue;
    result[field.key] = value === "" || value === null ? null : field.type === "number" ? Number(value) : String(value).trim();
  }
  // Optional selects map to database defaults; arbitrary extra form fields are never sent.
  if (entity === "merchants") { result.country ||= "Canada"; result.status ||= "Unknown"; result.quality ||= "Unverified"; }
  if (entity === "contacts") result.type ||= "Other";
  if (entity === "leads") { result.status ||= "New"; result.priority ||= "Medium"; }
  return result;
}
export function useCRM() {
  const client = useQueryClient();
  const { isAdmin } = useSession();
  const invalidate = () => client.invalidateQueries({ queryKey: ["crm"] });
  async function save(entity: Entity, record: RecordData, editing = false) {
    const values = cleanRecord(entity, record);
    const query = editing ? supabase.from(entity).update(values).eq("id", record.id) : supabase.from(entity).insert({ ...values, id: record.id });
    const { data, error } = await query.select("id").single();
    if (error) throw error;
    if (!data) throw new Error("The record was not saved. Verify your account permissions.");
    await invalidate();
  }
  async function remove(entity: Entity, ids: string[]) {
    if (!isAdmin) throw new Error("Only Super Admins can delete records.");
    const { data, error } = await supabase.from(entity).delete().in("id", ids).select("id");
    if (error) throw error;
    if (data.length !== ids.length) { await invalidate(); throw new Error("Some records were unavailable or could not be deleted. Refresh the directory."); }
    await invalidate();
  }
  async function importMerchants(records: RecordData[]) {
    if (!isAdmin) throw new Error("Only Super Admins can import merchants.");
    const { data, error } = await supabase.rpc("crm_import_merchants", { records: records.map(r => cleanRecord("merchants", r)) });
    if (error) throw error;
    await invalidate(); return Number(data);
  }
  return { save, remove, importMerchants };
}
export async function exportRecords(entity: Entity, options: ListOptions, selected: string[]): Promise<RecordData[]> {
  if (selected.length) {
    const records: RecordData[] = [];
    for (let i = 0; i < selected.length; i += 200) {
      const { data, error } = await supabase.from(entity).select("*").in("id", selected.slice(i, i + 200));
      if (error) throw error; records.push(...data as RecordData[]);
    }
    if (records.length !== selected.length) throw new Error("Some selected records are no longer available. Refresh and select again.");
    return records;
  }
  const records: RecordData[] = [];
  for (let page = 1; ; page++) {
    const result = await fetchRecords(entity, { ...options, page, pageSize: 1000 });
    records.push(...result.rows);
    if (records.length >= result.total || !result.rows.length) break;
  }
  return records;
}
