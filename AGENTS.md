# Wedding Website

Next.js app for Sean and Lexi's wedding website. The app has four main surfaces:

- `/` - public wedding info page, unless a valid guest cookie redirects to the matching invitation link.
- `/savethedate` - public save-the-date page.
- `/:slug` - guest-specific invitation and RSVP page.
- `/admin` - password-gated guest/RSVP management spreadsheet.

Long-form public/invitation copy lives in Markdown files under `content/` so non-technical editors can update it without touching React code. Current files:

- `content/our-story.md` - the Our Story section.
- `content/hotel-blocks.md` - the dedicated Hotels section. Use `<!-- invitation-only-start title="Hotels" -->` and `<!-- invitation-only-end -->` around booking details that should be hidden on public `/` and shown only on guest invitation pages. Keep individual hotel names as `###` headings so they render as prominent hotel blocks.
- `content/faqs.md` - the FAQ section. Keep hotel block booking details in `content/hotel-blocks.md`, not in FAQs.

The package currently uses `next` 16.x with React 19, Tailwind CSS 4, TypeScript, Neon/Postgres, and `react-data-grid`.

## Commands

- `npm run dev` - Start development server with Turbopack.
- `npm run build` - Build for production with Turbopack.
- `npm run lint` - Run ESLint.
- `npm run db:migrate` - Run every SQL file in `migrations/` against `DATABASE_URL`.

Use npm for scripts. The repo has both `package-lock.json` and `pnpm-lock.yaml`, but the documented workflow is npm.

## Environment and Database

- Local development expects `DATABASE_URL`; `.env.local` points at `postgresql://localhost:5432/wedding_local`.
- `src/lib/db.ts` chooses `pg.Pool` for localhost/127.0.0.1/::1 connection strings and Neon serverless SQL for remote connection strings.
- The app code will also read `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, or `POSTGRES_URL_NON_POOLING` as fallbacks, but `scripts/migrate.mjs` requires `DATABASE_URL`.
- Migrations are idempotent SQL files sorted by filename. There is no migration ledger table; rerunning migrations reapplies all guarded statements.

## Deployment

- Production is hosted on Vercel at `https://sexiwedding.com`.
- After committing and pushing to `main`, always run `npm run db:migrate` against production.
- Do not make changes, submit forms, clear cookies, run migrations, or otherwise mutate anything in production at `sexiwedding.com` unless explicitly instructed. It is OK to read from production for verification or debugging.

## Data Model

Core tables:

- `wedding_guests` - one row per invitation link. Important columns are `name`, `slug`, `notes`, `phone_number`, `email_address`, `guest_count`, `invite_sent`, `fuck_yes`, and `sort_order`.
- `wedding_rsvps` - one current RSVP per guest, keyed by `guest_id`.
- `wedding_rsvp_attendees` - per-person current RSVP details, keyed by RSVP and 1-based `position`; stores place-card name, optional meal type, and optional dietary/allergy notes.
- `wedding_rsvp_audit_events` and `wedding_rsvp_audit_attendees` - append-only RSVP edit history, with soft deletion for deleted guests' audit rows.

`guest_count` is the maximum attending count for the invitation and is constrained to 1-10. RSVP statuses are `yes`, `no`, and `deciding`. For `yes`, `attending_count` is required; for `no` and `deciding`, it must be null.

## Routes and Flow

- `src/app/page.tsx`: root route. If the guest cookie contains a valid existing slug, it redirects to `/:slug`; otherwise it shows the public wedding info page.
- `src/app/savethedate/page.tsx`: public save-the-date page with calendar/map links and static Open Graph metadata.
- `src/app/[slug]/page.tsx`: dynamic invitation page. It loads guest, RSVP, and attendee data by slug; missing slugs call `notFound()`. The route is `force-dynamic` because it depends on database state and cookies.
- `src/app/[slug]/rsvp-form.tsx`: client RSVP form. It autosaves when status/count selections change and saves per-person place-card names, meal choices, and dietary/allergy notes on blur, meal selection, or explicit Save.
- `src/app/[slug]/actions.ts`: server action that validates and persists RSVP changes.
- `src/app/admin/page.tsx`: admin page. Without a valid admin cookie it shows the login form; with the cookie it loads guests and RSVP audit events.
- `src/app/admin/admin-client.tsx`: spreadsheet UI for adding, editing, sorting, reordering, copying links, viewing links, deleting guests, and toggling flags.
- `src/app/*/opengraph-image.tsx` and `src/lib/opengraph-image.tsx`: generated PNG Open Graph images for public save-the-date and per-guest invitation links.

