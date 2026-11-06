# CRM workspace and scraper integration boundaries

## Implemented routes

- `/leads`: joined Lead Explorer with PostgreSQL search, province/industry/source/status/assignee filters, display-label sorting, All/Available/My Leads/Follow-ups Due views, selection and CSV export. Due dates are evaluated in UTC. Available is an unassigned/open-record filter, not a claim or reservation operation.
- `/leads/directory`: preserved original lead directory, including existing bulk deletion/export workflows.
- `/leads/:id`: existing persistent editor, primary contact information, source provenance, notes, call/contact-attempt logs, and paginated activity history. Call logging records a user-entered event; it does not place a telephone call.
- `/scraper`: approved-Super-Admin-only draft preparation, Supabase job history/status inspection, stored-import CSV export, processing-stage counts and import provenance. Database monitoring polls every 15 seconds while mounted; it is not VPS health monitoring.
- `/vps`: unchanged disconnected infrastructure placeholder.

Existing authentication, approvals, business CRUD and CSV merchant imports remain in place. The existing policy permits approved accounts to read/create/update shared business records, including assignment fields; this release does not introduce exclusive ownership, atomic claiming, or restrict existing shared editing. Do not advertise an exclusive lead-claim workflow until its database protections are implemented and concurrency-tested.

## Additive database changes applied

Schema changes were executed transactionally through the connected database tooling, not hand-written migration files. The original four business/profile tables, IDs, records, grants and RLS were not replaced.

| Table | Purpose and access |
| --- | --- |
| `scraping_jobs` | Canadian query/location/language/limit drafts, external execution ID, real reported status/count/errors and timestamps. Approved Super Admins read; validated RPCs save/delete unsubmitted drafts. No authenticated direct writes. |
| `imported_businesses` | Source-scoped external ID uniqueness, original raw payload, separate processed output, collection versus ingestion timestamps, current processing stage, optional merchant/job/run links. Admin read; trusted-backend writes only. |
| `processing_runs` | Versioned adjacent-stage processing runs with actual status, input/output counts, error and timing fields. Admin read; trusted-backend writes only. |
| `lead_quality_scores` | Nullable, independent 0–100 data-quality and sales-priority scores, mandatory nonempty evidence and method version, optional processing run. Approved-account read; trusted-backend writes only. No guessed scores or numeric defaults. |
| `lead_activities` | Lead creation/update changes, notes and contact-attempt logs with database timestamps and actor IDs. Approved-account read; trigger/RPC writes only. Clients cannot forge actor IDs or update/delete events. |

All new tables have RLS, explicit grants, foreign keys, checks and appropriate pagination/relationship indexes. Anonymous API roles have no table access. The trusted service role has CRUD grants, but must remain server-side.

Functions: `crm_explore_leads`, `crm_save_scraping_draft`, `crm_delete_scraping_draft`, `crm_pipeline_summary`, `crm_add_lead_activity`, `crm_merchant_provenance`; internal trigger functions `crm_record_lead_change` and `crm_import_stage_guard` are not executable by API roles. Privileged RPCs validate current database approval/role and derive the actor from `auth.uid()`.

Activity tracking begins when this release is applied; old events are not backfilled or invented. History follows existing parent-deletion semantics: an admin's permanent lead deletion also removes its activity rows. It is not an independent, indefinitely retained compliance audit log.

## Processing design

`Gosom → existing internal FastAPI → trusted ingestion → Raw → Cleaned → Validated → Qualified → linked MerchantIQ records`

- Raw: only actual imported source payloads; new rows must enter at Raw.
- Cleaned: normalization/deduplication output is stored separately in `processedPayload`; never infer missing owners, emails, processors, or volumes.
- Validated: a real validation run checks available evidence and records its method/version. Unknown fields remain unknown. Validation rules/workers are not implemented in the frontend.
- Qualified: qualification uses explicit backend rules, not a sales-status label or an arbitrary default threshold. A linked merchant and an evidence-backed assessment from the qualification run are required.

A stage update must advance one step and reference a completed run with matching source/destination stages and job ID. Processed output is required. Qualification additionally requires its matching assessment. Processing workers should commit run completion, output, assessment, and the guarded stage update in a transaction. A future retry/reprocessing design must preserve provenance rather than silently moving stages backwards.

Existing merchant CSV imports intentionally retain their direct-to-CRM behavior. They do not silently generate Raw/Validated/Qualified pipeline records. Stage counts include only actual imported staging rows; the sales status Qualified remains a separate concept.

External source idempotency is `(source, sourceRecordId)`. The backend must choose stable, namespaced identifiers (for example a verified source place identifier). Do not deduplicate solely by business name. Repeated collections/versioned source snapshots need an explicit backend policy before overwriting original payloads.

