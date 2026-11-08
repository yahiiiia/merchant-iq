# Phase 1 staging implementation handoff — blocked before Stage A

## Release status

**This is a guarded verification package, not the requested completed Stage A migration package.** Stage A schema/RPC implementation is blocked; Stage B execution and Stage C frontend cutover have not started. No production writes, fixture creation, schema/policy/grant/Auth changes, API/VPS changes, push or deployment were performed.

The full architecture and access matrix remain in [the reviewed audit](phase1-ownership-rls-audit.md). That audit is a historical snapshot; this handoff records a new inspection rather than silently rewriting its evidence.

### Current preflight evidence

- The supplied prior-turn repository commit is `f2c3739e8e8a295cb54f0714ecd9bbdd37de6e6d`. This is provenance, **not an independently verified local/GitHub HEAD**.
- Attempts to read `.git/HEAD` and `.git/config` were explicitly denied by file tools. There is no Git fetch/status or process-execution tool. Remote HEAD, branch and dirty worktree status remain unverified.
- The only connected Supabase project reported by the available integration is production `eujbgwltfdiwqatnvmik`. There is no separate staging connection available here. It was used for read-only discovery only.
- Fresh live schema, function sources and SELECT-only catalog inspection confirm PostgreSQL 17.11, the existing nine public tables with RLS, the old broad approved-user policies, the activity/provenance owner-check gaps, and no `merchant_workspaces`, `notes`, `shared_feed` or `record_change_history` tables.
- The refreshed catalog returned no table/partition relations in `supabase_migrations`; the visible repository has no migration directory or configured database test runner. An empty ledger is not proof of zero historical changes.
- This platform requires schema changes through the connected database executor and externally generated migration artifacts. Handwritten migrations are not permitted in `supabase/migrations`. No alternate migration framework, disguised executable DDL, migration ledger or automatic apply path has been added.

**Exact migration artifacts produced: none.** A migration cannot be honestly described as generated, reconciled or tested without the isolated connection and the actual generation workflow. Do not use production to obtain that artifact. The SQL file included here is SELECT-only catalog discovery, not DDL or a migration.

## Local changed files

| File | Purpose |
| --- | --- |
| `src/tests/phase1/staging-client.mjs` | Dependency-free Node-only, hosted-staging read client; production refusal, exact target checks, distinct actor JWT checks and server Auth identity verification |
| `src/tests/phase1/staging-client.test.mjs` | Offline unit tests of the test harness safeguards using synthetic token payloads and injected transport; these are not ownership integration tests |
| `src/tests/phase1/isolation.test.mjs` | Opt-in read-only PostgREST acceptance subset using real staging actors/fixtures; absent configuration fails rather than skips |
| `src/tests/phase1/fixtures.example.json` | Fictional manifest shape only; creates no data or users and contains no credentials |
| `src/tests/phase1/catalog-inventory.sql` | SELECT-only inventory of columns, constraints, grants, RLS/policies, function definitions/ACLs, triggers and migration relations |
| `package.json` | Adds isolated test entrypoints; no dependency or application build changes |
| `docs/phase1-staging-handoff.md` | This status, configuration, coverage, blockers and cutover checklist |

The existing application, CRM queries/routes, auth provider, cache behavior, imports/exports and scraper transport remain unchanged. No application file imports these tests; Node-only test code is outside the browser import graph. Test credentials must never be introduced into frontend imports, `VITE_*` variables, `.env.development`, source files or Git.

## Provision the missing isolated environment

1. In Supabase create a **new dedicated disposable/staging project**, with a different reference from `eujbgwltfdiwqatnvmik`. Use a staging-only password and secrets. Do not rename/reuse the production project or rely on an environment label attached to production credentials.
2. Connect that new project as this workspace's database integration, while retaining the production reference as a denylisted target. Confirm the new reference and that schema/data writes are authorized **only there**. Do not paste database passwords, user JWTs or service keys into chat.
3. Have trusted backup/restore tooling restore a **schema-only baseline** of the current production CRM into staging, including necessary functions, grants, triggers and constraints. Do not copy real business records/Auth accounts, redirect staging back to production, configure production webhooks/SMTP, or activate infrastructure side effects. Existing fixture-free defaults and signup/approval behavior must be retained.
4. Make Git HEAD/branch/worktree verification available through a trusted repository integration or executor. Preserve uncommitted work; no reset/force-push. Confirm the intended baseline before preparing generated migration artifacts.
5. With that isolated connection, capture the catalog inventory, implement Stage A through the authorized database executor, inspect the externally generated migration artifacts, and reconcile them into one reviewed versioned release package. If generation/export does not occur as expected, stop and resolve the workflow rather than invent a parallel ledger.
6. Provision synthetic staging-only users A/B/Admin/Pending/Disabled and fictional business fixtures through trusted staging tooling **after the scoped schema exists**. No seed or first-admin promotion in production. Create each person's own workspace, contact, lead, private note and audited changes; A and B share one canonical merchant but not private rows. Include a quarantined legacy merchant and a verified nonexistent UUID. Store the resulting manifest outside Git with a `.local` suffix, which the current ignore rules already exclude.
7. Provide the test runner with staging-only configuration in its private environment/secret store. Fresh authenticated user JWTs are required; keys/tokens are never printed. The tests do not create users, sign in with passwords, send email or clean up supplied fixtures. Dispose of the whole staging environment or explicitly remove fixtures using trusted staging tooling after evidence collection.

