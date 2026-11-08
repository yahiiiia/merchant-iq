# Phase 1 — ownership, RLS, Shared Feed and audit discovery

## Status and review boundary

**Discovery and proposed design only. Phase 1 is not implemented.** No schema, policy, grant, function, business record, account, frontend behavior, scraper API, infrastructure or deployment was changed during this audit. This document is the only file added by this audit.

- Requested repository: `yahiiiia/merchant-iq`.
- Attachment/conversation baseline: `97578c39e05eb4fc20498ca6e6f4f2d5abd957e6`.
- Actual latest GitHub SHA, local HEAD, branch and outstanding worktree changes: **not independently verified**. This session has file tools but no Git fetch/status or command runner. The supplied baseline is not proof of current HEAD. Verify these before implementation; do not reset, overwrite or force-push.
- Live connected Supabase project inspected: `eujbgwltfdiwqatnvmik`. Treat it as production for approval and safety purposes.
- Evidence: live schema/functions/policies/constraints/indexes; SELECT-only PostgreSQL catalog inspection of effective grants, function EXECUTE privileges, RLS flags, actual trigger attachments and aggregate counts; frontend source inspection.
- No executable migration or fixture test was applied. Production-change approval, backup and rollback review are still required. Inspecting an empty table is not an isolation test.

## 1. Verified live state

### Tables and access

Nine public tables exist. All have RLS enabled, are owned by `postgres`, and do not FORCE RLS. The table owner and trusted service role therefore must not be treated as ordinary RLS-constrained application users. No public views, materialized views or foreign tables were returned by catalog discovery. No relations were returned in `supabase_migrations`; do not assume a migration ledger exists or that repository state describes the live database.

| Table | Effective authenticated grants | Existing row policy / behavior |
| --- | --- | --- |
| `profiles` | SELECT | Self or approved Super Admin; no direct authenticated profile writes |
| `merchants` | SELECT, INSERT, UPDATE, DELETE | Every approved account reads/inserts/updates every row; only approved Super Admin deletes |
| `contacts` | SELECT, INSERT, UPDATE, DELETE | Same permissive business policies as merchants |
| `leads` | SELECT, INSERT, UPDATE, DELETE | Same permissive business policies as merchants |
| `lead_activities` | SELECT | Every approved account reads every activity; checked RPC/trigger writes |
| `lead_quality_scores` | SELECT | Every approved account reads every score and its evidence |
| `scraping_jobs` | SELECT | Approved Super Admin reads; draft RPCs write |
| `imported_businesses` | SELECT | Approved Super Admin reads; backend writes |
| `processing_runs` | SELECT | Approved Super Admin reads; backend writes |

`anon` has no table CRUD privileges on these nine tables. `service_role` has CRUD and TRUNCATE privileges; authenticated users do not have TRUNCATE. RLS policy checks are still required even where table-level privileges exist. Authenticated DELETE privileges on the three CRM tables do not themselves let business users delete because DELETE RLS requires admin approval.

### Aggregate counts observed during this audit

These are point-in-time observations from the connected project, not ongoing metrics or an assertion about external FastAPI job storage:

- 3 profiles: 2 approved Super Admins and 1 disabled Business User.
- 0 merchants, 0 contacts, 0 leads.
- 1 scraping-job record with a non-null creator. The count does not establish its status or its correspondence to live FastAPI jobs.
- 0 imported businesses, processing runs, quality scores or lead activities.

No profile identifiers, names, emails or business contents were needed for this report. Counts must be refreshed during preflight: future writes could create legacy records before rollout. Empty business tables reduce current backfill volume; they do not justify destructive migration or skipping quarantine logic.

### Identity, constraints and lifecycle

