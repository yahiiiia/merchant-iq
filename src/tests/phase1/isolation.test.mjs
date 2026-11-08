import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, test } from "node:test";
import { ACTORS, createStagingClient } from "./staging-client.mjs";

let api;
let fixtures;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireRows(result) {
  assert.equal(result.ok, true, `Expected an authorized read, received HTTP ${result.status}.`);
  assert.ok(Array.isArray(result.data), "Expected a row-array response.");
  return result.data;
}
function hidden(result) {
  if (!result.ok) {
    assert.ok([401, 403].includes(result.status), `Expected denial, not HTTP ${result.status}.`);
  } else {
    assert.deepEqual(result.data, [], "Unauthorized table read returned rows.");
  }
}
function list(result) {
  assert.equal(result.ok, true, `List RPC failed with HTTP ${result.status}.`);
  assert.ok(Array.isArray(result.data?.rows));
  assert.ok(Number.isInteger(result.data.total) && result.data.total >= 0);
  return result.data;
}
function noOtherData(data, other) {
  const serialized = JSON.stringify(data).toLowerCase();
  for (const marker of [other.workspaceId, other.contactId, other.leadId, other.noteId, ...other.privateMarkers]) {
    assert.equal(serialized.includes(marker.toLowerCase()), false, "Response exposed another workspace's fixture data.");
  }
}

before(async () => {
  // No missing-config skip: an unconfigured integration run fails before any HTTP request.
  api = createStagingClient(process.env);
  assert.ok(process.env.MERCHANTIQ_STAGING_FIXTURES_FILE, "An externally provisioned staging fixture manifest is required.");
  fixtures = JSON.parse(await readFile(process.env.MERCHANTIQ_STAGING_FIXTURES_FILE, "utf8"));
  for (const key of ["sharedMerchantId", "legacyMerchantId", "absentMerchantId"]) assert.match(fixtures[key] || "", uuid);
  assert.equal(new Set([fixtures.sharedMerchantId, fixtures.legacyMerchantId, fixtures.absentMerchantId]).size, 3);
  const childIds = [];
  const markers = [];
  for (const actor of ACTORS) assert.equal(fixtures.actors?.[actor], api.subjects[actor], "Fixture and JWT actor IDs differ.");
  for (const actor of ["sales_a", "sales_b"]) {
    const row = fixtures[actor];
    assert.ok(row, "Both salesperson fixture scopes are required.");
    for (const key of ["workspaceId", "contactId", "leadId", "noteId"]) {
      assert.match(row[key] || "", uuid);
      childIds.push(row[key]);
    }
    assert.ok(Array.isArray(row.privateMarkers) && row.privateMarkers.length >= 2);
    assert.ok(row.privateMarkers.every(value => typeof value === "string" && value.length >= 12));
    markers.push(...row.privateMarkers);
  }
  assert.equal(new Set(childIds).size, childIds.length, "Fixture rows must have distinct IDs.");
  assert.equal(new Set(markers).size, markers.length, "Each private marker must be unique.");
  for (const actor of ACTORS) {
    await api.verifyUser(actor);
    const profile = requireRows(await api.get(actor, "profiles", { id: `eq.${api.subjects[actor]}` }));
    assert.equal(profile.length, 1);
    assert.equal(profile[0].status, ["pending", "disabled"].includes(actor) ? actor : "approved");
    assert.equal(profile[0].role, actor === "admin" ? "super_admin" : "business_user");
  }
  const canonical = requireRows(await api.get("admin", "merchants", { id: `eq.${fixtures.sharedMerchantId}` }));
  const legacy = requireRows(await api.get("admin", "merchants", { id: `eq.${fixtures.legacyMerchantId}` }));
  const absent = requireRows(await api.get("admin", "merchants", { id: `eq.${fixtures.absentMerchantId}` }));
  assert.equal(canonical.length, 1);
  assert.equal(legacy.length, 1);
  assert.equal(absent.length, 0);
  for (const actor of ["sales_a", "sales_b"]) {
    const row = fixtures[actor];
    const workspace = requireRows(await api.get("admin", "merchant_workspaces", { id: `eq.${row.workspaceId}` }));
    assert.equal(workspace.length, 1);
    assert.equal(workspace[0].merchantId, fixtures.sharedMerchantId);
    assert.equal(workspace[0].ownerId, api.subjects[actor]);
    const privateRecords = [...workspace];
    for (const [table, key] of [["contacts", "contactId"], ["leads", "leadId"], ["notes", "noteId"]]) {
      const record = requireRows(await api.get("admin", table, { id: `eq.${row[key]}` }));
      assert.equal(record.length, 1);
      assert.equal(record[0].workspaceId, row.workspaceId);
      if (table !== "notes") assert.equal(record[0].merchantId, fixtures.sharedMerchantId);
      privateRecords.push(...record);
    }
    const privatePayload = JSON.stringify(privateRecords).toLowerCase();
    for (const marker of row.privateMarkers) {
      assert.ok(privatePayload.includes(marker.toLowerCase()), "A configured private marker is absent from its fixture records.");
      assert.equal(JSON.stringify(canonical).toLowerCase().includes(marker.toLowerCase()), false, "A private marker is present in canonical data.");
    }
  }
});

