# CRM workspace and scraper integration boundaries

## Implemented routes

- `/leads`: joined Lead Explorer with PostgreSQL search, province/industry/source/status/assignee filters, display-label sorting, All/Available/My Leads/Follow-ups Due views, selection and CSV export. Due dates are evaluated in UTC. Available is an unassigned/open-record filter, not a claim or reservation operation.
- `/leads/directory`: preserved original lead directory, including existing bulk deletion/export workflows.
- `/leads/:id`: existing persistent editor, primary contact information, source provenance, notes, call/contact-attempt logs, and paginated activity history. Call logging records a user-entered event; it does not place a telephone call.
- `/scraper`: approved-Super-Admin-only live FastAPI launch, job history/details/status refresh and original CSV downloads, alongside separate Supabase drafts, recorded history, stored-import CSV export and processing views. Live API views poll every 15 seconds while visible; database views retain their existing polling. Neither is VPS infrastructure health telemetry.
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

### Scraping Jobs (FastAPI)

- **New Scrape** opens the launch dialog; **Start Scraping** submits one validated POST to `/scraper/jobs`. Name and 1–5 nonblank keyword lines are required. Latitude/longitude start blank, must be in range, are always sent as strings, and require the user's location-verification checkbox. No city geocoding or fallback coordinates are used.
- The required coordinate help is displayed beside the inputs, with a Google Maps verification link. ChatGPT coordinates are suggestions, not verified geocoding results. A future server-side geocoder should return candidates for explicit user selection rather than silently picking a city.
- Radius is entered in **kilometres**, minimum 0.1 km, and converted to an integer number of **metres**. `zoom` is 1–21, `depth` 1–10, `email` and `fast_mode` are booleans. UI defaults for these non-location settings match the published request defaults.
- The runtime control is presented in seconds and sends `max_time` unchanged in the contract's 30–3600 range. Do not multiply by one billion in the frontend: forwarding nanoseconds to Gosom remains the existing backend's responsibility.
- No `maxResults` is sent or promised. Optional `proxies` are omitted; proxy credentials are not entered or stored by this UI.
- **Refresh** reads `/scraper/jobs`. **Details** reads `/scraper/jobs/{id}`. The main table displays Job name, Search, Created, Status, Actions. Search comes from actual `Data.keywords` when supplied; dates use actual `Date`/`createdAt` values. Missing/invalid information is Not available, never generated.
- Scraper-specific badges map owner-confirmed statuses case-insensitively: `ok` → Completed (green); `working`/`running` → In Progress (blue); `pending`/`queued` → Queued (amber); `failed`/`error` → Failed (red); `cancelled`/`canceled` → Cancelled (neutral). Unknown values remain neutral with their actual text; missing values show Unknown. Filters group equivalent raw values without changing stored responses. Completed means successful job completion, not a claim that useful rows were collected.
- **Scraping Details** presents actual name/status/date/search and available Data settings. The full ID and sanitized response are behind collapsed **Technical Details**. Manual ID lookup and unexpected-list diagnostics are also collapsed; raw JSON is not printed in normal table rows. No result counts, ETAs, progress bars or completion times are fabricated.
- **Download Results** requests `/scraper/jobs/{id}/download` with the Supabase access token. The backend determines readiness. Non-2xx responses, JSON/HTML responses and empty files produce errors rather than successful downloads. Successful file bytes are not transformed; the UI requests a browser download and does not claim that the user saved it.
- Refresh failures are visible. Previously loaded jobs/details remain labeled as the last available data. Filtering and pagination apply only to the collection returned by the API, not an invented server-wide total.

### Drafts & processing (Supabase)

- **Save a draft / Save draft only** retains the existing city/province/language draft format. The legacy results preference is explicitly **not enforced** and is never mapped to the live request.
- Draft deletion removes only an unsubmitted database draft, never a VPS job. There is no automatic submission/linkage of drafts or browser update of execution states.
- **Details** displays recorded status, external ID/counts/errors and the latest 20 processing runs. These are not labeled live Gosom statuses.
- **Refresh** in this tab re-queries Supabase, not the scraper API.
- **Export stored import CSV** reads permitted imported rows in batches and exports provenance and original payload JSON. This is distinct from the original Gosom file; no stored rows means an informative message.
- Processing-stage counts and imported businesses retain their existing queries and permissions. A live scraper submission or download does not import, clean, validate or qualify businesses.