## What the Scraper Control buttons do

- **Prepare job** opens real editable settings. **Save draft only** persists the validated draft in Supabase and explicitly reports that no scraper ran.
- Draft deletion removes only an unsubmitted database draft, never a VPS job.
- **Inspect** displays database status, external ID, reported counts/errors and the latest 20 processing runs.
- **Refresh database** re-queries Supabase, not `/scraper/health`.
- **Export stored import CSV** reads permitted imported rows in batches and creates a real CSV with source metadata and the original payload in a JSON column. It is not the original Gosom CSV. No stored rows means an informative message, not fabricated download success.
- Launch and original VPS CSV controls are disabled and labeled pending. There is no operational stop/retry/health button or fake server telemetry.

Exports use deterministic offset ordering and spreadsheet-formula escaping. They are not transactional snapshots: concurrent changes during an export can affect completeness. Large export streaming and keyset pagination should be benchmarked against real dataset sizes before high-volume deployment.

## Typed API layer

`src/lib/scraper-api.ts` provides `createScraperApi(transport, contract)` with typed create/list/get/download/health operations for the supplied internal paths. It has no default HTTP transport, API origin, VPS IP, secret, automatic request, or application activation switch. No screen instantiates it. Runtime Zod schemas must be supplied from the confirmed backend contract; neither response envelopes nor job-creation payloads were guessed. `ScraperDraft` is a CRM model, not a claimed FastAPI wire format.

The future transport must reject non-2xx responses, enforce timeouts/cancellation, and must not turn error responses into blobs or successful JSON. It must be installed only after HTTPS, JWT verification, authorization and the actual API schemas have been reviewed. Keep backend tokens and any service-role key outside browser bundles and `VITE_*` settings.

## Pending integration and deployment prerequisites

1. Confirm actual FastAPI OpenAPI request/response schemas and job-ID/status semantics for `/scraper/jobs`, `/scraper/jobs/{id}`, `/scraper/jobs/{id}/download`, `/scraper/health`.
2. Make the future `https://api.merchantiq.net` boundary reachable over authenticated HTTPS. Its server must verify Supabase JWTs (signature, issuer, audience and expiry) and current approved Super Admin status for scraper administration, not trust a decoded token or frontend role flag. The current internal FastAPI/Gosom services do not need to be rebuilt.
3. Configure TLS, allowed origins for `https://merchantiq.net`, deployment routing, rate limits, timeout/error behavior and authenticated downloads. Do not expose internal Docker APIs or unprotected scraper endpoints.
4. Implement a server-side submission/reconciliation path: draft IDs can serve as idempotency identifiers, but submission must avoid double-launches and reconcile uncertain network outcomes. Only confirmed backend events may advance execution state. No such dispatcher or worker is installed by this release.
5. Configure trusted ingestion/status synchronization and processing workers to write Supabase. Do not put credentials in the browser. No VPS requests or infrastructure changes were made in this implementation.
6. Explicitly approve the intended administrator through a trusted Supabase action, and configure Auth redirect allowlists for `https://merchantiq.net/auth/callback` and `/reset-password`. The account bootstrap is never automatic.

## Offline development

The existing explicit development-only preview is preserved. Explorer and notes/call logs use the isolated memory-only store, with no fabricated session/role. Scraper draft saving, job monitoring, pipeline administration and imported downloads are disabled offline; no fake jobs, processing runs, scores or metrics are seeded. My Leads is empty offline because there is no real authenticated account. All production builds continue to compile the preview gate false.

## Verification in this release

Executed successfully against the connected database using authenticated-role simulation inside rollback-only subtransactions:

- Signup defaults and pending-user denial; approved Business User denial of scraper administration and raw staging.
- Admin draft creation/deletion, real actor attribution, and rejection of direct client execution-state writes.
- Joined merchant phone search, combined province/industry filters, available/due views, selection filtering, row limits and score joins.
- Automatic status-change history, RPC notes/call logs, actor anti-forgery and last-contact UTC updates.
- Score bounds, source ID uniqueness, no skipped processing stages, matching completed-run requirements, evidence-backed qualification and sanitized provenance.
- New-table RLS and effective grants: no anonymous reads and no authenticated direct inserts/updates/deletes.

Fixture counts were checked afterward: the original 1 profile and 0 approved Super Admins remained; all business and new pipeline/activity tables had 0 records. No test accounts or business records were retained.

Not executed: TypeScript compiler, Vite production/development builds, ESLint, browser/UI/network tests, actual Auth email flows, real FastAPI/Gosom HTTP integration, load tests, backup/restore drills, or production domain/TLS checks. The available editor tools do not provide a shell/build runner or browser automation. Source review and successful SQL tests are not production-readiness certification.
