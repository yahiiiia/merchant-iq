# MerchantIQ

A focused merchant CRM demonstration built with React, TypeScript, React Router, Tailwind, shadcn/ui, and Recharts.

## Current status

- **Demo only:** 16 fictional merchants, 10 contacts, and 8 linked leads. CRM state lives exclusively in React memory and resets on reload. No database or browser storage is used for business records. The theme preference may be stored by next-themes.
- **No authentication or authorization:** all pages and demo CRUD/import/export operations are public. There is no working account, login, role switcher, or approval system. Access documents planned roles; it is not a protected administration page.
- **No VPS integration:** VPS Control is a disconnected, non-operational placeholder. No backend, credentials, connections, scrapers, agents, or infrastructure metrics are configured.
- Demo import accepts the downloadable merchant template, up to 5 MB / 2,000 rows. It generates new IDs and ingestion timestamps. Contact relationships must be added through the UI after import. Export includes IDs and metadata and is not the import template. Spreadsheet formula-like values are escaped during export.

## Application structure

- Routes stay in `src/App.tsx`.
- `src/lib/crm.tsx`: linked in-memory entities, field definitions, duplicate indicators, relational save/delete operations, CSV helpers.
- `src/components/CRMLayout.tsx`: responsive navigation, demo notices, light/dark toggle.
- `src/components/RecordEditor.tsx`: complete merchant/contact/lead forms.
- `src/pages/Index.tsx`: dashboard computed from current records.
- `src/pages/Records.tsx`: client-side search, filters, sorting, selection, pagination and exports.
- `src/pages/RecordDetail.tsx`: record fields and linked detail views.
- `src/pages/Access.tsx`, `src/pages/VPSControl.tsx`: explicit non-operational administration pages.

Merchants hold business information. Contacts reference merchants by `merchantId`. Leads reference a merchant and an optional contact belonging to that merchant. Merchants optionally reference a primary contact. Contact reassignment or removal clears incompatible primary-contact links; merchant deletion cascades to its demo contacts and leads. Unknown payment volumes are represented by null, never inferred. Assignment in demo leads is a text label, not an authenticated user relationship.

## Before production use

1. Choose a backend/database and authentication provider. Do not use this public demo for sensitive data.
2. Create persistent merchants, contacts, leads, and profiles with stable IDs, foreign keys, validation, timestamps, optional source IDs, and ingestion timestamps.
3. Implement exactly two roles: Super Admin and Business User, with separate pending/approved account state. Public registration must not grant business access before administrator approval. Bootstrap the first Super Admin through a trusted process; prevent self-assigned roles.
4. Enforce authorization on database operations and protected routes. Restrict deletion/import, Access, and VPS Control to approved Super Admins. Associate lead assignments with actual profile IDs.
5. Replace client-side directory operations with indexed server-side search/filter/sort/pagination, and backend dashboard aggregates for larger datasets. Re-test exports and imports against authorization policies.
6. Perform browser interaction, accessibility, responsive-layout and security testing, including direct URL access and denied database operations.
7. Implement a separately scoped secure VPS integration only when explicitly requested. Keep secrets out of frontend code and introduce real health/job/log data only after establishing a connection.
