import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { ACTORS, PRODUCTION_PROJECT, createStagingClient, stagingConfig } from "./staging-client.mjs";

const project = "aaaaaaaaaaaaaaaaaaaa";
const origin = `https://${project}.supabase.co`;
const ids = Object.fromEntries(ACTORS.map((actor, i) => [actor, `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`]));
// Deliberately unsigned unit-test inputs. Integration tests must verify real JWTs via staging Auth.
function token(subject, extra = {}) {
  const claims = { sub: subject, iss: `${origin}/auth/v1`, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, ...extra };
  return `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.unit-test-only`;
}
function environment() {
  return {
    MERCHANTIQ_STAGING_PROJECT_REF: project,
    MERCHANTIQ_STAGING_URL: origin,
    MERCHANTIQ_STAGING_PUBLISHABLE_KEY: "sb_publishable_unit_test_only_not_a_real_key",
    MERCHANTIQ_PHASE1_STAGING_CONFIRM: "ISOLATED_STAGING_ONLY",
    ...Object.fromEntries(ACTORS.map(actor => [`MERCHANTIQ_STAGING_${actor.toUpperCase()}_JWT`, token(ids[actor])])),
  };
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

test("missing staging configuration fails before any transport can be constructed", () => {
  assert.throws(() => createStagingClient({}), /staging project reference/);
});

test("production project is always refused, including with staging confirmation", () => {
  assert.throws(() => stagingConfig({ ...environment(), MERCHANTIQ_STAGING_PROJECT_REF: PRODUCTION_PROJECT,
    MERCHANTIQ_STAGING_URL: `https://${PRODUCTION_PROJECT}.supabase.co` }), /non-production/);
});

test("URL aliases, production URL, redirects, credentials and ambiguous origins are refused", () => {
  for (const url of [
    `https://${PRODUCTION_PROJECT}.supabase.co`, `${origin}/`, `${origin}/rest/v1`, `${origin}:443`,
    `${origin}.evil.example`, `https://user:pass@${project}.supabase.co`, `http://${project}.supabase.co`,
  ]) assert.throws(() => stagingConfig({ ...environment(), MERCHANTIQ_STAGING_URL: url }), /exactly match/);
});

test("explicit confirmation and a publishable key are mandatory", () => {
  assert.throws(() => stagingConfig({ ...environment(), MERCHANTIQ_PHASE1_STAGING_CONFIRM: "true" }), /confirmation/);
  for (const key of [undefined, "sb_secret_do_not_use", "eyJ.service_role.token"]) {
    assert.throws(() => stagingConfig({ ...environment(), MERCHANTIQ_STAGING_PUBLISHABLE_KEY: key }), /publishable key/);
  }
});

test("all distinct user JWTs are validated before the first request", () => {
  for (const claims of [
    { iss: `https://${PRODUCTION_PROJECT}.supabase.co/auth/v1` },
    { role: "service_role" }, { role: "anon" }, { exp: 1 }, { sub: "not-a-uuid" }, { sub: ids.admin },
  ]) {
    assert.throws(() => stagingConfig({ ...environment(), MERCHANTIQ_STAGING_SALES_A_JWT: token(ids.sales_a, claims) }), /staging JWT/);
  }
  assert.throws(() => stagingConfig({ ...environment(), MERCHANTIQ_STAGING_DISABLED_JWT: "malformed" }), /Invalid staging user token/);
  assert.throws(() => stagingConfig({ ...environment(), MERCHANTIQ_STAGING_PENDING_JWT: undefined }), /Missing staging user JWT/);
});

test("write RPCs and non-allowlisted tables never reach the transport", () => {
  let requests = 0;
  const client = createStagingClient(environment(), async () => { requests++; return json([]); });
  for (const name of ["crm_add_lead_activity", "crm_manage_user", "crm_import_merchants", "crm_save_scraping_draft", "crm_restore_field", "../auth/v1/admin/users"]) {
    assert.throws(() => client.rpc("admin", name), /write RPCs are blocked/);
  }
  assert.throws(() => client.get("admin", "auth/users"), /allowlist/);
  assert.equal(requests, 0);
});

test("requests use only staging, bounded timeouts, redirect rejection and actor-specific Bearer tokens", async () => {
  const calls = [];
  const env = environment();
  const client = createStagingClient(env, async (url, options) => { calls.push({ url, options }); return json([]); });
  await client.get("sales_a", "contacts", { id: "eq.some-fixture-id" });
  await client.get("anonymous", "contacts");
  await client.rpc("sales_b", "crm_list", { p_entity: "leads" });
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(new URL(call.url).origin, origin);
    assert.equal(call.options.redirect, "error");
    assert.equal(call.options.cache, "no-store");
    assert.ok(call.options.signal instanceof AbortSignal);
  }
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${env.MERCHANTIQ_STAGING_SALES_A_JWT}`);
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.equal(calls[2].options.headers.Authorization, `Bearer ${env.MERCHANTIQ_STAGING_SALES_B_JWT}`);
  assert.equal(calls[2].options.method, "POST");
});

test("Auth verification requires a successful server response for the same subject", async () => {
  const good = createStagingClient(environment(), async () => json({ id: ids.sales_a }));
  assert.equal(await good.verifyUser("sales_a"), ids.sales_a);
  const wrong = createStagingClient(environment(), async () => json({ id: ids.admin }));
  await assert.rejects(wrong.verifyUser("sales_a"), /did not verify/);
  const denied = createStagingClient(environment(), async () => json({ message: "unauthorized" }, 401));
  await assert.rejects(denied.verifyUser("sales_a"), /did not verify/);
});

test("unknown actors, transport failures and HTML responses fail without credential diagnostics", async () => {
  const client = createStagingClient(environment(), async () => { throw new Error("sensitive transport detail"); });
  await assert.rejects(client.get("unknown", "contacts"), /Unknown test actor/);
  await assert.rejects(client.get("sales_a", "contacts"), error => {
    assert.ok(!error.message.includes("sensitive transport detail"));
    return /failed or timed out/.test(error.message);
  });
  const html = createStagingClient(environment(), async () => new Response("<html>not an API</html>"));
  await assert.rejects(html.get("sales_a", "contacts"), /non-JSON/);
});