- Roles remain exactly `super_admin` and `business_user`; approval states remain `pending`, `approved`, `disabled`.
- The enabled `merchantiq_auth_signup` trigger on `auth.users` invokes `crm_new_user`, which creates a pending Business User independently of signup privilege metadata.
- `crm_access` checks the current profile through `auth.uid()`; it is an approval/admin helper, not an ownership helper.
- `leads."assignedUser"` is nullable and references profiles with ON DELETE SET NULL. It is the only current salesperson-assignment field on the three CRM tables, not proof of merchant/contact ownership.
- Merchant deletion cascades to contacts/leads; lead deletion cascades to activities. Activity actor deletion sets `actorId` NULL. Current activity is not a permanent independent audit trail.
- Composite `(contactId, merchantId)` and primary-contact constraints enforce merchant/contact consistency. UUIDs, immutable record IDs, existing foreign keys, timestamps, valid sales statuses and nullable/nonnegative processing-volume semantics must survive the rollout.
- `crm_contact_move` is an enabled SECURITY DEFINER trigger: moving a contact clears lead contact links and merchant primary-contact links. This needs explicit workspace boundaries before contacts can belong to different owners of the same merchant.
- There are no workspace associations, Shared Feed publications, dedicated private notes, permanent field-history table or field-restore RPC in the live public schema.

### Function security and EXECUTE grants

All inspected `crm_*` definer functions use an empty `search_path`. Stateful business RPCs have no anonymous or PUBLIC EXECUTE privilege. Trigger functions are not API-executable. The pure `crm_normalize(text)` helper has PUBLIC EXECUTE and reads no business records.

`rls_auto_enable()` has PUBLIC EXECUTE and `search_path=pg_catalog`. It is an event-trigger function, not a normal business-data RPC; this finding alone is not evidence of an anonymous data-access exploit. Any tightening should be separately reviewed against its platform-managed purpose.

Service-role table CRUD does not imply service-role execution of all business RPCs: for example, `crm_access`, `crm_list`, `crm_dashboard`, `crm_user_directory`, `crm_import_merchants` and `crm_manage_user` do not grant it EXECUTE, whereas several pipeline RPCs do. Do not blanket-grant all functions or assume a service-role-only request provides a verified human `auth.uid()`.

## 2. Findings against the new requirements

| Priority | Finding | Consequence / required correction |
| --- | --- | --- |
| Blocker | Business policies use only `crm_access()` | Any approved salesperson would read/update other salespeople's private CRM data; replace policies, not just UI filters |
| Blocker | No merchant/contact ownership boundary | Lead assignment alone cannot isolate contacts, corrections, processing details or notes |
| Blocker | `crm_add_lead_activity` is definer and checks approval plus lead existence only | Owner RLS alone would not prevent cross-user notes/call updates through this RPC; explicitly scope authorization before existence/write checks |
| Blocker | `crm_merchant_provenance` is definer and checks approval only | It can return import provenance for a supplied merchant ID despite staging RLS; scope to an authorized workspace and redact internal provenance |
| High | `crm_user_directory` returns all approved user IDs/display names, with email fallback | Salespeople can enumerate other accounts; salesperson directory must be self-only, full directory admin-only |
| High | `crm_validate_assignment` checks assignee approval only | Salespeople may choose/reassign another approved account; require self-derived ownership, admin-only transfers and consistent child scopes |
| High | `crm_list`, dashboard, facets and Explorer use the shared model | Counts, recent records, duplicate flags, search hits, joins and exports all need the same ownership scope |
| High | Quality scores/evidence and activity SELECT policies are approved-user-wide | Direct table requests can expose data even if Explorer is filtered |
| High | `crm_contact_move` performs privileged cross-row updates | An owner-scoped contact move must never clear another workspace's references |
| High | Existing activity cascades on lead deletion and omits merchant/contact edits | It cannot satisfy retained field history, note edits/deletes or audited restore |
| Missing | Shared Feed and private/canonical separation do not exist | Publishing existing merchant rows directly would expose private columns or conflicting salesperson corrections |

