# MerchantIQ

React/TypeScript CRM using Supabase PostgreSQL and Auth, React Router, TanStack Query, Tailwind, shadcn/ui, and Recharts.

## Backend implementation

- Project: `eujbgwltfdiwqatnvmik` (connected CRM project).
- `profiles`: references `auth.users`; exactly two roles (`super_admin`, `business_user`) and separate approval states (`pending`, `approved`, `disabled`). Signup triggers always create pending Business Users, ignoring role/approval metadata.
- `merchants`, `contacts`, `leads`: UUID identifiers, immutable IDs, database timestamps, foreign keys, allowed statuses, nullable nonnegative finite processing volumes. Primary contacts must belong to the correct merchant. Moving a contact clears incompatible primary links; contact deletion nulls those links; merchant deletion cascades to contacts/leads.
- All four tables have explicit grants and RLS. No anonymous business access. Approved accounts may read/create/update business records; only approved Super Admins may delete. Profiles can be read by their owner or an approved Super Admin. Direct client profile writes are not granted.
- `crm_manage_user`: administrator-only, serialized role/approval updates, protects the last approved Super Admin. `crm_user_directory` exposes only approved user IDs/display names for assignment.
- `crm_list`: security-invoker, RLS-respecting server search/filter/sort/pagination and counts, with joined labels and database-wide duplicate flags. Merchant search and duplicate matching have indexes. Filter options and dashboard aggregates are computed in the database.
- `crm_import_merchants`: Super Admin check plus transactional import; 1–2,000 records, server IDs and ingestion timestamps. Clients may export permitted data. Restricting the administrative import RPC does not prevent an approved user from automating their permitted ordinary create operations.

Business records are persisted in PostgreSQL. There is no demo seed, local-storage business database, or demo fallback. Auth sessions and the theme preference can be stored in the browser as normal client preferences/session state.

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

## Verification performed in this implementation

Successful rollback-only SQL suites simulated authenticated and anonymous database roles and asserted:
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

VPS Control remains an approved-Super-Admin-only, disconnected placeholder. It has no scrapers, AI agents, operational VPS endpoints, WebSockets, infrastructure credentials, server metrics, or execution controls. Future operations require a separately authorized backend integration; nothing in this change connects to Hostinger.