test("anonymous, pending and disabled callers cannot read any business table", async () => {
  for (const actor of ["anonymous", "pending", "disabled"]) {
    for (const table of ["merchants", "merchant_workspaces", "contacts", "leads", "notes", "shared_feed", "record_change_history", "lead_activities", "lead_quality_scores", "scraping_jobs", "imported_businesses", "processing_runs"]) {
      hidden(await api.get(actor, table));
    }
  }
});

test("each salesperson reads its own workspace/children but not the other's, even for the same merchant", async () => {
  for (const [actor, otherActor] of [["sales_a", "sales_b"], ["sales_b", "sales_a"]]) {
    const own = fixtures[actor], other = fixtures[otherActor];
    for (const [table, key] of [["merchant_workspaces", "workspaceId"], ["contacts", "contactId"], ["leads", "leadId"], ["notes", "noteId"]]) {
      const ownRows = requireRows(await api.get(actor, table, { id: `eq.${own[key]}` }));
      assert.equal(ownRows.length, 1);
      noOtherData(ownRows, other);
      hidden(await api.get(actor, table, { id: `eq.${other[key]}` }));
      const mixed = requireRows(await api.get(actor, table, { id: `in.(${own[key]},${other[key]})` }));
      assert.deepEqual(mixed.map(row => row.id), [own[key]], "Selected-ID read exposed a hidden row.");
    }
    hidden(await api.get(actor, "lead_activities", { leadId: `eq.${other.leadId}` }));
    hidden(await api.get(actor, "merchants", { id: `eq.${fixtures.sharedMerchantId}` }));
    hidden(await api.get(actor, "merchants", { id: `eq.${fixtures.legacyMerchantId}` }));
  }
});

test("directory is self-only and selected lead RPC queries reveal neither rows nor counts", async () => {
  for (const [actor, otherActor] of [["sales_a", "sales_b"], ["sales_b", "sales_a"]]) {
    const other = fixtures[otherActor];
    const directory = requireRows(await api.rpc(actor, "crm_user_directory"));
    assert.deepEqual(directory.map(row => row.id), [api.subjects[actor]]);
    const queried = list(await api.rpc(actor, "crm_list", { p_entity: "leads", p_filters: { id: other.leadId } }));
    assert.equal(queried.total, 0);
    assert.deepEqual(queried.rows, []);
    const explored = list(await api.rpc(actor, "crm_explore_leads", { p_filters: { selectedIds: other.leadId } }));
    assert.equal(explored.total, 0);
    assert.deepEqual(explored.rows, []);
  }
});

test("lists, facets, dashboard, search and duplication metadata do not include private fixture markers", async () => {
  for (const [actor, otherActor] of [["sales_a", "sales_b"], ["sales_b", "sales_a"]]) {
    const other = fixtures[otherActor];
    const merchants = list(await api.rpc(actor, "crm_list", { p_entity: "merchants", p_filters: { id: fixtures.sharedMerchantId } }));
    assert.equal(merchants.total, 1, "Expected precisely this user's association, not another owner's copy.");
    assert.equal(merchants.rows.length, 1);
    noOtherData(merchants, other);
    for (const entity of ["merchants", "contacts", "leads"]) {
      const facets = await api.rpc(actor, "crm_filter_options", { p_entity: entity });
      assert.equal(facets.ok, true);
      noOtherData(facets.data, other);
      const searched = list(await api.rpc(actor, "crm_list", { p_entity: entity, p_search: other.privateMarkers[0] }));
      assert.equal(searched.total, 0);
      assert.deepEqual(searched.rows, []);
    }
    const dashboard = await api.rpc(actor, "crm_dashboard");
    assert.equal(dashboard.ok, true);
    noOtherData(dashboard.data, other);
  }
});

test("hidden and absent merchant provenance have indistinguishable responses", async () => {
  for (const actor of ["sales_a", "sales_b"]) {
    const hiddenResult = await api.rpc(actor, "crm_merchant_provenance", { p_merchant_id: fixtures.legacyMerchantId });
    const absentResult = await api.rpc(actor, "crm_merchant_provenance", { p_merchant_id: fixtures.absentMerchantId });
    for (const result of [hiddenResult, absentResult]) {
      assert.ok(result.ok || [401, 403].includes(result.status), "Unexpected server/missing-function error.");
      if (result.ok) assert.equal(result.data, null, "Unauthorized provenance must not be returned.");
    }
    assert.equal(hiddenResult.status, absentResult.status);
    assert.deepEqual(hiddenResult.data, absentResult.data);
  }
});

test("raw imports, processing, quality evidence and scraper summaries stay administrator-only", async () => {
  for (const actor of ["sales_a", "sales_b"]) {
    for (const table of ["scraping_jobs", "imported_businesses", "processing_runs", "lead_quality_scores"]) hidden(await api.get(actor, table));
    const summary = await api.rpc(actor, "crm_pipeline_summary");
    assert.equal(summary.ok, false);
    assert.ok([401, 403].includes(summary.status));
  }
  const adminSummary = await api.rpc("admin", "crm_pipeline_summary");
  assert.equal(adminSummary.ok, true);
  for (const actor of ["sales_a", "sales_b"]) {
    assert.equal(requireRows(await api.get("admin", "merchant_workspaces", { id: `eq.${fixtures[actor].workspaceId}` })).length, 1);
  }
});