These are verified policy/source findings, not results of newly executed impersonation, HTTP or concurrency tests. The zero business-record count does not make the current authorization model compliant.

## 3. Current-to-target compatibility map

Proposed relation name: **`merchant_workspaces`**. This is a design proposal, not a claim that these columns or relations exist.

| Current object / fields | Proposed destination and compatibility rule |
| --- | --- |
| `profiles` and Auth users | Preserve IDs, role/approval model, signup trigger, checked management RPC and last-admin protection |
| `merchants.id` and public business identity fields | Preserve canonical IDs and existing columns initially; canonical raw table becomes admin-only to regular salespeople because it also contains legacy private fields |
| Merchant name, industry, business phone/email, website and address corrections | Workspace-specific typed overrides or strictly allowlisted overrides; distinguish absent override from an explicit NULL/cleared field; never write one salesperson's correction into another's account |
| `primaryContactId`, processor, POS, `processingNotes`, `notes`, `estimatedVolume`, `confirmedVolume` | Workspace-private values; retain original legacy values for admin reconciliation rather than dropping/reinterpreting them |
| Monthly volumes | Preserve estimated versus confirmed card values; add explicit CAD/month semantics and separately identified cash values with observed/estimated provenance. No invented values; unknown remains NULL |
| New workspace relation | UUID ID, canonical merchant link, owner, trusted creator/time and private sales details; unique owner/merchant association permits A and B to own distinct workspaces for the same merchant |
| `contacts` | Preserve existing IDs and `merchantId`; add workspace linkage with database-enforced workspace/merchant consistency. Contacts remain actual named people, not manufactured from business phone/email |
| `leads` | Preserve IDs, `merchantId`, statuses and valid contact relationships; add workspace linkage. Opportunity ownership derives from workspace and cannot be changed by editing `assignedUser` |
| Existing notes text / activity notes | Preserve originals; do not invent authors/timestamps or retroactively assert history. Migrate only with explicit legacy provenance and owner resolution |
| New private `notes` | Workspace association, optional scoped entity, author/time and soft deletion; edits/deletions produce field-history events |
| New `shared_feed` | Admin-controlled publication with a frozen allowlisted business snapshot and trusted publication/unpublication actor/time; no contacts, notes, volumes, activity, private owners or raw source payload |
| `lead_activities` | Preserve events and IDs; owner/admin reads through the linked workspace; keep separate from permanent field history |
| New `record_change_history` | Append-only field changes for workspace details/overrides, contacts, leads and notes; retain beyond parent deletion, including stable actor identifier and event/correlation metadata |
| New restore operation | Checked owner/admin RPC; allowlisted fields and compatible types only; restoration creates a fresh audited update, never rewrites history |
| `lead_quality_scores` | Do not expose raw global evidence or account-derived sales priority to every owner of a canonical merchant. Keep admin-only until safe workspace-scoped evidence/score projection is defined |
| `scraping_jobs`, `imported_businesses`, `processing_runs` | Preserve current admin-only operation and raw provenance; accommodate explicit verified ownership/workspace linkage without turning `createdBy` into guessed ownership or changing API/ingestion behavior |

### Legacy quarantine and relationships

- Unknown ownership remains admin-only legacy/unassigned visibility. Do not infer ownership from assignees, latest editors, creator names or matching emails. A lead assignee is evidence for admin review, not automatic merchant ownership.
- Add nullable workspace links for existing child rows so unresolved records remain intact. New user-facing writes require an authorized workspace through checked writes and database constraints. Admin legacy management must not accidentally publish records.
- Preserve merchant, contact and lead IDs and existing FK guarantees. Add workspace/merchant and contact/workspace consistency constraints; assess constraint validation and trigger ordering before applying anything. Do not drop old constraints merely to make backfill pass.
- Multiple owners never share a primary-contact reference, private note, lead status or processing detail. References from one workspace to another are rejected even when the canonical merchant matches.
- Owner transfers require an explicit audited administrator operation and a defined policy for historical visibility. Initial proposal: history follows the current workspace owner, with former-owner access removed; retain original actor IDs. Review this rule before implementing transfer.
- Do not cascade-delete permanent history on workspace/entity/profile deletion. Use stable recorded UUIDs/tombstones rather than an audit actor FK that silently nulls identity. Retention proposal: no automatic purge in Phase 1; any later retention/deletion policy needs explicit approval.

