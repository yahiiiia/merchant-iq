import { supabase } from "@/integrations/supabase/client";
import type { ScraperTransport } from "@/lib/scraper-api";

const API_URL = "https://api.merchanthq.tech";

export const scraperTransport: ScraperTransport = {
  async request({ method, path, body, response = "json", signal }) {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session?.access_token) {
      throw new Error("Please sign in to use the scraper.");
    }

    const result = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });

    if (!result.ok) {
      const message = await result.text();
      throw new Error(`Scraper API (${result.status}): ${message}`);
    }

    return response === "blob" ? result.blob() : result.json();
  },
};