Stored-import exports retain deterministic offset ordering and spreadsheet-formula escaping; original Gosom downloads are intentionally unmodified. Stored exports are not transactional snapshots: concurrent changes can affect completeness. Large export streaming and keyset pagination remain future performance work.

## Typed API layer and contract limitations

- `src/lib/scraper-api.ts`: existing injected `createScraperApi(transport, contract)` abstraction for create/list/get/download/health.
- `src/lib/scraper-transport.ts`: existing production origin `https://api.merchanthq.tech` and Bearer-token session transport, now with 30-second JSON/120-second file timeouts, cancellation, redirect rejection, offline blocking and safe HTTP error messages. There is no service-role key or backend secret.
- `src/lib/scraper-contract.ts`: runtime request validation from root `openapi.json` (MerchantIQ API 0.2.0). Request coordinates are deliberately stricter than the backend defaults: they must be explicitly supplied. Responses remain `unknown` at the boundary because the specification gives every successful response schema as `{}`; even the download is documented generically as JSON despite its file purpose.
- `src/lib/scraper-jobs.ts`: approved-admin/offline-gated live queries, per-user query keys, cancellation, no automatic request retries, and original-file download handling. Supabase pipeline hooks remain separate.

The list renderer retains support for direct arrays of objects and actual `jobs`/`data` array properties. It reads actual case-insensitive `id`/`job_id`, `name`, and `status` fields when present. IDs must be UUIDs, matching the path contract. Unexpected envelopes show an error rather than a false zero-job history; their sanitized response is available only under collapsed Technical Details. Credential redaction also covers serialized JSON inside Data. Raw authenticated production payloads have not been retrieved in this editor session. Captured sanitized responses can tighten boundary schemas later without changing the backend.

`src/lib/scraper-presentation.ts` reads actual Data objects (or serialized JSON objects), keyword arrays/text and valid creation-date strings. It preserves raw job records and exposes only known settings, not guesses about runtime units. `src/components/ScraperStatusBadge.tsx` handles scraper labels/colors independently of the unchanged CRM StatusBadge. The status mapping and Data/Date field names were supplied in the owner's Update A prompt, not inferred from the empty OpenAPI response schemas.

## Production boundaries and remaining work

The owner confirms production CRM `https://merchanthq.tech`, API `https://api.merchanthq.tech`, HTTPS, Supabase ES256 JWT validation, approved-Super-Admin authorization, CORS, and exercised production job launch/list/details/refresh/original downloads. Historical job counts change with real activity and are never hard-coded. These are owner-reported operational facts, not new tests performed by this frontend cleanup. Docker, Caddy, Nginx, FastAPI, Supabase authentication and transport behavior were not changed. No infrastructure rebuild or deployment was performed.

1. Run application/config TypeScript checks and the production build before pushing. `package.json` now exposes `typecheck`, and `build` runs it before Vite bundling. No command runner or Git push tool is available in this editor session, so neither checks nor push are claimed successful.
2. Capture sanitized real create/list/detail responses and confirm actual status values, seconds-to-nanoseconds backend forwarding, download readiness/error behavior and MIME type. The supplied OpenAPI has no response DTOs/status enums and no idempotency or pagination contract. Do not interpret this source-level integration as completed runtime verification.
3. POST is never automatically retried. An acknowledgement is shown as the actual response, not fabricated job progress. Network/timeouts/ambiguous server failures warn that submission outcome is unknown and require explicit confirmation before another attempt. Client click guards are not persistent idempotency: cross-tab/reload/retry duplicate prevention needs existing or future server-side support. No backend changes were made here.
4. Trusted Supabase ingestion, job reconciliation and Raw → Qualified processing remain separate integrations. Browser API access does not install workers or synchronize execution records.
5. Keep Auth redirects allowlisted for `https://merchanthq.tech/auth/callback` and `/reset-password`. Existing authentication/bootstrap remains unchanged; there is no automatic first-user promotion.
6. Deployment is explicitly left to the owner on the VPS after checks and GitHub synchronization succeed.