### Shared Feed safety

Proposed public snapshot keys: business name, industry/category, website, business phone, business email, street address, city, province, postal code and country. These must be deliberately selected as public business fields, not copied with `SELECT *` or `to_jsonb(merchants)`. Exclude named contacts/personal contact details, internal notes, source record IDs, provenance payloads, processing/card/cash volumes, sales status/priority, owners and publication actor metadata from the salesperson-facing projection.

“Public” means available to approved CRM accounts through Shared Feed, **not anonymous internet access**. Internal publication audit metadata stays admin-only. Published snapshots remain stable until explicitly updated or unpublished by an admin; enrichment does not silently refresh them. Use a scoped, allowlisted RPC/projection rather than relying on RLS to hide columns. RLS limits rows, not fields.

Add-to-workspace validates an active publication in the database, derives owner from `auth.uid()`, creates only the caller's association and is idempotent for that caller. It neither creates a lead automatically nor reserves/removes the publication. Return no other owners/counts. Unpublishing removes feed visibility without deleting existing private workspaces. Verify transaction locking for add-versus-unpublish races.

Canonical deduplication must never expose another account's private presence through UUID lookup, duplicate flags, uniqueness errors or a globally searchable canonical table. Regular users cannot attach arbitrary unpublished canonical IDs. Private manual creation must return only the caller's authorized workspace projection; cross-account deduplication, if introduced, is trusted server work without an existence oracle.

## 4. Proposed access matrix

All salesperson/admin permissions require current approved profile state. Pending/disabled accounts may still read their own profile for the account-status screen, but no business data.

| Resource/action | Anonymous / pending / disabled | Approved Business User | Approved Super Admin |
| --- | --- | --- | --- |
| Raw canonical merchants and unresolved legacy | No | No direct access | Global read/manage |
| Private workspace/business projection | No | Own only; create/edit own | Global, with owner filter |
| Contacts, private notes, sales details, leads | No | Own workspace only | Global read/edit/export/manage |
| Activity and permanent history reads | No | Own workspace only | Global |
| History insert/update/delete | No | No direct writes | No ordinary direct mutation; trusted triggers only |
| Field restore | No | Own, allowlisted editable fields only | Global, allowlisted fields; new audit event |
| Feed public snapshot | No | Published allowlisted fields only | Global publication oversight |
| Publish/unpublish | No | No | Checked admin RPC only |
| Add published business to own workspace | No | Yes, owner derived from caller | Yes with explicit authorized context |
| Transfer ownership / manage another owner | No | No | Checked and audited admin operation |
| Directory / salesperson filter | No business directory | Self only | Approved-user directory/global filters |
| Hard delete CRM records / admin CSV import | No | No | Preserve admin-only boundary; audit retained |
| Scraper API, drafts, raw imports, processing | No | No | Existing approved-admin boundary unchanged |

A service key bypasses ordinary RLS by design. It is not an authorization shortcut. Human-initiated backend writes should use the verified user's JWT and checked RPCs wherever possible. Privileged backend work must authenticate the principal, recheck current profile/ownership and record verified actor context; fail closed when required context is missing. Do not accept arbitrary owner/actor/publisher fields from browser input or trust client-editable metadata/custom settings as proof of identity. No unverified backend principal flow is introduced in this phase.

## 5. Query/RPC and frontend adaptation inventory

