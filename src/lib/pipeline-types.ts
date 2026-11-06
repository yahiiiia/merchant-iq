import { z } from "zod";
import { provinces } from "@/lib/crm-fields";

export const processingStages = ["Raw", "Cleaned", "Validated", "Qualified"] as const;
export type ProcessingStage = typeof processingStages[number];
export const scraperDraftSchema = z.object({
  query: z.string().trim().min(2).max(500), city: z.string().trim().min(2).max(120),
  province: z.string().refine(value => provinces.includes(value), "Choose a Canadian province or territory."),
  language: z.enum(["en", "fr"]), maxResults: z.number().int().min(1).max(10000),
});
export type ScraperDraft = z.infer<typeof scraperDraftSchema>;
export type ScrapingJob = ScraperDraft & {
  id: string; country: string; status: "draft" | "queued" | "running" | "completed" | "failed" | "cancelled";
  createdBy: string | null; externalJobId: string | null; resultCount: number | null;
  errorMessage: string | null; startedAt: string | null; finishedAt: string | null; createdAt: string; updatedAt: string;
};
export type ProcessingRun = { id: string; jobId: string | null; fromStage: ProcessingStage; toStage: ProcessingStage; status: string; processorVersion: string; inputCount: number | null; outputCount: number | null; errorMessage: string | null; createdAt: string };
export type PipelineSummary = { stages: Partial<Record<ProcessingStage, number>>; jobs: number; drafts: number; running: number; lastUpdate: string | null };
export type LeadActivity = { id: string; leadId: string; actorId: string | null; kind: "created" | "updated" | "note" | "call"; body: string; changes: Record<string, { before: unknown; after: unknown }>; createdAt: string };
export type Provenance = { source: string; sourceRecordId: string; stage: ProcessingStage; collectedAt: string | null; ingestedAt: string };
export type LeadView = "all" | "available" | "mine" | "due";
