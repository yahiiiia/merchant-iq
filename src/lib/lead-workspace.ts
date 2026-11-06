import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";
import type { ListOptions, ListResult } from "@/lib/crm";
import type { LeadActivity, LeadView, Provenance } from "@/lib/pipeline-types";

export async function fetchLeadExplorer(options: ListOptions, view: LeadView): Promise<ListResult> {
  if (OFFLINE_PREVIEW) return (await import("./offline-crm")).exploreLeads(options, view);
  const { data, error } = await supabase.rpc("crm_explore_leads", { p_search: options.search || "", p_filters: options.filters || {}, p_view: view, p_sort: options.sort || "createdAt", p_asc: options.asc || false, p_offset: ((options.page || 1) - 1) * (options.pageSize || 25), p_limit: options.pageSize || 25 });
  if (error) throw error; return data as ListResult;
}
export function useLeadExplorer(options: ListOptions, view: LeadView) {
  const { profile, session } = useSession();
  return useQuery({ queryKey: ["crm", OFFLINE_PREVIEW ? "offline-test-data" : session?.user.id, "explorer", options, view], enabled: OFFLINE_PREVIEW || profile?.status === "approved", queryFn: () => fetchLeadExplorer(options, view) });
}
export function useLeadActivity(leadId: string, page: number) {
  const { profile, session } = useSession();
  return useQuery({ queryKey: ["crm", OFFLINE_PREVIEW ? "offline-test-data" : session?.user.id, "activities", leadId, page], enabled: OFFLINE_PREVIEW || profile?.status === "approved", queryFn: async () => {
    if (OFFLINE_PREVIEW) return (await import("./offline-crm")).leadActivities(leadId, page);
    const { data, error, count } = await supabase.from("lead_activities").select("*", { count: "exact" }).eq("leadId", leadId).order("createdAt", { ascending: false }).order("id", { ascending: false }).range((page - 1) * 10, page * 10 - 1);
    if (error) throw error; return { rows: data as LeadActivity[], total: count || 0 };
  } });
}
export function useAddLeadActivity() {
  const cache = useQueryClient();
  return async (leadId: string, kind: "note" | "call", body: string) => {
    if (!body.trim() || body.trim().length > 5000) throw new Error("Enter between 1 and 5,000 characters.");
    if (OFFLINE_PREVIEW) (await import("./offline-crm")).addLeadActivity(leadId, kind, body.trim());
    else { const { data, error } = await supabase.rpc("crm_add_lead_activity", { p_lead_id: leadId, p_kind: kind, p_body: body.trim() }); if (error) throw error; if (!data) throw new Error("No activity was saved."); }
    await cache.invalidateQueries({ queryKey: ["crm"] });
  };
}
export function useProvenance(merchantId: string) {
  const { profile, session } = useSession();
  return useQuery({ queryKey: ["crm", OFFLINE_PREVIEW ? "offline-test-data" : session?.user.id, "provenance", merchantId], enabled: OFFLINE_PREVIEW || profile?.status === "approved", queryFn: async () => {
    if (OFFLINE_PREVIEW) return null;
    const { data, error } = await supabase.rpc("crm_merchant_provenance", { p_merchant_id: merchantId }); if (error) throw error; return data as Provenance | null;
  } });
}