| Existing path | Required adaptation after DB acceptance tests pass |
| --- | --- |
| `src/lib/crm.tsx`: `fetchRecords`, `useRecord` → `crm_list` | Return scoped workspace projection under compatible field names; keep search/sort/pagination. No raw merchant `to_jsonb(t)` for reps |
| `useDashboard` → `crm_dashboard`; `src/pages/Index.tsx` | Owner-scoped totals, recent rows and charts; admin global/owner scope, including intentional canonical-vs-workspace count semantics |
| `useFilterOptions` → `crm_filter_options` | Facets from authorized workspace rows only; no values from another account or unpublished legacy inventory |
| `useUserDirectory` → `crm_user_directory` | Self-only for reps; global directory/admin owner filters only for approved admins; no email fallback exposure to other reps |
| `useCRM.save` direct insert/update | Scoped writes/RPCs split canonical identity from private workspace overrides; server controls ownership, relationship validation and attribution |
| `useCRM.remove` direct delete | Keep admin-only deletion, review cross-owner canonical cascade impact and preserve independent audit history |
| `crm_import_merchants` | Remain admin-only; explicit destination/quarantine, preserve transactional validation and NULL volumes; no silent sharing or implicit owner assignment |
| `exportRecords`: selected `.select('*')` and filtered batching | Both must use the same safe scoped projection; no raw canonical-table export shortcut |
| `src/lib/lead-workspace.ts` → `crm_explore_leads` | Scope all joins, count, selected IDs, facets and scores; “all” means own for reps/global for admins. “available” must not reveal legacy unassigned opportunities and is not Shared Feed |
| `useLeadActivity` direct activity SELECT | Workspace-scoped row policy, including counts; checked activity RPC authorizes ownership before writes |
| `useProvenance` → `crm_merchant_provenance` | Check workspace access before lookup, return only permitted provenance; unauthorized and absent IDs must not become an existence oracle |
| `Records.tsx`, `LeadExplorer.tsx` | Preserve directories and exports; admin salesperson filters; self scope for reps; update shared-database duplicate wording only alongside real backend changes |
| `RecordDetail.tsx` | Fetch one authorized workspace's contacts/leads/private fields, not all children of the canonical merchant |
| `RecordEditor.tsx`, `RecordPicker.tsx` | Workspace-scoped selection, counts and child links; no other-user assignment; no direct canonical writes for private corrections |
| Existing `/merchants/:id`, `/contacts/:id`, `/leads/:id` | Preserve IDs/routes. Merchant ID remains canonical; resolve caller's association server-side. Admin needs explicit workspace context when multiple owners exist; never select an arbitrary owner's private fields |
| `SessionProvider.tsx`, guards, Access, auth routes | Preserve auth/approval model; clear sensitive query caches when role/approval changes, not just sign-out; guard against stale in-flight responses when scope changes |
| `pipeline.ts`, pipeline overview and stored-import exports | Keep admin-only and raw provenance private; accommodate ownership metadata without enabling sales-rep scraper access |
| `scraper-jobs.ts`, transport/API abstraction and scraper UI | Preserve existing admin-only JWT requests/downloads, units, no-auto-retry behavior and offline blocking; no backend/container modifications |

The authenticated scraper backend source is not present in the listed workspace. Server-side JWT/approved-admin enforcement is owner-reported in existing documentation, not independently verified here. A future scraper-ownership change needs backend review and authorization tests; frontend controls do not prove backend enforcement. This phase must not widen access.

Current auth source uses absolute callback/recovery URLs, PKCE URL detection, recovery routing, pending/disabled guards and profile polling. The explicit offline gate is development-serve-only, does not construct a hosted client offline, and compiles false for builds. Preserve these boundaries; no new offline session, fake role or hosted fallback.

### Database authorization implementation requirements

