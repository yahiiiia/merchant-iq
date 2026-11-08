import { Buffer } from "node:buffer";

export const PRODUCTION_PROJECT = "eujbgwltfdiwqatnvmik";
export const ACTORS = ["admin", "sales_a", "sales_b", "pending", "disabled"];
const TABLES = new Set([
  "profiles", "merchants", "merchant_workspaces", "contacts", "leads", "notes",
  "shared_feed", "record_change_history", "lead_activities", "lead_quality_scores",
  "scraping_jobs", "imported_businesses", "processing_runs",
]);
const READ_RPCS = new Set([
  "crm_list", "crm_dashboard", "crm_filter_options", "crm_explore_leads",
  "crm_user_directory", "crm_merchant_provenance", "crm_pipeline_summary",
]);

function decodeJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error();
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) throw new Error();
    return claims;
  } catch {
    throw new Error("Invalid staging user token; token contents are not logged.");
  }
}

export function stagingConfig(env) {
  const project = env.MERCHANTIQ_STAGING_PROJECT_REF;
  if (!/^[a-z0-9]{20}$/.test(project || "") || project === PRODUCTION_PROJECT) {
    throw new Error("An explicit non-production staging project reference is required.");
  }
  if (env.MERCHANTIQ_PHASE1_STAGING_CONFIRM !== "ISOLATED_STAGING_ONLY") {
    throw new Error("Explicit isolated-staging confirmation is required.");
  }
  const origin = `https://${project}.supabase.co`;
  if (env.MERCHANTIQ_STAGING_URL !== origin) {
    throw new Error("Staging URL must exactly match the confirmed hosted staging project.");
  }
  const apiKey = env.MERCHANTIQ_STAGING_PUBLISHABLE_KEY;
  if (!apiKey?.startsWith("sb_publishable_") || apiKey.length < 20) {
    throw new Error("Use a staging publishable key, never a secret/service-role key.");
  }
  const tokens = {};
  const subjects = new Set();
  for (const actor of ACTORS) {
    const token = env[`MERCHANTIQ_STAGING_${actor.toUpperCase()}_JWT`];
    if (!token) throw new Error(`Missing staging user JWT for ${actor}.`);
    const claims = decodeJwt(token);
    if (claims.iss !== `${origin}/auth/v1` || claims.role !== "authenticated" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.sub || "") ||
        !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000 || subjects.has(claims.sub)) {
      throw new Error(`Wrong-project, expired, privileged or duplicate staging JWT for ${actor}.`);
    }
    subjects.add(claims.sub);
    tokens[actor] = { token, subject: claims.sub };
  }
  return { origin, apiKey, tokens };
}

export function createStagingClient(env, transport = globalThis.fetch) {
  const config = stagingConfig(env);
  async function request(actor, path, method = "GET", body) {
    if (actor !== "anonymous" && !ACTORS.includes(actor)) throw new Error("Unknown test actor.");
    const headers = { apikey: config.apiKey, Accept: "application/json" };
    if (actor !== "anonymous") headers.Authorization = `Bearer ${config.tokens[actor].token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response;
    try {
      response = await transport(`${config.origin}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error("Staging request failed or timed out; request credentials are not logged.");
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Staging returned a non-JSON response; no response body was logged.");
    }
    return { ok: response.ok, status: response.status, data: await response.json() };
  }
  return {
    subjects: Object.fromEntries(ACTORS.map(actor => [actor, config.tokens[actor].subject])),
    async verifyUser(actor) {
      if (!ACTORS.includes(actor)) throw new Error("A real staging user is required.");
      const result = await request(actor, "/auth/v1/user");
      if (!result.ok || result.data.id !== config.tokens[actor].subject) {
        throw new Error(`Staging Auth did not verify the ${actor} identity.`);
      }
      return result.data.id;
    },
    get(actor, table, parameters = {}) {
      if (!TABLES.has(table)) throw new Error("Table is outside the read-only staging test allowlist.");
      const query = new URLSearchParams({ select: "*", limit: "1000", ...parameters });
      return request(actor, `/rest/v1/${table}?${query}`);
    },
    rpc(actor, name, parameters = {}) {
      if (!READ_RPCS.has(name)) throw new Error("Only inspected read RPCs are allowed; write RPCs are blocked.");
      return request(actor, `/rest/v1/rpc/${name}`, "POST", parameters);
    },
  };
}
