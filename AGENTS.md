# Wedding Website

Next.js app for Sean and Lexi's wedding website. The app has four main surfaces:

- `/` - public wedding info page, unless a valid guest cookie redirects to the matching invitation link.
- `/savethedate` - public save-the-date page.
- `/:slug` - guest-specific invitation and RSVP page.
- `/admin` - password-gated guest/RSVP management spreadsheet.

Long-form public/invitation copy lives in Markdown files under `content/` so non-technical editors can update it without touching React code. Current files:

- `content/our-story.md` - the Our Story section.
- `content/schedule.md` - Saturday's schedule for everyone; `content/schedule-friday.md` - the casual Friday welcome event, shown only on invitations whose `fri_din` flag is true; `content/schedule-rehearsal.md` - the Friday wedding rehearsal, shown only when the `reh` flag is true. Each file holds one `##` day heading (`Weekday, Month D, YYYY`) and one `###` event. Under the event, the first paragraph is the time line, a `-` list is the venue block (first line bold, last line muted), and any later paragraph is a pill note (e.g. "Regrets only"). `src/app/schedule-section.tsx` parses these with `readScheduleDay` (in `src/app/markdown-content.tsx`) and renders a fixed design: per day a script weekday over a small-caps one-line date, then centered event cards, each ending in a subtle outlined Add to calendar pill. Files for the same day merge under one date (rehearsal before the welcome party). Two days sit side by side at 1024px+ split by a 囍 rule, and stack on phones. Styles are the `.schedule-*` rules in `src/app/globals.css`.
- `content/hotel-blocks.md` - the dedicated Hotels section. Use `<!-- invitation-only-start title="Hotels" -->` and `<!-- invitation-only-end -->` around booking details that should be hidden on public `/` and shown only on guest invitation pages. Keep individual hotel names as `###` headings so they render as prominent hotel blocks.
- `content/faqs.md` - the FAQ section. Keep hotel block booking details in `content/hotel-blocks.md`, not in FAQs.
- `content/registry.md`, `content/registry-amazon.md`, and `content/registry-fund.md` - the shared Gifts introduction and its two gift options. Receiving destinations live in `src/lib/registry.json`; the Venmo QR asset is generated from its URL.

The shared Sexi Adventures gallery is driven by image files in the repo-root `photos/` directory, not Markdown or hard-coded arrays. After adding, removing, or replacing supported image files there, run `npm run photos:generate` so the rendered gallery uses the updated static WebP assets and manifest.

The package currently uses `next` 16.x with React 19, Tailwind CSS 4, TypeScript, Neon/Postgres, and `react-data-grid`.

## Commands

- `npm run dev` - Start development server with Turbopack.
- `npm run build` - Build for production with Turbopack.
- `npm run lint` - Run ESLint.
- `npm run db:migrate` - Run every SQL file in `migrations/` against `DATABASE_URL`.
- `npm run photos:generate` - Regenerate static WebP gallery assets and `src/lib/generated/photo-manifest.json` from repo-root `photos/`.
- `npm run registry:generate` - Regenerate the static receiving QR SVG after changing the verified Venmo URL in `src/lib/registry.json`.

Use npm for scripts and dependency installs. `package-lock.json` is the lockfile of record.

## Environment and Database

- Local development expects `DATABASE_URL`; `.env.local` points at `postgresql://localhost:5432/wedding_local`.
- `src/lib/db.ts` chooses `pg.Pool` for localhost/127.0.0.1/::1 connection strings and Neon serverless SQL for remote connection strings.
- The app code will also read `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, or `POSTGRES_URL_NON_POOLING` as fallbacks, but `scripts/migrate.mjs` requires `DATABASE_URL`.
- Migrations are idempotent SQL files sorted by filename. There is no migration ledger table; rerunning migrations reapplies all guarded statements. Keep them safe to rerun against populated data, since every production build reruns them all.

## Claude Code Cloud Sessions

- `.claude/settings.json` runs `scripts/cloud-session-start.sh` on SessionStart. It exits immediately unless `CLAUDE_CODE_REMOTE=true`, so it only does work in cloud sessions.
- In the cloud it runs `npm ci` when `package.json`, `package-lock.json`, `.npmrc`, or the script change; starts the VM's pre-installed PostgreSQL 16; creates `wedding_local` owned by a VM-local `wedding` role; writes `.env.local` if missing; runs migrations; and loads `scripts/dev-seed.sql` sample guests when `wedding_guests` is empty.
- `.env.local` uses the cloud environment's `ADMIN_PASSWORD` when set, otherwise a random one. Read it from `.env.local` to log in to `/admin`.
- Cloud sessions have no production credentials. Never set `DATABASE_URL` in the cloud environment's variables: process env wins over `.env.local`, so dev, build, and `db:migrate` would all point at it.
- `.gitignore` re-includes only `.claude/settings.json` from `.claude/`; keep local state such as `settings.local.json`, `launch.json`, and `worktrees/` untracked.

## Workflow

- After making any requested changes, always commit and push directly to the `main` branch (never a feature branch or PR).
- Then wait for the deploy to finish and verify the changes on the live website at `https://sexiwedding.com`.
- Show screenshots in the chat as early as possible: as soon as a visual change renders locally, capture screenshots of the relevant pages (mobile width first) and send them to the user before committing and pushing, then send more when verifying on the live site. Send them rather than only describing what changed.
- Sharing screenshots is not a confirmation step: do not wait for the user to reply before pushing to `main`.

