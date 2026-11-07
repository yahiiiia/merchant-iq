import { supabase } from "@/integrations/supabase/client";
import type { ScraperTransport } from "@/lib/scraper-api";
import { OFFLINE_PREVIEW } from "@/lib/offline-preview";

const API_URL = "https://api.merchanthq.tech";

export class ScraperHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message); this.name = "ScraperHttpError";
  }
}

export const scraperTransport: ScraperTransport = {
  async request({ method, path, body, response = "json", signal }) {
    if (OFFLINE_PREVIEW) throw new Error("Live scraper requests are disabled in offline preview.");
    if (!/^\/scraper\/(health|jobs(?:\/[0-9a-f-]{36}(?:\/download)?)?)$/i.test(path)) throw new Error("Unsupported scraper API path.");
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Please sign in to use the scraper.");

    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = window.setTimeout(abort, response === "blob" ? 120000 : 30000);
    try {
      const result = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        redirect: "error",
      });
      if (!result.ok) {
        const message = result.status === 401 ? "Your session was rejected. Sign in again." : result.status === 403 ? "Approved Super Admin access is required." : result.status === 422 ? "The backend rejected the request fields. Review the job settings." : result.status === 404 ? "Job or download not found. Refresh job details." : "The request could not be completed. Check job details before retrying.";
        throw new ScraperHttpError(result.status, `Scraper API (${result.status}): ${message}`);
      }
      if (response === "blob") {
        const type = result.headers.get("content-type") || "";
        if (/json|text\/html/i.test(type)) throw new Error("The backend returned JSON or HTML instead of the original CSV. The file may not be ready.");
        return await result.blob();
      }
      return await result.json();
    } finally {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  },
};
