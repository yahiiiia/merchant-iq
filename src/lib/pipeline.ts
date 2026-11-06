import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";
import { useSession } from "@/components/SessionProvider";
import { scraperDraftSchema, type ScraperDraft, type ScrapingJob, type ProcessingRun, type PipelineSummary } from "@/lib/pipeline-types";
import type { RecordData } from "@/lib/crm-fields";

export function useScrapingJobs(page: number, status: string, selectedId: string | null) {
  const { isAdmin, session } = useSession();
  const jobs = useQuery({ queryKey: ["pipeline", session?.user.id, "jobs", page, status], enabled: !OFFLINE_PREVIEW && isAdmin, refetchInterval: 15000, queryFn: async () => {
    let query = supabase.from("scraping_jobs").select("*", { count: "exact" }).order("createdAt", { ascending: false }).order("id").range((page - 1) * 20, page * 20 - 1);
    if (status) query = query.eq("status", status);
    const { data, error, count } = await query; if (error) throw error;
    return { rows: data as ScrapingJob[], total: count || 0 };
  } });
  const summary = useQuery({ queryKey: ["pipeline", session?.user.id, "summary"], enabled: !OFFLINE_PREVIEW && isAdmin, refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.rpc("crm_pipeline_summary"); if (error) throw error; return data as PipelineSummary;
  } });
  const selected = useQuery({ queryKey: ["pipeline", session?.user.id, "job", selectedId], enabled: !OFFLINE_PREVIEW && isAdmin && !!selectedId, refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.from("scraping_jobs").select("*").eq("id", selectedId!).single(); if (error) throw error; return data as ScrapingJob;
  } });
  const runs = useQuery({ queryKey: ["pipeline", session?.user.id, "runs", selectedId], enabled: !OFFLINE_PREVIEW && isAdmin && !!selectedId, refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.from("processing_runs").select("*").eq("jobId", selectedId!).order("createdAt", { ascending: false }).order("id").limit(20); if (error) throw error; return data as ProcessingRun[];
  } });
  return { jobs, summary, selected, runs };
}
export function useScraperDraftActions() {
  const cache = useQueryClient();
  const { isAdmin } = useSession();
  const assertAdmin = () => { if (OFFLINE_PREVIEW || !isAdmin) throw new Error("Scraper administration requires a connected, approved Super Admin account."); };
  return {
    async save(input: ScraperDraft) {
      assertAdmin(); const draft = scraperDraftSchema.parse(input);
      const { data, error } = await supabase.rpc("crm_save_scraping_draft", { p_query: draft.query, p_city: draft.city, p_province: draft.province, p_language: draft.language, p_max_results: draft.maxResults });
      if (error) throw error; if (!data) throw new Error("No saved draft ID was returned.");
      await cache.invalidateQueries({ queryKey: ["pipeline"] }); return String(data);
    },
    async remove(id: string) {
      assertAdmin(); const { error } = await supabase.rpc("crm_delete_scraping_draft", { p_id: id }); if (error) throw error;
      await cache.invalidateQueries({ queryKey: ["pipeline"] });
    },
    async importedRows(id: string) {
      assertAdmin(); const rows: RecordData[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("imported_businesses").select("id,source,sourceRecordId,stage,collectedAt,ingestedAt,merchantId,payload").eq("jobId", id).order("ingestedAt").order("id").range(offset, offset + 999);
        if (error) throw error;
        rows.push(...data.map(({ payload, ...record }) => ({ ...record, rawPayload: JSON.stringify(payload) }) as RecordData));
        if (data.length < 1000) break;
      }
      return rows;
    },
  };
}