## Deployment

- Production is hosted on Vercel at `https://sexiwedding.com`.
- Production migrations run automatically: `vercel.json` sets the build command to run `npm run db:migrate` before `npm run build` when `VERCEL_ENV` is `production`, so every production deployment migrates before the new code goes live and a failed migration fails the deploy. Preview builds skip migrations because Preview shares the production `DATABASE_URL`, so never run unmerged migrations from a preview. Do not run `npm run db:migrate` against production by hand unless explicitly instructed.
- Do not make changes, submit forms, clear cookies, run migrations, or otherwise mutate anything in production at `sexiwedding.com` unless explicitly instructed. It is OK to read from production for verification or debugging.

## Data Model

Core tables:

- `wedding_guests` - one row per invitation link. Important columns are `name`, `slug`, `notes`, `phone_number`, `email_address`, `guest_count`, `invite_sent`, `fuck_yes`, `fri_din` (Friday welcome dinner), `reh` (wedding rehearsal), and `sort_order`. Everyone invited to the rehearsal is invited to Friday dinner: `updateGuestReh` turns `fri_din` on with `reh`, and `updateGuestFriDin` turns `reh` off with `fri_din`.
- `wedding_rsvps` - one current RSVP per guest, keyed by `guest_id`; also stores the invitation's optional mailing address in `mailing_address_line1`, `_line2`, `_city`, `_region`, `_postal_code`, and `_country` (empty strings when unset).
- `wedding_rsvp_attendees` - per-person current RSVP details, keyed by RSVP and 1-based `position`; stores place-card name, optional meal type, and optional dietary/allergy notes.
- `wedding_rsvp_audit_events` and `wedding_rsvp_audit_attendees` - append-only RSVP edit history (including the mailing address at each save), with soft deletion for deleted guests' audit rows.
- `wedding_photos` - one metadata row per repo-root `photos/` image, storing manual gallery order and optional `hidden_at` visibility state.

`guest_count` is the maximum attending count for the invitation and is constrained to 1-10. RSVP statuses are `yes`, `no`, and `deciding`. For `yes`, `attending_count` is required; for `no` and `deciding`, it must be null.

## Routes and Flow

- `src/app/page.tsx`: root route. If the guest cookie contains a valid existing slug, it redirects to `/:slug`; otherwise it shows the public wedding info page.
- `src/app/savethedate/page.tsx`: public save-the-date page with calendar/map links and static Open Graph metadata.
- `src/app/[slug]/page.tsx`: dynamic invitation page. It loads guest, RSVP, and attendee data by slug; missing slugs call `notFound()`. The route is `force-dynamic` because it depends on database state and cookies.
- `src/app/[slug]/rsvp-form.tsx`: client RSVP form. It autosaves when status/count selections change and saves per-person place-card names, meal choices, and dietary/allergy notes on blur, meal selection, or explicit Save.
- `src/app/[slug]/actions.ts`: server action that validates and persists RSVP changes.
- `src/app/admin/page.tsx`: admin page. Without a valid admin cookie it shows the login form; with the cookie it loads guests and RSVP audit events.
- `src/app/admin/admin-client.tsx`: spreadsheet UI for adding, editing, sorting, reordering, copying links, viewing links, deleting guests, and toggling flags.
- `src/app/admin/photos/page.tsx`: admin photo manager for reordering Sexi Adventures photos and hiding/restoring individual images without deleting files.
- `src/app/[slug]/opengraph-image.tsx`, `src/app/savethedate/opengraph-image.tsx`, and `src/lib/opengraph-image.tsx`: generated PNG Open Graph images for per-guest invitation links and the public save-the-date link.

