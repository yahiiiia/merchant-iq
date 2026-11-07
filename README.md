# MerchantIQ

React/TypeScript CRM using Supabase PostgreSQL and Auth, React Router, TanStack Query, Tailwind, shadcn/ui, and Recharts.

## Lead workspace and live Google Maps scraper

The CRM includes `/leads` (server-backed Lead Explorer), persistent notes/call logs and activity history on lead details, and `/scraper`. The original lead directory is preserved at `/leads/directory`.

Production CRM: `https://merchanthq.tech`. Production API: `https://api.merchanthq.tech`. The owner reports HTTPS, ES256 Supabase JWT validation, approved-Super-Admin endpoint authorization and production CORS already operational. This frontend change does not rebuild or deploy that infrastructure.

Scraper Control now has separate **Live scraper jobs** and **Supabase drafts & processing** views. Live launch/history/details/original CSV downloads use the existing Bearer-token transport and API abstraction. Supabase draft saving, recorded history, stored-import exports and processing views remain independent. There is no automatic job-to-Supabase synchronization or ingestion.

Launch requires manually entered latitude/longitude and Google Maps verification. Radius is displayed in kilometres and sent as integer metres. `max_time` is sent unchanged in the FastAPI contract’s 30–3600 range, presented as seconds; Gosom nanosecond forwarding remains server-side. No location defaults or `maxResults` parameter are sent. Optional proxies are omitted; no proxy credentials are stored in the UI.

`openapi.json` describes the request but leaves successful response schemas empty. The UI preserves returned statuses and exposes actual fields/raw responses; it does not invent status enums, progress or result counts. Unrecognized response envelopes are shown explicitly, not silently turned into zero jobs. See [CRM pipeline and integration boundaries](docs/crm-pipeline.md) for contract handling and remaining runtime verification.

The production `build` script now gates Vite bundling on the new `typecheck` script (application and Vite-config TypeScript projects). These checks were **not executed in this editor session**, which has no command runner. No GitHub push or live deployment was performed.

## Backend implementation

- Project: `eujbgwltfdiwqatnvmik` (connected CRM project).
- `profiles`: references `auth.users`; exactly two roles (`super_admin`, `business_user`) and separate approval states (`pending`, `approved`, `disabled`). Signup triggers always create pending Business Users, ignoring role/approval metadata.
- `merchants`, `contacts`, `leads`: UUID identifiers, immutable IDs, database timestamps, foreign keys, allowed statuses, nullable nonnegative finite processing volumes. Primary contacts must belong to the correct merchant. Moving a contact clears incompatible primary links; contact deletion nulls those links; merchant deletion cascades to contacts/leads.
- All four tables have explicit grants and RLS. No anonymous business access. Approved accounts may read/create/update business records; only approved Super Admins may delete. Profiles can be read by their owner or an approved Super Admin. Direct client profile writes are not granted.
- `crm_manage_user`: administrator-only, serialized role/approval updates, protects the last approved Super Admin. `crm_user_directory` exposes only approved user IDs/display names for assignment.
- `crm_list`: security-invoker, RLS-respecting server search/filter/sort/pagination and counts, with joined labels and database-wide duplicate flags. Merchant search and duplicate matching have indexes. Filter options and dashboard aggregates are computed in the database.
- `crm_import_merchants`: Super Admin check plus transactional import; 1–2,000 records, server IDs and ingestion timestamps. Clients may export permitted data. Restricting the administrative import RPC does not prevent an approved user from automating their permitted ordinary create operations.

In connected mode, business records are persisted in PostgreSQL. There is no production demo seed, local-storage business database, or automatic demo fallback. Auth sessions and the theme preference can be stored in the browser as normal client preferences/session state.

## Explicit development-only offline preview

Local preview is explicitly enabled by `VITE_OFFLINE_PREVIEW=true` in `.env.development`. It is not triggered by missing credentials, failed requests, account state, URL parameters, or browser storage. To return to connected development, set the flag to `false` (or override it in `.env.development.local`) and restart the development server after changing the environment. Offline `/login`, `/auth/callback`, `/pending`, and `/reset-password` redirect to the local workspace without mounting auth components.

Safety boundaries:

- `vite.config.ts` only enables the compile-time flag for development **serve**, never build or preview commands. All builds—including `build:dev` and builds with the environment flag true—compile the gate to false. `src/lib/offline-preview.ts` also requires Vite's `DEV` flag. Deployed builds cannot activate this through a URL, storage, or runtime environment variable. Do not deploy the development server.
- The hosted Supabase client is **not constructed** offline. A fail-closed blocker throws if code accidentally accesses it, before any request. The real session provider is not mounted: no auth initialization, stored-session refresh, profile polling, or auth subscription. Existing hosted session storage is untouched.
- `src/lib/offline-crm.ts` loads only through development-gated dynamic imports. Fictional merchants, contacts, leads, and assignees live in this tab's JavaScript memory, with a separate query-cache identity. No localStorage business records, IndexedDB, sync queue, hosted reads/writes, schema changes, or RLS changes.
- Overview, directories, filters, pagination, record details, linked-record pickers, local create/edit/delete, and local CSV import/export use isolated test data. Queries also run when the browser reports offline. Unknown processing volumes remain null. Local imports are all-or-nothing and should contain fictional data only. Exports are named `MerchantIQ-OFFLINE-TEST-…`.
- A persistent amber banner identifies the mode and memory-only data. Reloading or **Reset test data** discards local changes and restores fictional records. Tabs are independent; hot reload can also reset memory. There is no synchronization back to Supabase.
- The session remains null and `isAdmin` false: offline navigation is not a real role, approval, or account. Access shows disabled read-only fictional examples, with no real profile queries or account-management actions. Authentication/user management and VPS operations are non-operational. VPS remains disconnected with all controls disabled and no fabricated metrics/jobs.
- Connected/production authentication, approval gates, administrator checks, and database RLS remain in place. No service-role credentials are used in browser code.

