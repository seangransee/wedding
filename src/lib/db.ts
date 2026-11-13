import { neon } from "@neondatabase/serverless";
import { Pool, type QueryResultRow } from "pg";
import type { MailingAddress } from "./mailing-address";
import {
  DEFAULT_ROOM,
  DEFAULT_TABLE_CAPACITY,
  type SeatingArea,
  type SeatingAttendee,
  type SeatingBucket,
  type SeatingChartData,
  type SeatingParty,
  type SeatingPersonAssignment,
  type SeatingSeat,
  type SeatingTable,
  type SeatingTableKind,
} from "./seating";

export type { MailingAddress } from "./mailing-address";

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
  friDin: boolean;
  reh: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Rsvp = {
  id: number;
  guestId: number;
  status: RsvpStatus;
  attendingCount: number | null;
  mailingAddress: MailingAddress;
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
  mailingAddress: MailingAddress;
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
  mailingAddress: MailingAddress;
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
  fri_din: boolean;
  reh: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type MailingAddressRow = {
  mailing_address_line1: string | null;
  mailing_address_line2: string | null;
  mailing_address_city: string | null;
  mailing_address_region: string | null;
  mailing_address_postal_code: string | null;
  mailing_address_country: string | null;
};

type RsvpRow = MailingAddressRow & {
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

type GuestWithRsvpRow = GuestRow & MailingAddressRow & {
  rsvp_status: RsvpStatus | null;
  attending_count: number | null;
  attendee_details: string | null;
};

type RsvpAuditEventRow = MailingAddressRow & {
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
    friDin: row.fri_din,
    reh: row.reh,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMailingAddress(row: MailingAddressRow): MailingAddress {
  return {
    line1: row.mailing_address_line1 ?? "",
    line2: row.mailing_address_line2 ?? "",
    city: row.mailing_address_city ?? "",
    region: row.mailing_address_region ?? "",
    postalCode: row.mailing_address_postal_code ?? "",
    country: row.mailing_address_country ?? "",
  };
}

function toRsvp(row: RsvpRow): Rsvp {
  return {
    id: row.id,
    guestId: row.guest_id,
    status: row.status,
    attendingCount: row.attending_count,
    mailingAddress: toMailingAddress(row),
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
    `SELECT id, name, notes, phone_number, email_address, slug, guest_count, invite_sent, fuck_yes, fri_din, reh, sort_order, created_at, updated_at
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
     RETURNING id, name, notes, phone_number, email_address, slug, guest_count, invite_sent, fuck_yes, fri_din, reh, sort_order, created_at, updated_at`,
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

export async function updateGuestFriDin(id: number, friDin: boolean) {
  const rows = (await sql().query(
    `UPDATE wedding_guests
     SET fri_din = $2,
         -- Rehearsal guests are always Friday dinner guests.
         reh = reh AND $2,
         updated_at = now()
     WHERE id = $1
     RETURNING slug`,
    [id, friDin],
  )) as Array<{ slug: string }>;

  return rows[0] ?? null;
}

export async function updateGuestReh(id: number, reh: boolean) {
  const rows = (await sql().query(
    `UPDATE wedding_guests
     SET reh = $2,
         -- Rehearsal guests are always Friday dinner guests.
         fri_din = fri_din OR $2,
         updated_at = now()
     WHERE id = $1
     RETURNING slug`,
    [id, reh],
  )) as Array<{ slug: string }>;

  return rows[0] ?? null;
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
       g.fri_din,
       g.reh,
       g.sort_order,
       g.created_at,
       g.updated_at,
       r.status AS rsvp_status,
       r.attending_count,
       r.mailing_address_line1,
       r.mailing_address_line2,
       r.mailing_address_city,
       r.mailing_address_region,
       r.mailing_address_postal_code,
       r.mailing_address_country,
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
     GROUP BY g.id, r.id
     ORDER BY g.sort_order ASC, g.id ASC`,
  )) as GuestWithRsvpRow[];

  return rows.map((row) => ({
    ...toGuest(row),
    rsvpStatus: row.rsvp_status,
    attendingCount: row.attending_count,
    attendeeDetails: parseAttendeeDetails(row.attendee_details),
    mailingAddress: toMailingAddress(row),
  }));
}

export async function getGuestPageData(slug: string): Promise<GuestPageData | null> {
  const guest = await getGuestBySlug(slug);
  if (!guest) {
    return null;
  }

  const rsvpRows = (await sql().query(
    `SELECT
       id,
       guest_id,
       status,
       attending_count,
       mailing_address_line1,
       mailing_address_line2,
       mailing_address_city,
       mailing_address_region,
       mailing_address_postal_code,
       mailing_address_country,
       created_at,
       updated_at
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
       audit.mailing_address_line1,
       audit.mailing_address_line2,
       audit.mailing_address_city,
       audit.mailing_address_region,
       audit.mailing_address_postal_code,
       audit.mailing_address_country,
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
    mailingAddress: toMailingAddress(row),
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
  mailingAddress: MailingAddress;
}) {
  const attendeeNames = input.attendeeDetails.map((attendee) => attendee.fullName);
  const attendeeMealTypes = input.attendeeDetails.map((attendee) => attendee.mealType);
  const attendeeDietaryNotes = input.attendeeDetails.map((attendee) => attendee.dietaryNotes);

  await sql().query(
    `WITH upserted AS (
       INSERT INTO wedding_rsvps (
         guest_id,
         status,
         attending_count,
         mailing_address_line1,
         mailing_address_line2,
         mailing_address_city,
         mailing_address_region,
         mailing_address_postal_code,
         mailing_address_country
       )
       VALUES ($1, $2, $3, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (guest_id) DO UPDATE SET
         status = EXCLUDED.status,
         attending_count = EXCLUDED.attending_count,
         mailing_address_line1 = EXCLUDED.mailing_address_line1,
         mailing_address_line2 = EXCLUDED.mailing_address_line2,
         mailing_address_city = EXCLUDED.mailing_address_city,
         mailing_address_region = EXCLUDED.mailing_address_region,
         mailing_address_postal_code = EXCLUDED.mailing_address_postal_code,
         mailing_address_country = EXCLUDED.mailing_address_country,
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
         attending_count,
         mailing_address_line1,
         mailing_address_line2,
         mailing_address_city,
         mailing_address_region,
         mailing_address_postal_code,
         mailing_address_country
       )
       SELECT 'rsvp', guest.id, guest.name, guest.slug, guest.name, $2, $3, $7, $8, $9, $10, $11, $12
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
      input.mailingAddress.line1,
      input.mailingAddress.line2,
      input.mailingAddress.city,
      input.mailingAddress.region,
      input.mailingAddress.postalCode,
      input.mailingAddress.country,
    ],
  );
}

type SeatingLayoutRow = {
  room_width: number;
  room_height: number;
  table_capacity: number;
};

type SeatingTableRow = {
  id: string;
  kind: SeatingTableKind | "bucket";
  number: string;
  name: string;
  capacity: number;
  x: number;
  y: number;
  bubble: boolean;
  created_at_ms: number;
};

type SeatingPartyRow = {
  id: number;
  name: string;
  guest_count: number;
  sort_order: number;
  rsvp_status: RsvpStatus | null;
  attending_count: number | null;
  attendees: string | null;
  table_id: string | null;
  assigned_at_ms: number | null;
  split: boolean;
  people: string | null;
};

type SeatingAreaRow = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  created_at_ms: number;
};

type SeatingSeatRow = {
  table_id: string;
  seat_number: number;
  guest_id: number;
  person_position: number;
};

function toSeatingBucket(row: SeatingTableRow): SeatingBucket {
  return {
    id: row.id,
    name: row.name,
    x: row.x,
    y: row.y,
    bubble: row.bubble,
    createdAt: Number(row.created_at_ms),
  };
}

function toSeatingTable(row: SeatingTableRow & { kind: SeatingTableKind }): SeatingTable {
  return {
    id: row.id,
    kind: row.kind,
    number: row.number,
    name: row.name,
    capacity: row.capacity,
    x: row.x,
    y: row.y,
    createdAt: Number(row.created_at_ms),
  };
}

function toSeatingAttendees(value: string | null): SeatingAttendee[] {
  const rows = value
    ? (JSON.parse(value) as Array<{ position: number } & SeatingAttendee>)
    : [];
  const attendees: SeatingAttendee[] = [];

  for (const row of rows) {
    while (attendees.length < row.position - 1) {
      attendees.push({ name: "", mealType: null, dietaryNotes: "" });
    }
    attendees[row.position - 1] = {
      name: row.name,
      mealType: row.mealType,
      dietaryNotes: row.dietaryNotes,
    };
  }

  return attendees;
}

function toSeatingParty(row: SeatingPartyRow): SeatingParty {
  return {
    id: row.id,
    name: row.name,
    status: row.rsvp_status ?? "none",
    guestCount: row.guest_count,
    attendingCount: row.attending_count,
    attendees: toSeatingAttendees(row.attendees),
    sortOrder: row.sort_order,
    tableId: row.table_id,
    assignedAt: row.assigned_at_ms === null ? null : Number(row.assigned_at_ms),
    split: row.split,
    people: row.people
      ? (JSON.parse(row.people) as SeatingPersonAssignment[]).map((person) => ({
          position: person.position,
          tableId: person.tableId,
          assignedAt: Number(person.assignedAt),
        }))
      : [],
  };
}

export function isMissingSeatingTablesError(error: unknown) {
  return error instanceof Error && /relation "wedding_seating_[a-z_]+" does not exist/i.test(error.message);
}

/**
 * SQL condition: the person (guest + position) sits at the table, either with
 * their whole party or on their own after the party was split.
 */
function SEAT_PERSON_AT_TABLE_SQL(guestId: string, position: string, tableId: string) {
  return `(
    EXISTS (
      SELECT 1 FROM wedding_seating_assignments assignment
      WHERE assignment.guest_id = ${guestId} AND assignment.table_id = ${tableId}
    )
    OR EXISTS (
      SELECT 1 FROM wedding_seating_person_assignments person
      WHERE person.guest_id = ${guestId}
        AND person.person_position = ${position}
        AND person.table_id = ${tableId}
    )
  )`;
}

export async function getSeatingChart(): Promise<SeatingChartData> {
  const [layoutRows, tableRows, partyRows, seatRows, areaRows] = await Promise.all([
    sql().query<SeatingLayoutRow>(
      `SELECT room_width, room_height, table_capacity
       FROM wedding_seating_layout
       WHERE id = 1`,
    ),
    sql().query<SeatingTableRow>(
      `SELECT
         id::text AS id,
         kind,
         number,
         name,
         capacity,
         x,
         y,
         bubble,
         (extract(epoch FROM created_at) * 1000)::float8 AS created_at_ms
       FROM wedding_seating_tables
       ORDER BY created_at ASC, id ASC`,
    ),
    sql().query<SeatingPartyRow>(
      `SELECT
         g.id,
         g.name,
         g.guest_count,
         g.sort_order,
         r.status AS rsvp_status,
         r.attending_count,
         (
           COALESCE(
             json_agg(
               json_build_object(
                 'position', a.position,
                 'name', btrim(COALESCE(a.full_name, '')),
                 'mealType', a.meal_type,
                 'dietaryNotes', btrim(COALESCE(a.dietary_notes, ''))
               )
               ORDER BY a.position
             ) FILTER (WHERE a.id IS NOT NULL),
             '[]'::json
           ) #>> '{}'
         ) AS attendees,
         s.table_id::text AS table_id,
         (extract(epoch FROM s.assigned_at) * 1000)::float8 AS assigned_at_ms,
         EXISTS (SELECT 1 FROM wedding_seating_splits split WHERE split.guest_id = g.id) AS split,
         (
           SELECT COALESCE(
             json_agg(
               json_build_object(
                 'position', person.person_position,
                 'tableId', person.table_id::text,
                 'assignedAt', (extract(epoch FROM person.assigned_at) * 1000)::float8
               )
               ORDER BY person.person_position
             ),
             '[]'::json
           ) #>> '{}'
           FROM wedding_seating_person_assignments person
           WHERE person.guest_id = g.id
         ) AS people
       FROM wedding_guests g
       LEFT JOIN wedding_rsvps r ON r.guest_id = g.id
       LEFT JOIN wedding_rsvp_attendees a ON a.rsvp_id = r.id
       LEFT JOIN wedding_seating_assignments s ON s.guest_id = g.id
       GROUP BY g.id, r.id, s.guest_id
       ORDER BY g.sort_order ASC, g.id ASC`,
    ),
    sql().query<SeatingSeatRow>(
      `SELECT seat.table_id::text AS table_id, seat.seat_number, seat.guest_id, seat.person_position
       FROM wedding_seating_seats seat
       WHERE ${SEAT_PERSON_AT_TABLE_SQL("seat.guest_id", "seat.person_position", "seat.table_id")}
       ORDER BY seat.table_id, seat.seat_number`,
    ),
    getSeatingAreaRows(),
  ]);

  const layout = layoutRows[0];

  return {
    room: layout
      ? { width: layout.room_width, height: layout.room_height }
      : { ...DEFAULT_ROOM },
    tableCapacity: layout?.table_capacity ?? DEFAULT_TABLE_CAPACITY,
    tables: tableRows
      .filter((row): row is SeatingTableRow & { kind: SeatingTableKind } => row.kind !== "bucket")
      .map(toSeatingTable),
    buckets: tableRows.filter((row) => row.kind === "bucket").map(toSeatingBucket),
    areas: areaRows.map(
      (row): SeatingArea => ({
        id: row.id,
        name: row.name,
        x: row.x,
        y: row.y,
        width: row.width,
        height: row.height,
        createdAt: Number(row.created_at_ms),
      }),
    ),
    parties: partyRows.map(toSeatingParty),
    seats: seatRows.map((row): SeatingSeat => ({
      tableId: row.table_id,
      seatNumber: row.seat_number,
      partyId: row.guest_id,
      position: row.person_position,
    })),
  };
}

/**
 * Seats a whole party at a table, or unseats it when tableId is null. A split
 * party is joined back together first. Exact seats at any other table are
 * cleared (they belonged to the old table).
 */
export async function setSeatingAssignment(guestId: number, tableId: string | null) {
  if (tableId === null) {
    // Data-modifying CTEs always run to completion, even when unreferenced.
    await sql().query(
      `WITH unsplit AS (
         DELETE FROM wedding_seating_splits WHERE guest_id = $1 RETURNING 1
       ),
       cleared_seats AS (
         DELETE FROM wedding_seating_seats WHERE guest_id = $1 RETURNING 1
       )
       DELETE FROM wedding_seating_assignments
       WHERE guest_id = $1`,
      [guestId],
    );
    return true;
  }

  const rows = await sql().query<{ guest_id: number }>(
    `WITH target AS (
       SELECT guest.id AS guest_id, seating_table.id AS table_id
       FROM wedding_guests guest
       JOIN wedding_seating_tables seating_table ON seating_table.id = $2::uuid
       WHERE guest.id = $1
     ),
     cleared_seats AS (
       DELETE FROM wedding_seating_seats seat
       USING target
       WHERE seat.guest_id = target.guest_id
         AND seat.table_id <> target.table_id
       RETURNING 1
     ),
     unsplit AS (
       DELETE FROM wedding_seating_splits split
       USING target
       WHERE split.guest_id = target.guest_id
       RETURNING 1
     )
     INSERT INTO wedding_seating_assignments (guest_id, table_id)
     SELECT target.guest_id, target.table_id
     FROM target,
       (SELECT count(*) FROM cleared_seats) AS cleared_count,
       (SELECT count(*) FROM unsplit) AS unsplit_count
     ON CONFLICT (guest_id) DO UPDATE SET
       table_id = EXCLUDED.table_id,
       assigned_at = CASE
         WHEN wedding_seating_assignments.table_id = EXCLUDED.table_id
           THEN wedding_seating_assignments.assigned_at
         ELSE now()
       END
     RETURNING guest_id`,
    [guestId, tableId],
  );

  return rows.length > 0;
}

/**
 * Splits a party so its people can sit at different tables. People 1..peopleCount
 * start at the party's current table (keeping their exact seats); an unseated
 * party's people all start unseated. Returns false when the guest no longer
 * exists. Splitting an already-split party is a no-op.
 */
export async function splitSeatingParty(guestId: number, peopleCount: number) {
  const rows = await sql().query<{ guest_exists: boolean }>(
    `WITH guest AS (
       SELECT id FROM wedding_guests WHERE id = $1
     ),
     split AS (
       INSERT INTO wedding_seating_splits (guest_id)
       SELECT id FROM guest
       ON CONFLICT (guest_id) DO NOTHING
       RETURNING guest_id
     ),
     current_table AS (
       SELECT table_id, assigned_at FROM wedding_seating_assignments WHERE guest_id = $1
     ),
     people AS (
       INSERT INTO wedding_seating_person_assignments (guest_id, person_position, table_id, assigned_at)
       SELECT split.guest_id, position, current_table.table_id, current_table.assigned_at
       FROM split, current_table, generate_series(1, $2::integer) AS position
       ON CONFLICT (guest_id, person_position) DO NOTHING
       RETURNING 1
     ),
     whole_party AS (
       DELETE FROM wedding_seating_assignments
       WHERE guest_id IN (SELECT guest_id FROM split)
       RETURNING 1
     )
     SELECT EXISTS (SELECT 1 FROM guest) AS guest_exists`,
    [guestId, peopleCount],
  );

  return rows[0]?.guest_exists ?? false;
}

/**
 * Seats one person from a split party at a table, or unseats them when tableId
 * is null. Moving clears their exact seat at the old table. Returns false when
 * the party isn't split anymore (or the table is gone).
 */
export async function setSeatingPersonAssignment(guestId: number, position: number, tableId: string | null) {
  if (tableId === null) {
    const rows = await sql().query<{ is_split: boolean }>(
      `WITH removed AS (
         DELETE FROM wedding_seating_person_assignments
         WHERE guest_id = $1 AND person_position = $2
         RETURNING 1
       ),
       cleared_seats AS (
         DELETE FROM wedding_seating_seats
         WHERE guest_id = $1 AND person_position = $2
         RETURNING 1
       )
       SELECT EXISTS (SELECT 1 FROM wedding_seating_splits WHERE guest_id = $1) AS is_split`,
      [guestId, position],
    );

    return rows[0]?.is_split ?? false;
  }

  const rows = await sql().query<{ guest_id: number }>(
    `WITH target AS (
       SELECT split.guest_id, seating_table.id AS table_id
       FROM wedding_seating_splits split
       JOIN wedding_seating_tables seating_table ON seating_table.id = $3::uuid
       WHERE split.guest_id = $1
     ),
     cleared_seats AS (
       DELETE FROM wedding_seating_seats seat
       USING target
       WHERE seat.guest_id = target.guest_id
         AND seat.person_position = $2
         AND seat.table_id <> target.table_id
       RETURNING 1
     )
     INSERT INTO wedding_seating_person_assignments (guest_id, person_position, table_id)
     SELECT target.guest_id, $2, target.table_id
     FROM target, (SELECT count(*) FROM cleared_seats) AS cleared_count
     ON CONFLICT (guest_id, person_position) DO UPDATE SET
       table_id = EXCLUDED.table_id,
       assigned_at = CASE
         WHEN wedding_seating_person_assignments.table_id = EXCLUDED.table_id
           THEN wedding_seating_person_assignments.assigned_at
         ELSE now()
       END
     RETURNING guest_id`,
    [guestId, position, tableId],
  );

  return rows.length > 0;
}

/** Idempotent: retrying with the same client-generated id is a no-op. */
export async function createSeatingTable(input: {
  id: string;
  number: string;
  name: string;
  x: number;
  y: number;
}) {
  await sql().query(
    `INSERT INTO wedding_seating_tables (id, kind, number, name, capacity, x, y)
     VALUES (
       $1::uuid,
       'round',
       $2,
       $3,
       COALESCE((SELECT table_capacity FROM wedding_seating_layout WHERE id = 1), $4),
       $5,
       $6
     )
     ON CONFLICT (id) DO NOTHING`,
    [input.id, input.number, input.name, DEFAULT_TABLE_CAPACITY, input.x, input.y],
  );
}

/** Idempotent: retrying with the same client-generated id is a no-op. */
export async function createSeatingBucket(input: { id: string; name: string; x: number; y: number; bubble: boolean }) {
  // Capacity is unused for buckets; 30 just satisfies the column's check.
  await sql().query(
    `INSERT INTO wedding_seating_tables (id, kind, number, name, capacity, x, y, bubble)
     VALUES ($1::uuid, 'bucket', '', $2, 30, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [input.id, input.name, input.x, input.y, input.bubble],
  );
}

/** Bubbles only exist to hold someone, so delete any that nobody is in anymore. */
export async function deleteEmptySeatingBubbles() {
  await sql().query(
    `DELETE FROM wedding_seating_tables seating_table
     WHERE seating_table.kind = 'bucket'
       AND seating_table.bubble
       AND NOT EXISTS (
         SELECT 1 FROM wedding_seating_assignments assignment WHERE assignment.table_id = seating_table.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM wedding_seating_person_assignments person WHERE person.table_id = seating_table.id
       )`,
  );
}

/** Moves a table (center) or bucket (top-left corner). */
export async function updateSeatingTablePosition(id: string, x: number, y: number) {
  const rows = await sql().query<{ id: string }>(
    `UPDATE wedding_seating_tables
     SET x = $2,
         y = $3,
         updated_at = now()
     WHERE id = $1::uuid
     RETURNING id`,
    [id, x, y],
  );

  return rows.length > 0;
}

export async function updateSeatingTableLabel(id: string, number: string, name: string) {
  const rows = await sql().query<{ id: string }>(
    `UPDATE wedding_seating_tables
     SET number = $2,
         name = $3,
         updated_at = now()
     WHERE id = $1::uuid
     RETURNING id`,
    [id, number, name],
  );

  return rows.length > 0;
}

/**
 * Replaces every exact seat at a table. Seats are only kept for people who
 * are currently at the table and seat numbers within its capacity; returns
 * how many of the requested seats were saved.
 */
export async function replaceSeatingTableSeats(
  tableId: string,
  seats: Array<{ seatNumber: number; partyId: number; position: number }>,
) {
  const rows = await sql().query<{ table_exists: boolean; saved_count: number }>(
    `WITH input_seats AS (
       SELECT DISTINCT ON (seat_number) seat_number, guest_id, person_position
       FROM unnest($2::integer[], $3::integer[], $4::integer[])
         AS input(seat_number, guest_id, person_position)
     ),
     valid_seats AS (
       SELECT DISTINCT ON (input_seats.guest_id, input_seats.person_position)
         input_seats.seat_number,
         input_seats.guest_id,
         input_seats.person_position
       FROM input_seats
       JOIN wedding_seating_tables seating_table
         ON seating_table.id = $1::uuid
        AND seating_table.kind <> 'bucket'
        AND input_seats.seat_number BETWEEN 1 AND seating_table.capacity
       WHERE input_seats.person_position BETWEEN 1 AND 10
         AND ${SEAT_PERSON_AT_TABLE_SQL("input_seats.guest_id", "input_seats.person_position", "$1::uuid")}
     ),
     deleted AS (
       DELETE FROM wedding_seating_seats seat
       WHERE seat.table_id = $1::uuid
          OR (seat.guest_id, seat.person_position) IN (
            SELECT guest_id, person_position FROM valid_seats
          )
       RETURNING 1
     ),
     inserted AS (
       INSERT INTO wedding_seating_seats (table_id, seat_number, guest_id, person_position)
       SELECT $1::uuid, valid_seats.seat_number, valid_seats.guest_id, valid_seats.person_position
       FROM valid_seats, (SELECT count(*) FROM deleted) AS deleted_count
       RETURNING 1
     )
     SELECT
       EXISTS (SELECT 1 FROM wedding_seating_tables WHERE id = $1::uuid) AS table_exists,
       (SELECT count(*)::integer FROM inserted) AS saved_count`,
    [
      tableId,
      seats.map((seat) => seat.seatNumber),
      seats.map((seat) => seat.partyId),
      seats.map((seat) => seat.position),
    ],
  );

  return {
    tableExists: rows[0]?.table_exists ?? false,
    savedCount: rows[0]?.saved_count ?? 0,
  };
}

/** Deletes a round table or bucket (its people become unseated); the sweetheart table stays. */
export async function deleteSeatingTableById(id: string) {
  const rows = await sql().query<{ kind: SeatingTableKind | null; deleted: boolean }>(
    `WITH target AS (
       SELECT kind
       FROM wedding_seating_tables
       WHERE id = $1::uuid
     ),
     deleted AS (
       DELETE FROM wedding_seating_tables
       WHERE id = $1::uuid
         AND kind IN ('round', 'bucket')
       RETURNING id
     )
     SELECT
       (SELECT kind FROM target) AS kind,
       EXISTS (SELECT 1 FROM deleted) AS deleted`,
    [id],
  );

  const result = rows[0];

  if (result?.deleted) {
    return "deleted";
  }

  return result?.kind === "sweetheart" ? "protected" : "not_found";
}

export async function updateSeatingRoomSize(width: number, height: number) {
  await sql().query(
    `INSERT INTO wedding_seating_layout (id, room_width, room_height)
     VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET
       room_width = EXCLUDED.room_width,
       room_height = EXCLUDED.room_height,
       updated_at = now()`,
    [width, height],
  );
}

/**
 * Sets the seats per round table and applies it to every round table. Exact
 * seats past the new capacity are kept but ignored (reads filter them), so
 * raising the number again brings them back.
 */
export async function updateSeatingTableCapacity(capacity: number) {
  await sql().query(
    `WITH layout AS (
       INSERT INTO wedding_seating_layout (id, table_capacity)
       VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET
         table_capacity = EXCLUDED.table_capacity,
         updated_at = now()
       RETURNING id
     )
     UPDATE wedding_seating_tables
     SET capacity = $1,
         updated_at = now()
     WHERE kind = 'round'
       AND capacity <> $1`,
    [capacity],
  );
}

/**
 * Floor areas (stage, dance floor). Reads as none until migration 019 has run,
 * so the rest of the seating chart keeps working while a deploy migrates.
 */
async function getSeatingAreaRows() {
  try {
    return await sql().query<SeatingAreaRow>(
      `SELECT
         id::text AS id,
         name,
         x,
         y,
         width,
         height,
         (extract(epoch FROM created_at) * 1000)::float8 AS created_at_ms
       FROM wedding_seating_areas
       ORDER BY created_at ASC, id ASC`,
    );
  } catch (error) {
    if (error instanceof Error && /relation "wedding_seating_areas" does not exist/i.test(error.message)) {
      return [];
    }
    throw error;
  }
}

/** Idempotent: retrying with the same client-generated id is a no-op. */
export async function createSeatingArea(input: {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  await sql().query(
    `INSERT INTO wedding_seating_areas (id, name, x, y, width, height)
     VALUES ($1::uuid, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [input.id, input.name, input.x, input.y, input.width, input.height],
  );
}

/** Moves and/or resizes an area (x/y is its top-left corner). */
export async function updateSeatingAreaRect(id: string, x: number, y: number, width: number, height: number) {
  const rows = await sql().query<{ id: string }>(
    `UPDATE wedding_seating_areas
     SET x = $2,
         y = $3,
         width = $4,
         height = $5,
         updated_at = now()
     WHERE id = $1::uuid
     RETURNING id`,
    [id, x, y, width, height],
  );

  return rows.length > 0;
}

export async function updateSeatingAreaName(id: string, name: string) {
  const rows = await sql().query<{ id: string }>(
    `UPDATE wedding_seating_areas
     SET name = $2,
         updated_at = now()
     WHERE id = $1::uuid
     RETURNING id`,
    [id, name],
  );

  return rows.length > 0;
}

export async function deleteSeatingAreaById(id: string) {
  await sql().query(`DELETE FROM wedding_seating_areas WHERE id = $1::uuid`, [id]);
}