### Integration-runner configuration contract

The current harness deliberately supports the standard **hosted Supabase staging URL** only, not aliases, local hosts or custom proxies. Configure these outside the frontend:

| Variable | Required value |
| --- | --- |
| `MERCHANTIQ_STAGING_PROJECT_REF` | New 20-character staging project reference; production is always rejected |
| `MERCHANTIQ_STAGING_URL` | Exactly `https://<staging-ref>.supabase.co`, without a trailing slash |
| `MERCHANTIQ_PHASE1_STAGING_CONFIRM` | Exactly `ISOLATED_STAGING_ONLY` |
| `MERCHANTIQ_STAGING_PUBLISHABLE_KEY` | Staging `sb_publishable_…` key; secret/service-role and legacy JWT keys are rejected |
| `MERCHANTIQ_STAGING_ADMIN_JWT` | Approved Super Admin's real short-lived staging access token |
| `MERCHANTIQ_STAGING_SALES_A_JWT` | Approved Business User A's real staging access token |
| `MERCHANTIQ_STAGING_SALES_B_JWT` | Approved Business User B's real staging access token |
| `MERCHANTIQ_STAGING_PENDING_JWT` | Pending Business User's real staging access token |
| `MERCHANTIQ_STAGING_DISABLED_JWT` | Disabled Business User's still-unexpired staging access token; profile-based revocation must deny data |
| `MERCHANTIQ_STAGING_FIXTURES_FILE` | Private local manifest path containing real staged row/user UUIDs, not the example's invented UUIDs |

JWT decoding is only an early wrong-target/privileged-token guard, **not cryptographic verification**. Before business requests, the integration suite verifies every user with staging `/auth/v1/user`, checks the returned subject and reads the actor's own profile to confirm role/status. Distinct unexpired tokens from the same staging issuer are mandatory. Anonymous tests omit Authorization. Redirects are rejected and requests have bounded timeouts.

The client exposes only GET table reads and the seven inspected read-only RPCs. It cannot invoke `crm_manage_user`, imports, activity writes, restore, publication or draft writes. The integration suite cannot run by accident from `dev`, `build`, `lint` or the offline preview, and has no production fallback. Missing staging inputs are test failures, not green skipped tests.

### Fixture/schema contract for the acceptance subset

The read tests use proposed `merchant_workspaces.id`, `merchantId`, `ownerId` and child `workspaceId` columns consistent with the reviewed camelCase convention. These are **acceptance contracts for the future migration**, not existing live columns. Reconcile any reviewed naming changes with the tests in the same staging implementation change; do not add compatibility aliases just for tests.

- `actors` maps the five actor labels to verified actual Auth/profile IDs.
- `sharedMerchantId` is one canonical merchant with two independent owned workspaces.
- `legacyMerchantId` exists but is unresolved/admin-only; `absentMerchantId` must not exist.
- Each salesperson scope gives distinct workspace/contact/lead/note UUIDs and at least two unique long private markers present in its fictional contact/note data. Markers must not be part of the public canonical snapshot.
- The setup hook verifies fixture existence, roles and actual workspace/child relationships as an administrator. Empty/forbidden own-row reads cannot accidentally make isolation tests green.
- Fixtures are externally provisioned and retained for the read-only HTTP suite only in disposable staging. The requested SQL write suites must separately be transactional/rollback-only. No transactional SQL fixture creation or concurrency suite is delivered here because the scoped schema and write contracts do not yet exist.

## Actual checks and test evidence

Node 22+ is the intended external test runtime. The package script definitions record the exact runner entrypoints; this editing environment cannot execute them.