Global styling lives in `src/app/globals.css`. The shared public/invitation page shell lives in `src/app/wedding-page-shell.tsx`, includes sticky in-page section navigation, renders long-form Markdown content from `content/`, and uses `public/sexi-background.jpg`; Open Graph image generation uses local fonts from `public/fonts/`.

## Open Graph Images

Open Graph images are a high-priority part of the experience because these links are shared directly with guests.

- `/savethedate/opengraph-image` must look polished for the public save-the-date link.
- `/{slug}/opengraph-image` must look polished for each unique invitation link and include the guest name cleanly.
- `src/lib/opengraph-image.tsx` contains both generators. It reads local font files from `public/fonts/` and uses `public/sexi-background.jpg` for invitation images.
- When changing copy, dates, venue details, slug routes, fonts, or background imagery, verify the affected OG image too, not just the rendered page.

## Unique Invitation Links

Unique invitation links are implemented as database slugs:

1. Admin creates a guest in `/admin`.
2. The add form derives a slug with `slugify(name)` unless the slug field is manually edited.
3. `addGuest` validates the slug with `isValidSlug` and inserts it into `wedding_guests.slug`, which is unique in the database.
4. The admin Actions column copies or opens `https://sexiwedding.com/{slug}`.
5. Visiting `/{slug}` loads the matching guest and shows their invitation and RSVP form.

Slug rules are centralized in `src/lib/slug.ts`: lowercase letters, numbers, and single dashes, with no leading/trailing dash. Keep admin-side slug drafting and server-side slugification in sync if slug behavior changes.

`src/proxy.ts` is the middleware-like entrypoint for invitation cookies:

- A guest slug path is exactly one top-level segment, not `admin` or `savethedate`, and must match the slug pattern.
- On `GET /{slug}`, if the slug exists in `wedding_guests`, the proxy sets the `sexi-guest` cookie to that slug.
- On `GET /`, if `sexi-guest` is a valid existing slug, the proxy redirects to `/{slug}`. `/savethedate` stays public and does not redirect based on the guest cookie.
- `src/app/page.tsx` repeats the root redirect as a fallback, then renders the public wedding info page when there is no valid guest cookie.

The RSVP server action does not trust the form slug alone. `autosaveRsvp` permits saving only when either:

- the admin cookie is valid, or
- the `sexi-guest` cookie exactly matches the submitted slug.

This means guests must open their invitation link before saving, and the link itself is effectively the guest's invitation token. Anyone with the link can open it and receive the matching guest cookie, so do not treat slugs as secret after links are shared.

The admin `Invite sent` checkbox is important for link stability. Once `invite_sent` is true, `updateGuestSlug` refuses slug edits and the grid makes the URL cell non-editable. Preserve this behavior so already-sent links do not break.

## RSVP Behavior

- Normal guests can choose `Yes`, `No`, or `Still deciding`.
- Guests with `fuck_yes` enabled only see `Yes` and `Fuck yes`; both save status `yes`. The server rejects `no` and `deciding` for these guests.
- Single-guest invitations automatically use attending count 1 when status is `yes`.
- Multi-guest invitations require a count from 1 to `guest_count`.
- For each attending person, guests can enter a place-card name, choose one optional meal type (`beef`, `fish`, or `vegetarian`), and add optional dietary/allergy notes. Meal type and dietary notes are saved per attendee position.
- The server stores attendee rows when any per-person detail is present. It does not enforce that every attending slot has a place-card name or meal choice, even though the UI asks guests to provide them.
- Every successful RSVP save upserts `wedding_rsvps`, replaces current attendee rows, and inserts an RSVP audit event plus audit attendee rows.
- RSVP saves call `revalidatePath("/{slug}")`.