Global styling lives in `src/app/globals.css`. The shared public/invitation page shell lives in `src/app/wedding-page-shell.tsx` (section order and sticky in-page navigation live in the client `src/app/wedding-page-layout.tsx`), renders long-form Markdown content from `content/`, renders the static-manifest-backed Sexi Adventures gallery when generated photo assets exist, and uses `public/sexi-background.jpg`; Open Graph image generation uses local fonts from `public/fonts/`.

## Open Graph Images

Open Graph images are a high-priority part of the experience for invitation and save-the-date links because these are shared directly with guests. Other pages should not add generated OG images unless explicitly requested.

- `/savethedate/opengraph-image` must look polished for the public save-the-date link.
- `/{slug}/opengraph-image` must look polished for each unique invitation link and include the guest name cleanly. Guests whose saved RSVP is `yes` get a different image (`generateAttendingOgImage`): the full photo with faces kept clear, the brand at the top, and "Name, / wedding details inside" in a dark-green fade below the chins; their page metadata uses the matching title and adds `?rsvp=yes` to the image URL so link-preview caches refetch it. Everyone else gets the "you're invited!" image (`generateInvitationOgImage`).
- The OG renderer (Satori) ignores the CSS `inset` shorthand; use explicit `top`/`left`/`right`/`bottom` for overlays.
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
- For each attending person, guests can enter a place-card name, choose one optional meal type (`beef`, `fish`, or `vegetarian`), and add optional dietary/allergy notes. Meal type and dietary notes are saved per attendee position. The form is laid out compactly for phones: status choices sit in one row (selected choices fill pink), multi-guest invitations show an "N of M done" progress bar, each person's card carries a "Needs name & meal" / "All set" badge, unselected meals shrink to their dish names once one is picked, and the dietary note stays behind a "+ Add dietary restrictions or allergies" link until opened or filled (a hidden empty `attendeeDietaryNotes` input keeps positions aligned while collapsed).
- When the guest chooses a `yes` option (attending), the form shows one optional Mailing Address block per invitation (street, apt/unit, city, state, ZIP, plus a country field revealed by "Outside the US? Add a country" or when a saved address has one). Inputs use `shipping address-*` autocomplete tokens so phone/browser autofill fills them in one tap. Pasting a whole address into the street box splits it into the fields via `parsePastedMailingAddress` in `src/lib/mailing-address.ts` (US/Canadian formats; anything unrecognized pastes normally). The block saves when focus leaves it (only if it has unsaved edits), after a typing pause, right after a parsed paste, and with every other RSVP save. The block is hidden for `no` and `deciding`, but a previously entered address is kept (and resent with saves) if the guest switches away from yes. It is not required.
- The server stores attendee rows when any per-person detail is present. It does not enforce that every attending slot has a place-card name or meal choice, even though the UI asks guests to provide them.
- Every successful RSVP save upserts `wedding_rsvps`, replaces current attendee rows, and inserts an RSVP audit event plus audit attendee rows.
- RSVP saves call `revalidatePath("/{slug}")`.
- Save state is always visible in a status bar at the bottom of the form, next to the **Save** button. Once the guest has picked a status the bar is `sticky bottom-0`, so it stays on screen while they scroll the form (before that it sits statically at the panel bottom so it doesn't cover the hero). States: "No RSVP yet", "Not saved yet" (typed edits pending, or `yes` without a count; the Save button turns solid pink), "Saving…" (spinner, held at least 450ms so it registers; the Save button turns obviously gray), "All changes saved" / "Last saved at <time>" (pink check that pops in on each save), "Saved!" / "Your RSVP is recorded." after an explicit Save click (stays until the guest changes any field), and "Not saved" with the error (including a network failure) when a save fails.
- Choice buttons save immediately. Typed fields (place-card names, dietary notes, mailing address) save 1.5s after typing pauses, on blur (address: when focus leaves the block), when the page is hidden, or with Save; `editVersion`/`requestedVersion` refs in `rsvp-form.tsx` track which edits a save covered, and leaving the page with unsaved edits triggers the browser's leave-page warning.
- A `yes` status with a missing/out-of-range attending count declines to save without an inline error; the status bar reads "Not saved yet / Choose how many are attending." Server-side count validation still applies.

Be careful changing validation: database constraints, server action validation, and client form behavior all need to agree.

## Admin Behavior

- Admin auth is a simple HTTP-only cookie. The password comes from the `ADMIN_PASSWORD` environment variable, and cookie names are in `src/lib/cookies.ts`; do not duplicate the password elsewhere.
- Admin login is rate-limited in `wedding_admin_login_attempts` by request IP: 5 wrong attempts in 15 minutes locks that IP out for 15 minutes. Successful login clears the bucket.
- `/admin` uses `react-data-grid` with all rows rendered and a responsive width calculation.
- A search bar above the grid filters guests client-side. It splits the query into whitespace tokens and keeps a guest when every token appears in its name or any RSVP place-card (attendee full) name, so "Sean" and "Lexi" both match the "Sean and Lexi" invitation. Filtering only changes which rows render; cell edits still save by guest id, and drag-to-reorder is disabled while a search is active.
- Editable columns are Name, URL, Notes, Phone, Email, and Max. URL is locked when `invite_sent` is true. The read-only Mailing address column shows the guest-entered RSVP address.
- The Fri Din and Rehearsal checkbox columns toggle `fri_din`/`reh` (see the Data Model note on how they stay consistent). Friday dinner and Rehearsal buttons next to the search bar filter the grid to just those guests (click again to clear); they combine with search and also disable drag-to-reorder.
- Sorting is URL-driven with `?sort=...&dir=...`. Default sort uses `sort_order`.
- Drag-to-reorder is available only in default sort; it saves the full ordered guest id list through `reorderGuestRows`.
- The Incomplete section (at the top, between the header and the add-guest form; collapsible, with each browser remembering open/closed in localStorage) lists invitations that haven't said yes or no (no RSVP or `deciding`, with an "Invite not sent" tag when applicable) and `yes` invitations where any attending person is missing a place-card name or meal choice, naming who needs what. Every row has the same copy-link and view-invitation buttons as the grid's Actions column (`InvitationLinkButtons`). The logic is `findIncompleteRsvps` in `src/app/admin/rsvp-summary.ts`.
- The Export CSV button downloads the loaded admin data as one CSV with `guest` rows for current invitation/RSVP/contact state and `rsvp_audit` rows for visible RSVP edit history, including per-person place-card, meal, and dietary details and the one-line mailing address.
- Deleting a guest requires typing `delete`, soft-deletes visible audit events for that guest, then deletes the guest row. RSVP and attendee rows cascade from foreign keys.
- The audit table shown in admin filters to RSVP events, hides the `Sean and Lexi` guest name, and includes compact per-person place-card, meal, and dietary details.
- `/admin/photos` is linked from the admin header and lets admins manually reorder the Sexi Adventures gallery or hide/restore photos. Hidden photos remain in `photos/` and can be brought back from the same page.

## Implementation Notes

- Keep this `AGENTS.md` file current as the site changes. If routes, deployment, data model, invitation-link behavior, RSVP rules, admin workflows, styling conventions, Markdown content structure, or validation commands change, update this guide in the same work.
- `src/lib/db.ts` maps snake_case database rows to camelCase TypeScript types. Prefer adding database access helpers there instead of scattering SQL through UI files.
- Use `revalidatePath` for any server action that changes data visible on `/admin` or a guest slug route.
- Keep `RESERVED_TOP_LEVEL_PATHS` in `src/proxy.ts` updated if adding new top-level public routes, or a route name that matches the slug pattern may be treated as a guest link.
- Guest-specific metadata in `src/app/[slug]/page.tsx` uses `/{slug}/opengraph-image`; if slug routing changes, update metadata and image routing together.
- `INVITATION_BASE_URL` in `admin-client.tsx` is hardcoded to `https://sexiwedding.com` for copied links.
- All long-form content should be driven by Markdown files in `content/`, not hard-coded in React or TypeScript. The renderer for these files lives in `src/app/markdown-content.tsx`.
- Public `/` keeps Markdown invitation-only blocks locked behind an invitation link; guest invitation pages render those blocks.
- Section order (page and sticky nav) is RSVP/Wedding Details, Schedule, Gifts, Hotels, FAQs, Our Story, Sexi Adventures. On invitation pages whose saved RSVP status is `no`, or `yes` with every attending person's place-card name and meal filled in (computed in `src/app/[slug]/page.tsx`), Schedule moves above RSVP (into the hero slot) in both the page and the nav. `src/app/wedding-page-layout.tsx` freezes that order on first render so an RSVP save that refreshes the route never moves the form mid-edit; the new order applies on the next visit. Every Schedule event card has its own subtle outlined Add to calendar pill (calendar icon + small caps) for all visitors (event calendar URLs live in `src/app/wedding-details.ts`); the same frozen flag (`data-schedule-first` on the layout wrapper) hides the hero Add to calendar link for RSVP'd guests. For those guests the hero date/venue card is also omitted, and the `Sean + Lexi = Sexi` brand mark renders at the top of the sticky nav instead. Their hero is framed from two points measured on `public/sexi-background.jpg` (CSS variables on `.guest-invitation-page:has([data-schedule-first="true"])` in `globals.css`): the photo is positioned so the sticky nav ends where Sean's hat meets his forehead, and `.guest-hero-section-schedule-first` pads the Schedule card to start just below Lexi's chin, on every viewport size. The photo grows only when needed to reach the bottom of tall screens. If the background photo or the nav height changes, re-measure `--hero-hat-line`/`--hero-chin-line` and `--hero-nav-bottom`. Anchor jumps get a larger `scroll-margin-top` to clear the taller nav. At 640px+ the nav can grow to 46rem so its links fit on one row. Schedule (`#schedule`) has a matching navigation link. Its Friday content is conditionally rendered on the server from `guest.friDin` and `guest.reh`; public pages and unselected guests receive only Saturday's events.
- FAQ questions in `content/faqs.md` render as collapsible dropdowns; keep each question as a `###` heading followed by its answer content.
- The Gifts section (`#registry`) appears on both public and invitation pages with two options: Amazon and monetary gifts using Venmo or Zelle, labeled "Contribute to our next chapter." Venmo displays its handle, link, and QR code on all screen sizes. Zelle displays only its verified phone number, without a link or QR code. Keep the Venmo receiving link and QR asset in sync, without extra instructions or copy controls. Never invent payment destinations or publish account numbers.
- Keep the website's Amazon registry copy generic. Individual gift item details belong only inside the Amazon registry.
- Keep monetary-gift wording neutral without earmarking gifts for honeymoon, travel, or another intended use.
- Monetary gifts are for both Lexi and Sean. Keep this clear with a short shared statement above the payment options; omit account-name explanations.
- In-page anchor offsets allow for a three-row sticky navigation below 640px; verify section headings remain visible when changing navigation items.
- The Sexi Adventures gallery source files live in repo-root `photos/`. Run `npm run photos:generate` after adding, removing, or replacing supported files there; the app renders committed static WebP assets from `public/optimized-photos/` plus `src/lib/generated/photo-manifest.json`, merges that manifest with `wedding_photos` metadata for order and visibility, and uses `react-photo-album` plus `yet-another-react-lightbox`. Do not hard-code gallery image lists in React.
- Keep public gallery and admin photo thumbnails off `next/image` and `/_next/image`; the static generated assets avoid Vercel Image Optimization usage and origin-function image transfer.
- Design uses a green/pink wedding palette, Cormorant/Libre serif fonts with Great Vibes for the `Sean + Lexi = Sexi` brand mark, pink-accent double-happiness glyphs, pink-tinted Our Story emoji, high-contrast large long-form copy, and a spreadsheet-like admin UI. Keep new UI consistent with those patterns.
- The shared public/invitation hero foreground should keep the same single-column stack across mobile and desktop widths; only the background photo framing should make major viewport-specific shifts.
- Public/invitation pages use a smaller type scale (`html:has(.guest-invitation-page)` sets the root font size to 87.5%), while form fields stay at 16px+ so iOS Safari does not zoom on focus. Schedule dates never wrap (`white-space: nowrap` on `.schedule-day-date`).
- Guests will primarily use the site on phones. Treat mobile layouts as the primary experience, especially for invitation pages, RSVP controls, forms, tap targets, safe-area spacing, and text wrapping.

## Validation Before Hand-off

For code changes, run at least:

- `npm run lint`
- `npm run build`

Always test non-trivial changes in the browser against a local dev server. Local testing is fair game: you may clear cookies, submit forms, edit local data, and reset local browser state as needed. Do not do destructive or mutating tests against production.

For schema changes, add a new numbered SQL file under `migrations/`, run `npm run db:migrate` locally, and confirm the app still builds.
