import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/SessionProvider";
import { createScraperApi } from "@/lib/scraper-api";
import { scraperTransport } from "@/lib/scraper-transport";
import { scraperCreateSchema, scraperResponseSchema, type ScraperCreateInput } from "@/lib/scraper-contract";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";

const api = createScraperApi(scraperTransport, {
  createInput: scraperCreateSchema,
  job: scraperResponseSchema,
  jobList: scraperResponseSchema,
  health: scraperResponseSchema,
});

export function useLiveScraper(selectedId: string | null) {
  const { isAdmin, session } = useSession();
  const cache = useQueryClient();
  const enabled = !OFFLINE_PREVIEW && isAdmin;
  const prefix = ["scraper-api", session?.user.id];
  const jobs = useQuery({
    queryKey: [...prefix, "jobs"], enabled, retry: false,
    refetchInterval: 15000, refetchIntervalInBackground: false,
    queryFn: ({ signal }) => api.listJobs(signal),
  });
  const details = useQuery({
    queryKey: [...prefix, "job", selectedId], enabled: enabled && !!selectedId,
    retry: false, refetchInterval: 15000, refetchIntervalInBackground: false,
    queryFn: ({ signal }) => api.getJob(selectedId!, signal),
  });
  const assertAdmin = () => {
    if (!enabled) throw new Error("A connected, approved Super Admin account is required.");
  };
  return {
    jobs, details,
    async launch(input: ScraperCreateInput) {
      assertAdmin();
      // Never retry POST: an interrupted response may still have created a job.
      const result = await api.createJob(input);
      void cache.invalidateQueries({ queryKey: prefix });
      return result;
    },
    async download(id: string) {
      assertAdmin();
      const blob = await api.downloadCsv(id);
      if (!blob.size) throw new Error("The backend returned an empty file. Check the job details before retrying.");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `MerchantIQ-Gosom-${id}.csv`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}