## Offline development

The existing explicit development-only preview is preserved. Explorer and notes/call logs use the isolated memory-only store, with no fabricated session/role. Scraper draft saving, job monitoring, pipeline administration and imported downloads are disabled offline; no fake jobs, processing runs, scores or metrics are seeded. My Leads is empty offline because there is no real authenticated account. All production builds continue to compile the preview gate false.

## Historical database verification (prior CRM release)

The following tests were executed in the prior CRM/pipeline release, not rerun as part of the live API UI change. They used authenticated-role simulation inside rollback-only subtransactions:

- Signup defaults and pending-user denial; approved Business User denial of scraper administration and raw staging.
- Admin draft creation/deletion, real actor attribution, and rejection of direct client execution-state writes.
- Joined merchant phone search, combined province/industry filters, available/due views, selection filtering, row limits and score joins.
- Automatic status-change history, RPC notes/call logs, actor anti-forgery and last-contact UTC updates.
- Score bounds, source ID uniqueness, no skipped processing stages, matching completed-run requirements, evidence-backed qualification and sanitized provenance.
- New-table RLS and effective grants: no anonymous reads and no authenticated direct inserts/updates/deletes.

Historical fixture counts were checked afterward: the then-existing 1 profile and 0 approved Super Admins remained; all business and new pipeline/activity tables had 0 records. These are prior test-run counts, not current production metrics. No test accounts or business records were retained.

## Live scraper UI verification status

Performed: read the supplied OpenAPI before coding; source-reviewed request fields/ranges, required blank coordinates, exact coordinate-help copy, kilometre-to-metre mapping, unchanged FastAPI runtime value, no maxResults mapping, separate per-user live versus Supabase queries, no automatic POST retry, download/auth/offline guards, and preserved route/admin boundaries. Checked source for obsolete integration-pending/domain references and updated documentation. This is source review, not a compiler or runtime test.

Not executed in this editor session: TypeScript checks, production build, ESLint, browser interaction tests, authenticated FastAPI requests, actual Gosom status/response fixture verification, launch/download smoke tests or GitHub push. The available tools have no command runner, browser harness or push operation. No database migrations, backend/infrastructure edits or live deployment were performed.

Before release, verify: both TypeScript projects and production bundle; current authenticated job history; a deliberately selected coordinate launch with km/metre and seconds/nanosecond forwarding inspection; actual raw status/details fields; completed-job CSV bytes; unavailable-file errors; 401/403 behavior; uncertain POST handling without automatic retry; draft save/delete and stored import export; and offline preview producing zero hosted requests. Do not push until the requested checks succeed. Deployment remains an owner-controlled VPS action.

### Update A — frontend cleanup verification

The owner reports that launch, list, details, refresh and original CSV downloads have already been exercised in production. This cleanup preserves the API abstraction, transport, hooks, routes, schemas, authentication, and Supabase actions. The contract file changed only its display redaction helper, not request/response handling.

Source-reviewed in this editing turn: isolated scraper badges and all supplied mappings/unknown fallback; grouped status filtering without changing raw responses; real Data/Date field presentation and invalid-date placeholders; no UUID/raw JSON in normal table rows; collapsed Technical Details in details and submission acknowledgement; exact coordinate help; unchanged kilometre-to-metre/seconds request mapping; retained submission locks and uncertain-outcome warning; unchanged authenticated downloads and separate drafts/processing. Searched frontend sources for the removed developer-facing labels. This is source inspection, not automated test execution.

Not run: dependency installation, TypeScript, production build, browser/network smoke tests, or GitHub push. No command runner, browser harness or Git push operation is available in this Build session. Git metadata reads were blocked by the file tools, so current branch/worktree status could not be independently rechecked here; the supplied base commit is a6a0568. No reset, merge, dependency changes or production deployment was attempted. Changes are saved locally and are not claimed ready for release until checks succeed.
