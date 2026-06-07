import { cookies } from "next/headers";
import Link from "next/link";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD } from "@/lib/cookies";
import {
  listGuestsWithRsvps,
  listRsvpAuditEvents,
  type RsvpAttendeeDetails,
} from "@/lib/db";
import {
  AddGuestForm,
  AdminCsvExportButton,
  AdminLoginForm,
  GuestTable,
  LocalAuditTimestamp,
  type AdminSortDirection,
  type AdminSortKey,
} from "./admin-client";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getIsAdminLoggedIn() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE_NAME)?.value === ADMIN_PASSWORD;
}

function rsvpLabel(status: string | null) {
  if (status === "yes") {
    return "Yes";
  }
  if (status === "no") {
    return "No";
  }
  if (status === "deciding") {
    return "Still deciding";
  }
  return "No response";
}

function rsvpClassName(status: string | null) {
  if (status === "yes") {
    return "border-[#047857] bg-[#d1fae5] text-[#065f46]";
  }
  if (status === "no") {
    return "border-[#dc2626] bg-[#fee2e2] text-[#991b1b]";
  }
  if (status === "deciding") {
    return "border-[#d97706] bg-[#fef3c7] text-[#92400e]";
  }
  return "border-[#64748b] bg-[#e2e8f0] text-[#334155]";
}

function mealLabel(mealType: RsvpAttendeeDetails["mealType"]) {
  if (mealType === "beef") {
    return "Beef";
  }
  if (mealType === "fish") {
    return "Fish";
  }
  if (mealType === "vegetarian") {
    return "Vegetarian";
  }
  return "";
}

function attendeeDetailsSummary(attendees: RsvpAttendeeDetails[]) {
  return attendees
    .map((attendee, index) => {
      const name = attendee.fullName || `Guest ${index + 1}`;
      const meal = mealLabel(attendee.mealType);
      const notes = attendee.dietaryNotes.trim();
      const details = [meal, notes].filter(Boolean).join(", ");

      return details ? `${name} (${details})` : name;
    })
    .filter(Boolean)
    .join("; ");
}

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function getSortKey(value: string | undefined): AdminSortKey {
  if (
    value === "name" ||
    value === "max" ||
    value === "invite" ||
    value === "rsvp" ||
    value === "attending"
  ) {
    return value;
  }

  return "default";
}

function getSortDirection(value: string | undefined): AdminSortDirection {
  return value === "desc" ? "desc" : "asc";
}

function sortDirectionMultiplier(direction: AdminSortDirection) {
  return direction === "asc" ? 1 : -1;
}

function rsvpSortValue(status: string | null) {
  if (status === "yes") {
    return 1;
  }
  if (status === "deciding") {
    return 2;
  }
  if (status === "no") {
    return 3;
  }
  return 4;
}

