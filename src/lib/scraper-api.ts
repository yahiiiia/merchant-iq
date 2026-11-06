import type { z } from "zod";

export const scraperIntegration = {
  state: "awaiting_authenticated_https" as const,
  message: "Waiting for authenticated HTTPS backend integration. No VPS requests are made by this application.",
};

export type ScraperRequest = {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  response: "json" | "blob";
  signal?: AbortSignal;
};
// A future authenticated gateway supplies this transport. No fetch implementation,
// network origin, credentials, or automatic connection is bundled here.
export interface ScraperTransport { request(request: ScraperRequest): Promise<unknown> }
export type ScraperContract<Input, Job, JobList, Health> = {
  createInput: z.ZodType<Input>;
  job: z.ZodType<Job>;
  jobList: z.ZodType<JobList>;
  health: z.ZodType<Health>;
};

export function createScraperApi<Input, Job, JobList, Health>(transport: ScraperTransport, contract: ScraperContract<Input, Job, JobList, Health>) {
  const jobPath = (id: string) => {
    if (!id.trim() || id.length > 500 || id === "." || id === "..") throw new Error("A valid backend job ID is required.");
    return `/scraper/jobs/${encodeURIComponent(id)}`;
  };
  return {
    async listJobs(signal?: AbortSignal): Promise<JobList> {
      return contract.jobList.parse(await transport.request({ method: "GET", path: "/scraper/jobs", response: "json", signal }));
    },
    async createJob(input: Input, signal?: AbortSignal): Promise<Job> {
      const body = contract.createInput.parse(input);
      return contract.job.parse(await transport.request({ method: "POST", path: "/scraper/jobs", body, response: "json", signal }));
    },
    async getJob(id: string, signal?: AbortSignal): Promise<Job> {
      return contract.job.parse(await transport.request({ method: "GET", path: jobPath(id), response: "json", signal }));
    },
    async downloadCsv(id: string, signal?: AbortSignal): Promise<Blob> {
      const value = await transport.request({ method: "GET", path: `${jobPath(id)}/download`, response: "blob", signal });
      if (!(value instanceof Blob)) throw new Error("The backend did not return a download file.");
      return value;
    },
    async health(signal?: AbortSignal): Promise<Health> {
      return contract.health.parse(await transport.request({ method: "GET", path: "/scraper/health", response: "json", signal }));
    },
  };
}