- Replace broad permissive policies atomically. Adding a new permissive owner policy alongside the old `business_read`/`business_update` policies would OR them together and leave the leak open.
- RLS must scope direct contacts/leads/activities/history reads as well as RPC results. Use owner-derived workspace authorization in both USING and WITH CHECK; ordinary updates cannot transfer ownership or reparent into another user's workspace.
- Definer RPCs must explicitly authorize the requested workspace/entity before privileged queries. Retain safe `search_path`, qualified objects, bounded/allowlisted inputs, controlled EXECUTE grants and non-oracular errors.
- Keep canonical/private cross-table checks in database constraints plus checked writes. Foreign-key and uniqueness errors can reveal hidden records; validate caller-owned targets and return generic unavailability rather than blindly exposing constraint diagnostics.
- Append-only history is trigger-generated, including insert/update/delete/restore events and note soft-deletion. No browser-supplied history payload or actor is accepted. Restore locks/checks the current record and an expected current value/version, rejects stale restores, rejects ownership/identity/relationship fields outside the restore allowlist, and produces a new correlated event.
- Separate migration/system events from verified human events; never attribute historical legacy edits to the current admin or fabricate timestamps.

## 6. Reviewed-rollout proposal and rollback requirements

This is a sequence proposal, **not an executable migration or approval to apply it**.

1. Confirm real GitHub/local HEAD and outstanding changes; refresh live schema, ACLs, triggers and counts; reconcile drift. Confirm the connected project is the intended release target.
2. Approve this model, public snapshot allowlist, legacy handling, transfer-history rule and retention rule. Obtain a verified backup of schema, data, grants, functions/triggers and Auth/profile references, plus a restore rehearsal in an isolated environment. Confirm actual backup/PITR availability rather than assume a plan includes it.
3. Prepare versioned additive DDL, exact policy/function replacements, preconditions and verification assertions against a disposable/staging copy. Apply reviewed SQL through the connected database tooling only after approval. This environment generates migration artifacts externally; do not hand-create or edit `supabase/migrations`. Reconcile/export generated versioned artifacts for repository review. No such artifact has been generated by this audit, and a staging connection has not been supplied.
4. Add workspace/feed/note/history structures and nullable compatibility links with explicit grants/RLS in their creation transaction. Preserve all old records/IDs; quarantine unknowns. New protected structures must not be exposed during a partial migration. No automatic ownership/publication backfill.
5. In staging, replace every permissive business policy and affected definer/invoker function together with the scoped write/query model. Keep existing constraints unless a separately reviewed equivalent is proven necessary. Test backfill and constraints, including legacy rows inserted after this audit.
6. Run rollback-only SQL acceptance fixtures and independent concurrency tests in staging. Capture actual results. Only after DB tests pass adapt existing frontend call sites; then run TypeScript, production build, lint, browser/Auth/export/offline checks and scraper regression tests. Do not push on unexecuted checks.
7. Review the exact migration artifact, expected locks/runtime, verified backup/rollback plan, frontend/database compatibility and test evidence; obtain **separate explicit production schema-change approval**. Coordinate frontend/API cutover without a window of permissive old policies. Frontend maintenance alone does not block direct Supabase writes; any write freeze must be backend/DB-enforced and separately approved.
8. Apply the approved release, verify effective privileges and behavior with real roles, check unchanged existing record IDs/counts, and inspect audited actor attribution. Deployment remains owner-controlled; no FastAPI/Gosom/Caddy/Docker changes are part of this work.

**Rollback:** migration failures inside a single transaction must roll back completely. Before protected writes exist, a reviewed reversal can restore captured definitions without deleting retained records. After protected writes exist, do not restore permissive shared policies or the old raw-table client: that would re-expose private data. Prefer fail-closed maintenance/admin-only access and a forward fix while preserving new private records and history. Point-in-time/backup restore requires a separate approval and reconciliation plan for writes after the backup. An additive model is not automatically safely reversible once new data exists. No destructive down migration or DROP TABLE is proposed.

## 7. Acceptance-test specification (not executed)