| Entry/check | Actual result in this turn |
| --- | --- |
| `test:phase1:safety` | **NOT RUN** — no process executor; unit tests written, not claimed passing |
| `test:phase1:isolation` | **NOT RUN / BLOCKED** — no staging connection, migration or real staging fixtures/tokens |
| `catalog-inventory.sql` | Saved SELECT-only discovery utility. Equivalent live RLS/ACL/ledger discovery ran successfully; this exact full file was not executed |
| Live table/function/schema refresh | **COMPLETED READ-ONLY** — still the shared model, not compliant Phase 1 schema |
| `typecheck` | **NOT RUN** — no process executor |
| `build` | **NOT RUN** — no process executor |
| `lint` | **NOT RUN** — no process executor |
| SQL rollback fixtures / direct SQL role tests | **NOT WRITTEN OR RUN** — Stage A and isolated DB missing |
| Concurrent add/unpublish and restore | **NOT WRITTEN OR RUN** — isolated DB and write contracts missing |
| Browser/Auth email/cache/export/scraper regressions | **NOT RUN** — no browser/API regression execution; existing app left intact |
| Git HEAD/fetch/status/push | **UNVERIFIED / NO PUSH** — Git metadata inaccessible and no Git runner |
| Production mutation or deployment | **NONE** |

Source review of the harness is not runtime proof. A Node safety-suite pass would prove only the harness's guard behavior, not database security.

### Coverage implemented in the read-only suite

- Anonymous/pending/disabled reads across business, history and pipeline tables.
- Positive owner reads, cross-owner guessed IDs and mixed selected-ID reads for workspace/contact/lead/note rows of the same canonical merchant.
- Salesperson raw-canonical/legacy denial; activity by another lead ID.
- Self-only directory and zero rows/counts from selected hidden lead queries through list and Explorer.
- Own shared-merchant list projection, private marker checks in facets/dashboard, and hidden-marker search.
- Indistinguishable hidden/absent provenance responses.
- Admin positive reads and admin-only raw imports, processing, quality evidence and pipeline summary.

This is **not the complete Stage B acceptance suite**. It does not prove exact global counts, all pagination/sort combinations, duplicate flags under controlled before/after fixtures, HTTP CSV export behavior, feed metadata projection/publication/add races, typed overrides/card-versus-cash isolation, write forgery/reparenting, all write RPCs, note/history immutability, stale/competing restore, retained history after deletion, transfer visibility, last-admin protection, constraint/cascade behavior or FastAPI authorization. Those require the generated Stage A implementation and real staging fixtures/sessions. No incomplete subset may be used as a production release gate.

## Required Stage A implementation, still blocked

1. Generate the additive workspace/typed-override/private-detail, scoped child, private-note, frozen-feed and permanent-history structures with explicit creation-time RLS/grants and validated relationship constraints. Preserve IDs/legacy values; unknown ownership stays admin-only. Card and cash values have separate nullable CAD/month semantics/provenance.
2. Atomically replace old broad policies and harden every affected checked write and definer/invoker path listed in the audit. Browser owner/actor fields are never trusted. Raw canonical and quality evidence remain admin-only. Keep signup/approval/last-admin and scraper/import boundaries unchanged.
3. Implement allowlisted public snapshots without actor/owner/private metadata, locking/idempotent add-to-own-workspace and non-destructive unpublish.
4. Implement trigger-only retained field history and checked, typed, optimistic-concurrency restore that generates another event. No fabricated historical attribution.
5. Generate and review the one versioned migration artifact and database access matrix; test schema drift, constraints and legacy quarantine before frontend cutover.

## Backup, rollback and cutover checklist

- Confirm real repository HEAD/worktree and refresh live schema before preparing the final migration; do not infer alignment from chat commit metadata.
- Obtain and rehearse a verified schema/data/ACL/function/trigger/Auth-aware backup/restore in isolation. Verify backup/PITR availability and retain post-backup-write reconciliation instructions.
- Review generated migration artifact/version, exact policy/RPC access matrix, locks/runtime, transactional failure behavior and all real PASS/FAIL evidence.
- Pass full Stage B SQL, PostgREST, multi-session race and regression suites before changing frontend behavior. Then implement Stage C and run TypeScript/build/lint/browser/auth/export/cache and scraper regressions.
- Keep the current application on the current schema until a coordinated approved cutover. Maintenance UI alone does not stop direct API writes; any enforced freeze requires separate approval.
- Obtain explicit production schema-change approval of the actual package. This request grants only local/staging work; no production approval is implied.
- Roll back migration transactions on failure. After private writes exist, never restore permissive old policies/old raw-table clients as a rollback: fail closed/admin-only and forward-fix while preserving private records/history. Backup restore requires explicit approval and write reconciliation.
- Push only with explicit user approval after checks. Deployment and production API/VPS remain separately owner-controlled.

**Next dependency:** connect an isolated staging Supabase project and make repository/process verification available. Stage A migration generation and full acceptance implementation must then resume; no frontend cutover or production execution is authorized by this handoff.