Be careful changing validation: database constraints, server action validation, and client form behavior all need to agree.

## Admin Behavior

- Admin auth is a simple HTTP-only cookie. The password comes from the `ADMIN_PASSWORD` environment variable, and cookie names are in `src/lib/cookies.ts`; do not duplicate the password elsewhere.
- Admin login is rate-limited in `wedding_admin_login_attempts` by request IP: 5 wrong attempts in 15 minutes locks that IP out for 15 minutes. Successful login clears the bucket.
- `/admin` uses `react-data-grid` with all rows rendered and a responsive width calculation.
- Editable columns are Name, URL, Notes, Phone, Email, and Max. URL is locked when `invite_sent` is true.
- Sorting is URL-driven with `?sort=...&dir=...`. Default sort uses `sort_order`.
- Drag-to-reorder is available only in default sort; it saves the full ordered guest id list through `reorderGuestRows`.
- The Export CSV button downloads the loaded admin data as one CSV with `guest` rows for current invitation/RSVP/contact state and `rsvp_audit` rows for visible RSVP edit history, including per-person place-card, meal, and dietary details.
- Deleting a guest requires typing `delete`, soft-deletes visible audit events for that guest, then deletes the guest row. RSVP and attendee rows cascade from foreign keys.
- The audit table shown in admin filters to RSVP events, hides the `Sean and Lexi` guest name, and includes compact per-person place-card, meal, and dietary details.

## Implementation Notes

- Keep this `AGENTS.md` file current as the site changes. If routes, deployment, data model, invitation-link behavior, RSVP rules, admin workflows, styling conventions, Markdown content structure, or validation commands change, update this guide in the same work.
- `src/lib/db.ts` maps snake_case database rows to camelCase TypeScript types. Prefer adding database access helpers there instead of scattering SQL through UI files.
- Use `revalidatePath` for any server action that changes data visible on `/admin` or a guest slug route.
- Keep `RESERVED_TOP_LEVEL_PATHS` in `src/proxy.ts` updated if adding new top-level public routes, or a route name that matches the slug pattern may be treated as a guest link.
- Guest-specific metadata in `src/app/[slug]/page.tsx` uses `/{slug}/opengraph-image`; if slug routing changes, update metadata and image routing together.
- `INVITATION_BASE_URL` in `admin-client.tsx` is hardcoded to `https://sexiwedding.com` for copied links.
- All long-form content should be driven by Markdown files in `content/`, not hard-coded in React or TypeScript. The renderer for these files lives in `src/app/markdown-content.tsx`.
- Public `/` keeps Markdown invitation-only blocks locked behind an invitation link; guest invitation pages render those blocks.
- FAQ questions in `content/faqs.md` render as collapsible dropdowns; keep each question as a `###` heading followed by its answer content.
- Design uses a green/pink wedding palette, Cormorant/Libre/Dancing Script fonts, pink-accent double-happiness glyphs, high-contrast large long-form copy, and a spreadsheet-like admin UI. Keep new UI consistent with those patterns.
- The shared public/invitation hero foreground should keep the same single-column stack across mobile and desktop widths; only the background photo framing should make major viewport-specific shifts.
- Guests will primarily use the site on phones. Treat mobile layouts as the primary experience, especially for invitation pages, RSVP controls, forms, tap targets, safe-area spacing, and text wrapping.

## Validation Before Hand-off

For code changes, run at least:

- `npm run lint`
- `npm run build`

Always test non-trivial changes in the browser against a local dev server. Local testing is fair game: you may clear cookies, submit forms, edit local data, and reset local browser state as needed. Do not do destructive or mutating tests against production.

For schema changes, add a new numbered SQL file under `migrations/`, run `npm run db:migrate` locally, and confirm the app still builds.