This is a local-development preview, not an installable offline/PWA distribution: a running local dev server is still needed to serve application assets. No hosted Supabase connectivity or account is required for CRM screens.

Offline-change verification: source inspection traced the compile-time gate, client construction, provider mounting, auth routes, CRM data hooks/mutations/exports, and admin screen branches. TypeScript/build/lint, emitted-bundle inspection, browser network assertions, and runtime interaction tests have **not** been performed in this editing session. Runtime acceptance checks should cover all routes and local CRUD/import/export with network disconnected; zero Supabase-origin requests, including with a previously stored session; reload/reset isolation; disabled admin/VPS operations; and production/development-mode builds with the opt-in true still requiring real authentication. These checks are not claimed as passed.

## First administrator and authentication configuration

There is intentionally no automatic first-user administrator privilege. Register and confirm the intended owner's account, then have a trusted project administrator explicitly promote that verified Auth user ID in `profiles` to `super_admin` with `approved` status. Subsequent approvals/role changes use Access in the app. At implementation verification there were zero real accounts and zero approved administrators; all test fixtures were rolled back.

Authentication uses a shared session provider with profile refresh on focus and every 30 seconds. Database policies check current profile approval/role on each request, independently of the UI. Sign-out clears the query cache.

Public routes:
- `/login`: Supabase Auth UI email/password sign-in/signup, no third-party providers.
- `/auth/callback`: client URL session/PKCE handling and recovery-aware routing.
- `/reset-password`: recovery request and password-update screen.
- `/pending`: pending/disabled account state, no business data access.

All auth email redirects use absolute callback URLs built from the current app origin. Supabase Auth URL Configuration must allow the preview/deployment origins with `/auth/callback` and `/reset-password`. Do not change Site URL to work around missing redirect options. Email settings, email delivery, existing custom templates, and callback allowlist behavior still require an actual browser/email test. PKCE confirmation links should be opened in the initiating browser.

## Frontend structure

- `src/App.tsx`: public auth routes, approved-account guard, Super Admin guard, business routes.
- `src/integrations/supabase/client.ts`: browser client with project URL and publishable key only. Never add service-role credentials.
- `src/components/SessionProvider.tsx`, `AuthGuard.tsx`: session/profile state and route boundaries.
- `src/lib/crm.tsx`: database query hooks, allowlisted write payloads, async mutations and exports.
- `src/lib/crm-fields.ts`: field definitions, formatters and CSV utilities.
- `src/pages/Records.tsx`: server-paginated directories; `RecordPicker.tsx` searches merchant/contact options without loading all records.
- `src/pages/RecordDetail.tsx`: persistent profiles and paginated linked records.
- `src/pages/Access.tsx`: admin account approvals/roles/status management.

CSV imports use the downloadable template (up to 5 MB / 2,000 rows); exported files include IDs/metadata and are not import templates. Imports do not overwrite or merge existing records. Contact relationships are added afterward. Exports retrieve selected records or all filtered records in batches and escape spreadsheet formula-like values. Concurrent changes during a long export can affect an offset-paginated export; it is not a transactional snapshot.

## Historical database verification (prior CRM implementation)

The following rollback-only SQL suites were performed during the original Supabase implementation, not rerun for the live scraper UI update. They simulated authenticated and anonymous database roles and asserted:
- Signup metadata cannot grant role/approval.
- Pending/disabled accounts cannot read business data; anonymous table/function access is denied.
- Approved Business Users can create merchants/contacts/leads and update records, but cannot delete, directly edit profiles, manage accounts, or invoke administrative imports.
- Business Users see only their own profile; Super Admins can see accounts. Pending users cannot read the assignment directory.
- Admin approvals work; last-admin removal is rejected; revocation blocks subsequent reads.
- Negative/NaN volumes, mismatched contact relationships, mutable IDs, and unapproved assignees are rejected.
- Server pagination, combined filters, literal percent search, normalized phone search, duplicate flags, filter facets, dashboard aggregates, and contact/lead queries execute successfully.
- Transactional imports persist nullable volumes and ingestion timestamps within the test transaction; contact moves/deletion and merchant cascades maintain relationships.

All fixtures were rolled back. Final verification confirmed zero profiles, merchants, contacts, and leads.

Not executed in this turn: TypeScript compiler/build/lint, browser interaction tests, real Auth HTTP/email flows, direct-URL browser tests, device/accessibility tests, multi-client concurrency/load tests, or production backup/restore testing. Source inspection is not a substitute for these checks. Previous demo build results do not validate the new backend implementation.

## VPS scope

VPS Control remains an approved-Super-Admin-only, disconnected infrastructure placeholder. It has no Docker/Hostinger controls, agents, infrastructure credentials or fabricated server telemetry. Scraper Control separately connects to the existing authorized FastAPI scraper endpoints; it does not manage containers, Caddy, Nginx, deployment or the VPS itself.