Use at least approved users A and B, approved Super Admin S, pending P, disabled D and anonymous role. Use transactional fixtures and end with ROLLBACK; never retain test Auth users or business rows. Ensure fixture errors also roll back. Do not run write fixtures in production under this discovery authorization.

Required automated coverage:

1. Existing signup approval defaults, self-profile visibility, last-admin protection and immediate pending/disabled denial remain valid.
2. A and B each own separate workspaces for the same canonical business, plus different private contacts, notes, phone/address overrides, leads and volumes. Changes in A never alter B or the public snapshot.
3. A cannot read/count/update/delete B's rows by direct table access, guessed UUID, joined select, FK reparent, record picker, filter facet, duplicate check, dashboard, search/sort/pagination, activity, provenance or any RPC. Test both directions and unknown-versus-forbidden behavior.
4. Selected-ID and matching-record exports contain only authorized projections. Mixed A/B IDs cannot reveal hidden rows, metadata or private canonical columns. Global names/counts and uniqueness/relationship errors must not reveal B's presence.
5. Forged owner/actor/publisher, role metadata, arbitrary assignment, ownership changes, cross-workspace contacts and relationship edits are rejected; admin transfer succeeds only through the checked audited operation.
6. Only S publishes/unpublishes. Feed responses exclude contacts, notes, card/cash volume, source payload/IDs, activity and private user/publication metadata, even with direct requests selecting columns or JSON keys.
7. A and B add the same publication independently, without automatic leads, reservation or disclosure of the other owner. Repeated add is idempotent for the caller. Unpublish hides the feed but preserves existing private workspaces.
8. S globally reads/filters/edits/exports/manages authorized records and quarantined legacy data. A/B cannot obtain global directory or administrator-only imports/scraper data.
9. Real field changes on workspace/contact/lead/note produce correct before/after, actor and timestamp; unchanged writes do not invent edits. Note soft-delete and restore generate new events. Direct audit insert/update/delete/actor forgery fails for browser callers.
10. Restore enforces owner/admin scope, field/type allowlists and stale-value/version checks; it does not alter history or identity/ownership fields. Historical rows remain readable to the authorized scope after parent deletion; profile removal does not erase recorded actor identity.
11. Unknown legacy ownership remains admin-only. Existing IDs and valid composite relationships survive migration; contact move/delete and admin canonical deletion do not corrupt other workspaces or erase permanent history.
12. Admin-only scraper draft/save/delete/history/stored-import export and live API authorization are unchanged. Pending, disabled and business-user direct FastAPI attempts remain denied; verify backend JWT/approval enforcement separately.
13. Independently orchestrated sessions test concurrent add-to-workspace, add-versus-unpublish, ownership transfer versus child edits, and stale competing restore. A single rollback transaction cannot prove multi-session concurrency safety; use disposable staging fixtures with reliable cleanup.

### Actual verification results for this audit

- Completed: live schema retrieval; catalog SELECTs for effective grants/RLS/EXECUTE/trigger attachments/public views; aggregate counts; required CRM/auth source and call-site tracing; compatibility/access/rollout proposal.
- No write statements, fixture inserts, migrations, account changes or business mutations executed.
- Not executed: ownership acceptance tests, concurrency tests, backup/restore rehearsal, TypeScript/build/lint, browser/email/Auth flows, HTTP RLS/export tests, authenticated scraper smoke tests, Git fetch/status/push or deployment.
- No Phase 1 isolation or restore test is claimed passed. Historical shared-CRM tests in README/pipeline docs are not acceptance evidence for the new private-ownership model.

## 8. Next authorization gate

Review this compatibility map and rollout design before implementation. Next deliverable is the reviewed migration/test package in an isolated staging environment, with a reconciled generated versioned migration artifact. Production schema changes require explicit approval of that package and verified backup/rollback prerequisites. Frontend changes follow passing database tests. The complete Phase 1 implementation and later-phase Shared Feed/history UI are not delivered by this discovery document.
