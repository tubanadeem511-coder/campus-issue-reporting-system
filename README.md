# CampusFix — Electronic Issue Reporting System

CampusFix is a responsive campus maintenance portal built with Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/Storage, Recharts, and Lucide React.

## Implemented

- Student email/password registration and sign-in through Supabase Auth.
- Student complaint submission for Computer, Projector, Fan, Light, and Wi-Fi issues, with location, details, optional validated JPG/PNG/WebP image, and a generated reference number.
- Private student complaint list, detail view, signed image preview, and status history. Student queries are owner-scoped and enforced by RLS.
- Admin dashboard with database-backed summary cards, complaint search and filters (status, category, building, and date range), detail links, and status updates.
- Admin category and status charts with date filters. Chart totals are computed over paginated database results.
- Server-side bearer-token verification, database role check, RLS on application tables and image objects, and a status history trigger recording the admin and timestamp.
- Clear missing-configuration messages. No service-role key or credentials are included in browser code.

## Requirements

- Node.js 20 or newer and npm.
- A Supabase project with email/password Auth enabled.

## Local development

1. Install packages with `npm install`.
2. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable (anon) key. These two values may be used by browser code; never put a service-role key in a `NEXT_PUBLIC_` variable.
3. In Supabase SQL Editor, run `supabase/migrations/202610120001_campusfix.sql` against a **fresh project**. The migration creates the profile signup trigger, tables, indexes, RLS policies, private image bucket, and storage policies. If adapting it to an existing database, inspect and reconcile existing tables and storage policies first; this initial schema is not a data migration.
4. In Supabase Auth settings, enable email/password and set the site URL and local redirect URL (`http://localhost:3000`). Configure email confirmation to match your institution’s account policy.
5. Run `npm run dev` and open http://localhost:3000. Create an account, confirm email if required, sign in, and submit a report.

If Supabase variables or the SQL migration are missing, authentication and database-backed flows show errors; the app does not substitute local browser storage or sample records.

## Assign the first administrator safely

1. Create or register the intended administrator using Supabase Auth. Require a strong password and email confirmation per campus policy.
2. In Supabase **Authentication → Users**, copy that account’s UUID. Confirm the corresponding profile exists in `public.profiles`.
3. In the Supabase SQL Editor, execute this statement with the verified UUID:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
   ```

   Verify exactly one row was updated. Do not expose SQL Editor access, database credentials, or an admin role editor to students. New signups are always assigned `student` by a database trigger; profile RLS prevents users from promoting their own role.
4. Sign out and back in with that account. The admin page and every admin API request verify the signed-in user and read their database role on the server; hiding the admin link in the UI is not the security boundary.

## Storage and privacy

The migration creates a **private** `complaint-images` bucket, limited to 5 MB and JPG/PNG/WebP. Authenticated uploads must be stored under `<auth-user-uuid>/<random-file-name>`; storage RLS allows the owning student and database-authorized admins to read. The app validates file size, MIME type, and file signature before upload. Image display uses short-lived signed URLs. Do not make the bucket public or add broad `storage.objects` policies.

Students can select only their own complaints and cannot update complaint rows. The complaint status column is the only update privilege granted to authenticated users, and an RLS policy restricts that update to admins. Students cannot read another owner’s complaint or status history. Keep RLS enabled and review policies before changing table grants.

## Environment variables

See `.env.example`. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are needed. No service-role key is required by this implementation.

## Validation commands

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Manual integration checks against your own Supabase project:

1. Register two students; confirm both profiles default to `student`.
2. Submit complaints with and without valid images. Verify the generated reference and private storage object; try an oversized file, wrong MIME, and mismatched file signature.
3. Confirm each student lists and opens only their own complaints. Attempt another student’s complaint UUID and confirm the request is denied/not found.
4. Attempt direct status update as a student and confirm RLS denies it.
5. Promote the designated admin using the SQL above. Confirm admin summaries, search, each filter, image links, and status changes work. Verify history stores the prior/new status, timestamp, and admin UUID.
6. Confirm a student cannot access admin APIs or reports, and direct anon/authenticated table access respects RLS.
7. Check registration, sign-in, submission, tracking, and admin workflows at mobile, tablet, and desktop viewport widths.

A production build and TypeScript check do not prove Supabase integration. Live Auth, RLS, storage, email configuration, and end-to-end role flows must be exercised against the configured project before deployment is treated as production-ready.

## GitHub and Vercel

1. Commit and push the repository to GitHub. Ensure `.env.local` is ignored and never commit real credentials.
2. Import the repository into Vercel and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the project’s Environment Variables for Preview and Production.
3. In Supabase Auth, set the production Site URL to the deployed domain and add the Vercel preview/production redirect URLs your campus will use.
4. Apply and verify the migration and storage policies in the intended Supabase project before directing users to the site.
5. Deploy, verify student and admin flows in the deployed environment, review Supabase Auth logs and database policies, and keep account recovery and administrator offboarding processes current.

## Project structure

```text
app/
  api/complaints/       Authenticated complaint and admin API
  admin/                Protected admin dashboard and analytics
  complaints/           Student list, submission, and details
  login/ register/      Supabase Auth pages
  ui/                   Shared auth context and responsive shell
lib/                    Supabase client and server authorization
supabase/migrations/    PostgreSQL schema, RLS, triggers, storage policies
```
