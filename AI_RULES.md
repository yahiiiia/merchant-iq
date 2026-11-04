# Tech Stack

- You are building a React application.
- Use TypeScript.
- Use React Router. KEEP the routes in src/App.tsx
- Always put source code in the src folder.
- Put pages into src/pages/
- Put components into src/components/
- The main page (default page) is src/pages/Index.tsx
- UPDATE the main page to include the new components. OTHERWISE, the user can NOT see any components!
- ALWAYS try to use the shadcn/ui library.
- Tailwind CSS: always use Tailwind CSS for styling components. Utilize Tailwind classes extensively for layout, spacing, colors, and other design aspects.

Available packages and libraries:

- The lucide-react package is installed for icons.
- You ALREADY have ALL the shadcn/ui components and their dependencies installed. So you don't need to install them again.
- You have ALL the necessary Radix UI components installed.
- Use prebuilt components from the shadcn/ui library after importing them. Note that these files shouldn't be edited, so make new components if you need to change them.

# Backend and access control

- MerchantIQ uses the connected Supabase project for PostgreSQL and Auth. Business data is not a browser-only demo; never restore seeded data or silent demo fallbacks.
- Tables are profiles, merchants, contacts, leads. Existing field column names use quoted camelCase. Query hooks/async mutations are in src/lib/crm.tsx; fields/CSV helpers are in src/lib/crm-fields.ts.
- Exactly two roles: super_admin and business_user. Pending/approved/disabled are separate profile states. New signups are pending Business Users; first-admin approval is a trusted explicit action, never first-signup promotion.
- Enforce approval/roles in database RLS and guarded routes. Profile role/status updates use crm_manage_user; direct authenticated profile writes are not granted. Only Super Admins may delete records, invoke administrative imports, access Access or VPS Control.
- Use server-side CRM queries and database dashboard aggregates. Writes must await database success before showing success. No service-role credentials in browser code.
- VPS Control remains disconnected. Do not add scrapers, agents, VPS endpoints, credentials, or infrastructure operations unless separately requested.
- See README.md for schema behavior, auth callbacks/bootstrap, and verification limitations.
