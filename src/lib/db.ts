import { neon } from "@neondatabase/serverless";
import { Pool, type QueryResultRow } from "pg";

export type RsvpStatus = "yes" | "no" | "deciding";
export type RsvpAuditEventType = "rsvp" | "guest_name";
export type MealType = "beef" | "fish" | "vegetarian";

export type RsvpAttendeeDetails = {
  fullName: string;
  mealType: MealType | null;
  dietaryNotes: string;
};

export type Guest = {
  id: number;
  name: string;
  notes: string;
  phoneNumber: string;
  emailAddress: string;
  slug: string;
  guestCount: number;
  inviteSent: boolean;
  fuckYes: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Rsvp = {
  id: number;
  guestId: number;
  status: RsvpStatus;
  attendingCount: number | null;
  createdAt: string;
  updatedAt: string;
};

export type RsvpAttendee = {
  id: number;
  rsvpId: number;
  position: number;
  fullName: string;
  mealType: MealType | null;
  dietaryNotes: string;
};

export type GuestWithRsvp = Guest & {
  rsvpStatus: RsvpStatus | null;
  attendingCount: number | null;
  attendeeDetails: RsvpAttendeeDetails[];
};

export type RsvpAuditEvent = {
  id: number;
  eventType: RsvpAuditEventType;
  guestId: number | null;
  guestName: string;
  guestSlug: string;
  guestNamePrevious: string | null;
  guestNameCurrent: string;
  status: RsvpStatus | null;
  attendingCount: number | null;
  attendeeDetails: RsvpAttendeeDetails[];
  createdAt: string;
};

export type GuestPageData = {
  guest: Guest;
  rsvp: Rsvp | null;
  attendees: RsvpAttendee[];
};

export type WeddingPhotoRecord = {
  filename: string;
  sortOrder: number;
  hiddenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type GuestRow = {
  id: number;
  name: string;
  notes: string;
  phone_number: string;
  email_address: string;
  slug: string;
  guest_count: number;
  invite_sent: boolean;
  fuck_yes: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type RsvpRow = {
  id: number;
  guest_id: number;
  status: RsvpStatus;
  attending_count: number | null;
  created_at: string;
  updated_at: string;
};

type RsvpAttendeeRow = {
  id: number;
  rsvp_id: number;
  position: number;
  full_name: string | null;
  meal_type: MealType | null;
  dietary_notes: string | null;
};

type GuestWithRsvpRow = GuestRow & {
  rsvp_status: RsvpStatus | null;
  attending_count: number | null;
  attendee_details: string | null;
};

type RsvpAuditEventRow = {
  id: number;
  event_type: RsvpAuditEventType;
  guest_id: number | null;
  guest_name: string;
  guest_slug: string;
  guest_name_previous: string | null;
  guest_name_current: string;
  status: RsvpStatus | null;
  attending_count: number | null;
  attendee_details: string | null;
  created_at: string;
};

type WeddingPhotoRecordRow = {
  filename: string;
  sort_order: number;
  hidden_at: string | null;
  created_at: string;
  updated_at: string;
};

const HIDDEN_RSVP_AUDIT_GUEST_NAME = "Sean and Lexi";
const ADMIN_LOGIN_MAX_FAILED_ATTEMPTS = 5;
const ADMIN_LOGIN_WINDOW_MINUTES = 15;
const ADMIN_LOGIN_LOCKOUT_MINUTES = 15;

type SqlClient = {
  query<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: unknown[],
  ): Promise<T[]>;
};

let sqlClient: SqlClient | null = null;
let pgPool: Pool | null = null;

function databaseUrl() {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING
  );
}

function shouldUseLocalPostgres(connectionString: string) {
  const { hostname } = new URL(connectionString);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function createSqlClient(connectionString: string): SqlClient {
  if (shouldUseLocalPostgres(connectionString)) {
    pgPool ??= new Pool({ connectionString });

    return {
      async query<T extends QueryResultRow = QueryResultRow>(queryText: string, values?: unknown[]) {
        const result = await pgPool!.query<T>(queryText, values);
        return result.rows;
      },
    };
  }

  const neonClient = neon(connectionString);

  return {
    query<T extends QueryResultRow = QueryResultRow>(queryText: string, values?: unknown[]) {
      return neonClient.query(queryText, values) as Promise<T[]>;
    },
  };
}

function sql() {
  const connectionString = databaseUrl();

  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  sqlClient ??= createSqlClient(connectionString);
  return sqlClient;
}

function toGuest(row: GuestRow): Guest {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    phoneNumber: row.phone_number,
    emailAddress: row.email_address,
    slug: row.slug,
    guestCount: row.guest_count,
    inviteSent: row.invite_sent,
    fuckYes: row.fuck_yes,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRsvp(row: RsvpRow): Rsvp {
  return {
    id: row.id,
    guestId: row.guest_id,
    status: row.status,
    attendingCount: row.attending_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAttendee(row: RsvpAttendeeRow): RsvpAttendee {
  return {
    id: row.id,
    rsvpId: row.rsvp_id,
    position: row.position,
    fullName: row.full_name ?? "",
    mealType: row.meal_type,
    dietaryNotes: row.dietary_notes ?? "",
  };
}

function parseAttendeeDetails(value: string | null): RsvpAttendeeDetails[] {
  if (!value) {
    return [];
  }

  return JSON.parse(value) as RsvpAttendeeDetails[];
}

function toWeddingPhotoRecord(row: WeddingPhotoRecordRow): WeddingPhotoRecord {
  return {
    filename: row.filename,
    sortOrder: row.sort_order,
    hiddenAt: row.hidden_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isMissingWeddingPhotosTableError(error: unknown) {
  return error instanceof Error && /relation "wedding_photos" does not exist/i.test(error.message);
}

export async function listWeddingPhotoRecords(
  filenames: string[],
): Promise<WeddingPhotoRecord[]> {
  if (filenames.length === 0) {
    return [];
  }

  try {
    const rows = (await sql().query(
      `SELECT filename, sort_order, hidden_at, created_at, updated_at
       FROM wedding_photos
       WHERE filename = ANY($1::text[])
       ORDER BY sort_order ASC, filename ASC`,
      [filenames],
    )) as WeddingPhotoRecordRow[];

    return rows.map(toWeddingPhotoRecord);
  } catch (error) {
    if (isMissingWeddingPhotosTableError(error)) {
      return [];
    }

    throw error;
  }
}

export async function ensureWeddingPhotoRecords(filenames: string[]) {
  if (filenames.length === 0) {
    return;
  }

  const positions = filenames.map((_, index) => index + 1);

  await sql().query(
    `WITH input_photos AS (
       SELECT
         filename,
         position::integer AS position
       FROM unnest($1::text[], $2::integer[]) AS photos(filename, position)
     ),
     current_max AS (
       SELECT COALESCE(max(sort_order), 0) AS sort_order
       FROM wedding_photos
     )
     INSERT INTO wedding_photos (filename, sort_order)
     SELECT
       input_photos.filename,
       current_max.sort_order + input_photos.position
     FROM input_photos
     CROSS JOIN current_max
     ON CONFLICT (filename) DO NOTHING`,
    [filenames, positions],
  );
}

export async function reorderWeddingPhotos(filenames: string[]) {
  const rows = (await sql().query(
    `WITH input_order AS (
       SELECT filename, ordinality::integer AS position
       FROM unnest($1::text[]) WITH ORDINALITY AS ordered_photos(filename, ordinality)
     ),
     validation AS (
       SELECT
         count(*)::integer AS input_count,
         count(DISTINCT input_order.filename)::integer AS distinct_input_count,
         count(photo.filename)::integer AS existing_input_count
       FROM input_order
       LEFT JOIN wedding_photos photo ON photo.filename = input_order.filename
     ),
     updated AS (
       UPDATE wedding_photos photo
       SET sort_order = input_order.position,
           updated_at = now()
       FROM input_order
       WHERE photo.filename = input_order.filename
         AND (
           SELECT input_count = distinct_input_count
             AND input_count = existing_input_count
           FROM validation
         )
       RETURNING photo.filename
     )
     SELECT
       input_count,
       distinct_input_count,
       existing_input_count,
       (SELECT count(*)::integer FROM updated) AS updated_count
     FROM validation`,
    [filenames],
  )) as Array<{
    input_count: number;
    distinct_input_count: number;
    existing_input_count: number;
    updated_count: number;
  }>;

  const result = rows[0];

  return Boolean(
    result &&
      result.input_count === result.distinct_input_count &&
      result.input_count === result.existing_input_count &&
      result.updated_count === result.input_count,
  );
}

export async function updateWeddingPhotoHidden(filename: string, hidden: boolean) {
  const rows = (await sql().query(
    `UPDATE wedding_photos
     SET hidden_at = CASE WHEN $2 THEN COALESCE(hidden_at, now()) ELSE NULL END,
         updated_at = now()
     WHERE filename = $1
     RETURNING filename`,
    [filename, hidden],
  )) as Array<{ filename: string }>;

  return rows.length > 0;
}

export async function guestSlugExists(slug: string) {
  const rows = (await sql().query(
    "SELECT EXISTS (SELECT 1 FROM wedding_guests WHERE slug = $1) AS exists",
    [slug],
  )) as Array<{ exists: boolean }>;

  return rows[0]?.exists ?? false;
}

export async function getGuestBySlug(slug: string) {
  const rows = (await sql().query(
    `SELECT id, name, notes, phone_number, email_address, slug, guest_count, invite_sent, fuck_yes, sort_order, created_at, updated_at
     FROM wedding_guests
     WHERE slug = $1`,
    [slug],
  )) as GuestRow[];

  return rows[0] ? toGuest(rows[0]) : null;
}

export async function createGuest(input: {
  name: string;
  notes: string;
  phoneNumber: string;
  emailAddress: string;
  slug: string;
  guestCount: number;
}) {
  const rows = (await sql().query(
    `INSERT INTO wedding_guests (name, notes, phone_number, email_address, slug, guest_count, sort_order)
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       COALESCE((SELECT max(sort_order) + 1 FROM wedding_guests), 1)
     )
     RETURNING id, name, notes, phone_number, email_address, slug, guest_count, invite_sent, fuck_yes, sort_order, created_at, updated_at`,
    [input.name, input.notes, input.phoneNumber, input.emailAddress, input.slug, input.guestCount],
  )) as GuestRow[];

  return toGuest(rows[0]);
}

export async function reorderGuestsInDefaultSort(ids: number[]) {
  const rows = (await sql().query(
    `WITH input_order AS (
       SELECT guest_id, ordinality::integer AS position
       FROM unnest($1::integer[]) WITH ORDINALITY AS ordered_guests(guest_id, ordinality)
     ),
     validation AS (
       SELECT
         count(*)::integer AS input_count,
         count(DISTINCT input_order.guest_id)::integer AS distinct_input_count,
         count(guest.id)::integer AS existing_input_count,
         (SELECT count(*)::integer FROM wedding_guests) AS guest_count
       FROM input_order
       LEFT JOIN wedding_guests guest ON guest.id = input_order.guest_id
     ),
     updated AS (
       UPDATE wedding_guests guest
       SET sort_order = input_order.position,
           updated_at = now()
       FROM input_order
       WHERE guest.id = input_order.guest_id
         AND (
           SELECT input_count = distinct_input_count
             AND input_count = existing_input_count
             AND input_count = guest_count
           FROM validation
         )
       RETURNING guest.id
     )
     SELECT
       input_count,
       distinct_input_count,
       existing_input_count,
       guest_count,
       (SELECT count(*)::integer FROM updated) AS updated_count
     FROM validation`,
    [ids],
  )) as Array<{
    input_count: number;
    distinct_input_count: number;
    existing_input_count: number;
    guest_count: number;
    updated_count: number;
  }>;

  const result = rows[0];

  return Boolean(
    result &&
      result.input_count === result.distinct_input_count &&
      result.input_count === result.existing_input_count &&
      result.input_count === result.guest_count &&
      result.updated_count === result.guest_count,
  );
}

export async function updateGuestInviteSent(id: number, inviteSent: boolean) {
  const rows = (await sql().query(
    `UPDATE wedding_guests
     SET invite_sent = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [id, inviteSent],
  )) as Array<{ id: number }>;

  return rows.length > 0;
}

export async function updateGuestFuckYes(id: number, fuckYes: boolean) {
  const rows = (await sql().query(
    `UPDATE wedding_guests
     SET fuck_yes = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [id, fuckYes],
  )) as Array<{ id: number }>;

  return rows.length > 0;
}

export async function updateGuestName(id: number, name: string) {
  const rows = (await sql().query(
    `UPDATE wedding_guests
     SET name = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [id, name],
  )) as Array<{ id: number }>;

  return rows.length > 0;
}

export async function updateGuestCount(id: number, guestCount: number) {
  const rows = (await sql().query(
    `UPDATE wedding_guests
     SET guest_count = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [id, guestCount],
  )) as Array<{ id: number }>;

  return rows.length > 0;
}

export async function updateGuestNotes(id: number, notes: string) {
  const rows = (await sql().query(
    `UPDATE wedding_guests
     SET notes = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [id, notes],
  )) as Array<{ id: number }>;

  return rows.length > 0;
}

export async function updateGuestPhoneNumber(id: number, phoneNumber: string) {
  const rows = (await sql().query(
    `UPDATE wedding_guests
     SET phone_number = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [id, phoneNumber],
  )) as Array<{ id: number }>;

  return rows.length > 0;
}

export async function updateGuestEmailAddress(id: number, emailAddress: string) {
  const rows = (await sql().query(
    `UPDATE wedding_guests
     SET email_address = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [id, emailAddress],
  )) as Array<{ id: number }>;

  return rows.length > 0;
}

export async function updateGuestSlug(id: number, slug: string) {
  const rows = (await sql().query(
    `WITH updated AS (
       UPDATE wedding_guests
       SET slug = $2,
           updated_at = now()
       WHERE id = $1
         AND invite_sent = false
       RETURNING id
     )
     SELECT
       EXISTS(SELECT 1 FROM updated) AS updated,
       EXISTS(SELECT 1 FROM wedding_guests WHERE id = $1) AS exists,
       EXISTS(SELECT 1 FROM wedding_guests WHERE id = $1 AND invite_sent = true) AS invite_sent`,
    [id, slug],
  )) as Array<{ updated: boolean; exists: boolean; invite_sent: boolean }>;

  const result = rows[0];

  if (result?.updated) {
    return "updated";
  }

  if (result?.exists && result.invite_sent) {
    return "invite_sent";
  }

  return "not_found";
}

export async function deleteGuestById(id: number) {
  const rows = (await sql().query(
    `WITH target_guest AS (
       SELECT id
       FROM wedding_guests
       WHERE id = $1
     ),
     soft_deleted_audit AS (
       UPDATE wedding_rsvp_audit_events
       SET soft_deleted_at = now()
       WHERE guest_id = $1
         AND soft_deleted_at IS NULL
       RETURNING id
     ),
     deleted_guest AS (
       DELETE FROM wedding_guests
       WHERE id = (SELECT id FROM target_guest)
       RETURNING id
     )
     SELECT id FROM deleted_guest`,
    [id],
  )) as Array<{ id: number }>;

  return rows.length > 0;
}

export async function listGuestsWithRsvps(): Promise<GuestWithRsvp[]> {
  const rows = (await sql().query(
    `SELECT
       g.id,
       g.name,
       g.notes,
       g.phone_number,
       g.email_address,
       g.slug,
       g.guest_count,
       g.invite_sent,
       g.fuck_yes,
       g.sort_order,
       g.created_at,
       g.updated_at,
       r.status AS rsvp_status,
       r.attending_count,
       (
         COALESCE(
           json_agg(
             json_build_object(
               'fullName', COALESCE(a.full_name, ''),
               'mealType', a.meal_type,
               'dietaryNotes', COALESCE(a.dietary_notes, '')
             )
             ORDER BY a.position
           ) FILTER (WHERE a.id IS NOT NULL),
           '[]'::json
         ) #>> '{}'
       ) AS attendee_details
     FROM wedding_guests g
     LEFT JOIN wedding_rsvps r ON r.guest_id = g.id
     LEFT JOIN wedding_rsvp_attendees a ON a.rsvp_id = r.id
     GROUP BY g.id, r.status, r.attending_count
     ORDER BY g.sort_order ASC, g.id ASC`,
  )) as GuestWithRsvpRow[];

  return rows.map((row) => ({
    ...toGuest(row),
    rsvpStatus: row.rsvp_status,
    attendingCount: row.attending_count,
    attendeeDetails: parseAttendeeDetails(row.attendee_details),
  }));
}

export async function getGuestPageData(slug: string): Promise<GuestPageData | null> {
  const guest = await getGuestBySlug(slug);
  if (!guest) {
    return null;
  }

  const rsvpRows = (await sql().query(
    `SELECT id, guest_id, status, attending_count, created_at, updated_at
     FROM wedding_rsvps
     WHERE guest_id = $1`,
    [guest.id],
  )) as RsvpRow[];
  const rsvp = rsvpRows[0] ? toRsvp(rsvpRows[0]) : null;

  if (!rsvp) {
    return { guest, rsvp: null, attendees: [] };
  }

  const attendeeRows = (await sql().query(
    `SELECT id, rsvp_id, position, full_name, meal_type, dietary_notes
     FROM wedding_rsvp_attendees
     WHERE rsvp_id = $1
     ORDER BY position ASC`,
    [rsvp.id],
  )) as RsvpAttendeeRow[];

  return {
    guest,
    rsvp,
    attendees: attendeeRows.map(toAttendee),
  };
}

export async function listRsvpAuditEvents(): Promise<RsvpAuditEvent[]> {
  const rows = (await sql().query(
    `SELECT
       audit.id,
       audit.event_type,
       audit.guest_id,
       audit.guest_name,
       audit.guest_slug,
       audit.guest_name_previous,
       audit.guest_name_current,
       audit.status,
       audit.attending_count,
       audit.created_at,
       (
         COALESCE(
           json_agg(
             json_build_object(
               'fullName', COALESCE(attendee.full_name, ''),
               'mealType', attendee.meal_type,
               'dietaryNotes', COALESCE(attendee.dietary_notes, '')
             )
             ORDER BY attendee.position
           ) FILTER (WHERE attendee.id IS NOT NULL),
           '[]'::json
         ) #>> '{}'
       ) AS attendee_details
     FROM wedding_rsvp_audit_events audit
     LEFT JOIN wedding_rsvp_audit_attendees attendee ON attendee.audit_event_id = audit.id
     LEFT JOIN wedding_guests current_guest ON current_guest.id = audit.guest_id
     WHERE audit.soft_deleted_at IS NULL
       AND audit.event_type = 'rsvp'
       AND lower(btrim(COALESCE(current_guest.name, audit.guest_name_current, audit.guest_name))) <> lower($1)
       AND lower(btrim(audit.guest_name_current)) <> lower($1)
       AND lower(btrim(audit.guest_name)) <> lower($1)
     GROUP BY audit.id
     ORDER BY audit.created_at DESC, audit.id DESC`,
    [HIDDEN_RSVP_AUDIT_GUEST_NAME],
  )) as RsvpAuditEventRow[];

  return rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    guestId: row.guest_id,
    guestName: row.guest_name,
    guestSlug: row.guest_slug,
    guestNamePrevious: row.guest_name_previous,
    guestNameCurrent: row.guest_name_current,
    status: row.status,
    attendingCount: row.attending_count,
    attendeeDetails: parseAttendeeDetails(row.attendee_details),
    createdAt: row.created_at,
  }));
}

export async function getAdminLoginRateLimit(
  rateLimitKey: string,
): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  const rows = (await sql().query(
    `SELECT ceil(extract(epoch FROM (locked_until - now())))::integer AS retry_after_seconds
     FROM wedding_admin_login_attempts
     WHERE rate_limit_key = $1
       AND locked_until > now()`,
    [rateLimitKey],
  )) as Array<{ retry_after_seconds: number }>;

  const retryAfterSeconds = rows[0]?.retry_after_seconds ?? 0;

  return {
    limited: retryAfterSeconds > 0,
    retryAfterSeconds: Math.max(0, retryAfterSeconds),
  };
}

export async function recordAdminLoginFailure(
  rateLimitKey: string,
): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  const rows = (await sql().query(
    `WITH upserted AS (
       INSERT INTO wedding_admin_login_attempts (
         rate_limit_key,
         failed_count,
         window_started_at,
         locked_until,
         last_failed_at
       )
       VALUES ($1, 1, now(), NULL, now())
       ON CONFLICT (rate_limit_key) DO UPDATE SET
         failed_count = CASE
           WHEN wedding_admin_login_attempts.locked_until > now() THEN wedding_admin_login_attempts.failed_count
           WHEN wedding_admin_login_attempts.window_started_at <= now() - ($2::integer * interval '1 minute') THEN 1
           ELSE wedding_admin_login_attempts.failed_count + 1
         END,
         window_started_at = CASE
           WHEN wedding_admin_login_attempts.locked_until > now() THEN wedding_admin_login_attempts.window_started_at
           WHEN wedding_admin_login_attempts.window_started_at <= now() - ($2::integer * interval '1 minute') THEN now()
           ELSE wedding_admin_login_attempts.window_started_at
         END,
         locked_until = CASE
           WHEN wedding_admin_login_attempts.locked_until > now() THEN wedding_admin_login_attempts.locked_until
           WHEN wedding_admin_login_attempts.window_started_at <= now() - ($2::integer * interval '1 minute') THEN NULL
           WHEN wedding_admin_login_attempts.failed_count + 1 >= $3 THEN now() + ($4::integer * interval '1 minute')
           ELSE NULL
         END,
         last_failed_at = now()
       RETURNING locked_until
     )
     SELECT COALESCE(ceil(extract(epoch FROM (locked_until - now())))::integer, 0) AS retry_after_seconds
     FROM upserted`,
    [
      rateLimitKey,
      ADMIN_LOGIN_WINDOW_MINUTES,
      ADMIN_LOGIN_MAX_FAILED_ATTEMPTS,
      ADMIN_LOGIN_LOCKOUT_MINUTES,
    ],
  )) as Array<{ retry_after_seconds: number }>;

  const retryAfterSeconds = rows[0]?.retry_after_seconds ?? 0;

  return {
    limited: retryAfterSeconds > 0,
    retryAfterSeconds: Math.max(0, retryAfterSeconds),
  };
}

export async function clearAdminLoginFailures(rateLimitKey: string) {
  await sql().query("DELETE FROM wedding_admin_login_attempts WHERE rate_limit_key = $1", [
    rateLimitKey,
  ]);
}

export async function saveRsvp(input: {
  guestId: number;
  status: RsvpStatus;
  attendingCount: number | null;
  attendeeDetails: RsvpAttendeeDetails[];
}) {
  const attendeeNames = input.attendeeDetails.map((attendee) => attendee.fullName);
  const attendeeMealTypes = input.attendeeDetails.map((attendee) => attendee.mealType);
  const attendeeDietaryNotes = input.attendeeDetails.map((attendee) => attendee.dietaryNotes);

  await sql().query(
    `WITH upserted AS (
       INSERT INTO wedding_rsvps (guest_id, status, attending_count)
       VALUES ($1, $2, $3)
       ON CONFLICT (guest_id) DO UPDATE SET
         status = EXCLUDED.status,
         attending_count = EXCLUDED.attending_count,
         updated_at = now()
       RETURNING id
     ),
     deleted AS (
       DELETE FROM wedding_rsvp_attendees
       WHERE rsvp_id = (SELECT id FROM upserted)
       RETURNING 1
     ),
     ready AS (
       SELECT upserted.id
       FROM upserted, (SELECT count(*) FROM deleted) AS deleted_count
     ),
     input_attendees AS (
       SELECT
         names.ordinality::integer AS position,
         NULLIF(btrim(names.attendee_name), '') AS full_name,
         NULLIF(meals.meal_type, '') AS meal_type,
         NULLIF(btrim(notes.dietary_notes), '') AS dietary_notes
       FROM unnest($4::text[]) WITH ORDINALITY AS names(attendee_name, ordinality)
       LEFT JOIN unnest($5::text[]) WITH ORDINALITY AS meals(meal_type, ordinality)
         ON meals.ordinality = names.ordinality
       LEFT JOIN unnest($6::text[]) WITH ORDINALITY AS notes(dietary_notes, ordinality)
         ON notes.ordinality = names.ordinality
       WHERE length(btrim(names.attendee_name)) > 0
          OR NULLIF(meals.meal_type, '') IS NOT NULL
          OR length(btrim(notes.dietary_notes)) > 0
     ),
     inserted_attendees AS (
       INSERT INTO wedding_rsvp_attendees (rsvp_id, position, full_name, meal_type, dietary_notes)
       SELECT
         ready.id,
         input_attendees.position,
         input_attendees.full_name,
         input_attendees.meal_type,
         input_attendees.dietary_notes
       FROM ready
       CROSS JOIN input_attendees
       RETURNING 1
     ),
     audit_event AS (
       INSERT INTO wedding_rsvp_audit_events (
         event_type,
         guest_id,
         guest_name,
         guest_slug,
         guest_name_current,
         status,
         attending_count
       )
       SELECT 'rsvp', guest.id, guest.name, guest.slug, guest.name, $2, $3
       FROM wedding_guests guest
       WHERE guest.id = $1
       RETURNING id
     ),
     inserted_audit_attendees AS (
       INSERT INTO wedding_rsvp_audit_attendees (
         audit_event_id,
         position,
         full_name,
         meal_type,
         dietary_notes
       )
       SELECT
         audit_event.id,
         input_attendees.position,
         input_attendees.full_name,
         input_attendees.meal_type,
         input_attendees.dietary_notes
       FROM audit_event
       CROSS JOIN input_attendees
       RETURNING 1
     )
     SELECT
       (SELECT count(*) FROM inserted_attendees) AS attendee_rows,
       (SELECT count(*) FROM inserted_audit_attendees) AS audit_attendee_rows`,
    [
      input.guestId,
      input.status,
      input.attendingCount,
      attendeeNames,
      attendeeMealTypes,
      attendeeDietaryNotes,
    ],
  );
}