function sortGuests<T extends { name: string; guestCount: number; inviteSent: boolean; rsvpStatus: string | null; attendingCount: number | null; sortOrder: number; id: number }>(
  guests: T[],
  sortKey: AdminSortKey,
  sortDirection: AdminSortDirection,
) {
  const sortedGuests = [...guests];

  if (sortKey === "default") {
    return sortedGuests.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  }

  const multiplier = sortDirectionMultiplier(sortDirection);

  return sortedGuests.sort((a, b) => {
    if (sortKey === "name") {
      return multiplier * (a.name.localeCompare(b.name) || a.sortOrder - b.sortOrder);
    }
    if (sortKey === "max") {
      return multiplier * (a.guestCount - b.guestCount || a.sortOrder - b.sortOrder);
    }
    if (sortKey === "invite") {
      return multiplier * (Number(a.inviteSent) - Number(b.inviteSent) || a.sortOrder - b.sortOrder);
    }
    if (sortKey === "rsvp") {
      return multiplier * (rsvpSortValue(a.rsvpStatus) - rsvpSortValue(b.rsvpStatus) || a.sortOrder - b.sortOrder);
    }

    return multiplier * ((a.attendingCount ?? 0) - (b.attendingCount ?? 0) || a.sortOrder - b.sortOrder);
  });
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const isAdmin = await getIsAdminLoggedIn();

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#fde8f1] px-6 py-12 text-[#4a1027]">
        <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl flex-col items-center justify-center text-center">
          <p
            className="text-4xl text-[#be185d] sm:text-5xl"
            style={{ fontFamily: "var(--font-brand-script)", fontWeight: 400 }}
          >
            Sean + Lexi
          </p>
          <h1 className="mt-5 text-4xl font-semibold text-[#8f2448] sm:text-5xl">
            Wedding admin
          </h1>
          <p className="mt-4 max-w-md text-base text-[#4a1027]/75">
            Enter the admin password to manage invitation links and RSVP responses.
          </p>
          <div className="mt-8 w-full rounded-lg border border-[#df7fa3] bg-[#fff8fb]/85 p-6 shadow-[0_30px_80px_-50px_rgba(143,36,72,0.9)]">
            <AdminLoginForm />
          </div>
        </section>
      </main>
    );
  }

  const [guests, auditEvents] = await Promise.all([
    listGuestsWithRsvps(),
    listRsvpAuditEvents(),
  ]);
  const resolvedSearchParams = (await searchParams) ?? {};
  const activeSortKey = getSortKey(getSearchParam(resolvedSearchParams, "sort"));
  const activeDirection = getSortDirection(getSearchParam(resolvedSearchParams, "dir"));
  const sortedGuests = sortGuests(guests, activeSortKey, activeDirection);
  const isDefaultSort = activeSortKey === "default";
  const yesCount = guests.reduce(
    (total, guest) => total + (guest.rsvpStatus === "yes" ? guest.attendingCount ?? 0 : 0),
    0,
  );
  const maybeCount = guests.reduce(
    (total, guest) => total + (guest.rsvpStatus === "deciding" ? guest.guestCount : 0),
    0,
  );
  const invitedCount = guests.reduce(
    (total, guest) =>
      total + (guest.rsvpStatus === null ? guest.guestCount : 0),
    0,
  );
  const yesMaybeCount = yesCount + maybeCount;
  const yesMaybeInvitedCount = yesMaybeCount + invitedCount;

  return (
    <main className="min-h-screen bg-[#f9d8e6] px-3 py-3 text-[#4a1027] sm:px-4">
      <section className="mx-auto max-w-[96rem] border border-[#df7fa3] bg-[#fff1f7] shadow-[0_18px_50px_-38px_rgba(143,36,72,0.8)]">
        <div className="flex flex-col gap-2 border-b border-[#df7fa3] bg-[#f4bfd2] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p
              className="text-xl leading-none text-[#be185d]"
              style={{ fontFamily: "var(--font-brand-script)", fontWeight: 400 }}
            >
              Sean + Lexi = Sexi
            </p>
            <h1 className="mt-1 text-xl font-semibold leading-none text-[#7a1239]">
              RSVP admin
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/admin/photos"
              className="inline-flex h-8 items-center justify-center border border-[#df7fa3] bg-[#fff8fb] px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#7a1239] transition hover:border-[#be185d] hover:bg-[#fff1f7]"
            >
              Edit photos
            </Link>
            <AdminCsvExportButton auditEvents={auditEvents} guests={sortedGuests} />
            <div className="grid grid-cols-1 overflow-hidden border border-[#df7fa3] bg-[#fff8fb] text-xs sm:grid-cols-3">
              <div className="border-r border-[#efb5c9] px-2 py-1">
                <span className="text-[#8f5070]">Yes</span>
                <span className="ml-2 font-semibold tabular-nums text-[#8f2448]">
                  {yesCount}
                </span>
              </div>
              <div className="border-r border-[#efb5c9] px-2 py-1">
                <span className="text-[#8f5070]">Yes+Maybe</span>
                <span className="ml-2 font-semibold tabular-nums text-[#a33a62]">
                  {yesMaybeCount}
                </span>
              </div>
              <div className="px-2 py-1">
                <span className="text-[#8f5070]">Yes+Maybe+No Response</span>
                <span className="ml-2 font-semibold tabular-nums text-[#7a1239]">
                  {yesMaybeInvitedCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        <AddGuestForm />

        <div className="overflow-auto bg-[#fff8fb]">
          <GuestTable
            activeDirection={activeDirection}
            activeSortKey={activeSortKey}
            guests={sortedGuests}
            isDefaultSort={isDefaultSort}
          />
        </div>

        <div className="border-t border-[#df7fa3] bg-[#fff1f7]">
          <div className="flex items-center justify-between border-b border-[#df7fa3] bg-[#f4bfd2] px-3 py-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#7a1239]">
              RSVP edit history
            </h2>
            <span className="text-xs tabular-nums text-[#8f5070]">
              {auditEvents.length} event{auditEvents.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="max-h-[28rem] overflow-auto bg-[#fff8fb]">
            <table className="w-full min-w-[68rem] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#eca8c0] text-[0.65rem] uppercase tracking-[0.08em] text-[#651735]">
                <tr>
                  <th className="w-52 border-r border-b border-[#df7fa3] px-2 py-1.5 font-semibold">Timestamp</th>
                  <th className="w-32 border-r border-b border-[#df7fa3] px-2 py-1.5 font-semibold">Change</th>
                  <th className="border-r border-b border-[#df7fa3] px-2 py-1.5 font-semibold">Guest</th>
                  <th className="w-36 border-r border-b border-[#df7fa3] px-2 py-1.5 font-semibold">RSVP</th>
                  <th className="w-16 border-r border-b border-[#df7fa3] px-2 py-1.5 text-right font-semibold">
                    Count
                  </th>
                  <th className="border-b border-[#df7fa3] px-2 py-1.5 font-semibold">Place cards / meals</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border-b border-[#efb5c9] px-2 py-6 text-center text-sm text-[#8f5070]">
                      No RSVP edits have been saved yet.
                    </td>
                  </tr>
                ) : (
                  auditEvents.map((event) => (
                    <tr key={event.id} className="odd:bg-[#fff8fb] even:bg-[#ffeaf2] hover:bg-[#ffd8e8]">
                      <td className="border-r border-b border-[#efb5c9] px-2 py-1 font-mono text-[0.7rem] tabular-nums text-[#7d3150]">
                        <LocalAuditTimestamp value={event.createdAt} />
                      </td>
                      <td className="border-r border-b border-[#efb5c9] px-2 py-1 font-semibold text-[#8f2448]">
                        RSVP changed
                      </td>
                      <td className="border-r border-b border-[#efb5c9] px-2 py-1">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[#4a1027]">{event.guestNameCurrent}</span>
                          <span className="font-mono text-[0.68rem] text-[#be185d]">/{event.guestSlug}</span>
                        </div>
                      </td>
                      <td className="border-r border-b border-[#efb5c9] px-2 py-1">
                        {event.status ? (
                          <span className={`inline-flex min-w-24 justify-center border px-1.5 py-0.5 font-semibold ${rsvpClassName(event.status)}`}>
                            {rsvpLabel(event.status)}
                          </span>
                        ) : null}
                      </td>
                      <td className="border-r border-b border-[#efb5c9] px-2 py-1 text-right font-mono tabular-nums">
                        {event.attendingCount ?? ""}
                      </td>
                      <td className="border-b border-[#efb5c9] px-2 py-1 text-[#4a1027]">
                        {attendeeDetailsSummary(event.attendeeDetails)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
