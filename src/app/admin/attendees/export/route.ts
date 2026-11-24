import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD } from "@/lib/cookies";
import { listConfirmedAttendees } from "@/lib/db";
import { makeAttendeeCsv, prepareAttendeeExportRows } from "@/lib/attendee-export";
import { makeAttendeePdf } from "@/lib/attendee-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if ((await cookies()).get(ADMIN_COOKIE_NAME)?.value !== ADMIN_PASSWORD) {
    return new Response("Admin login required.", { status: 401, headers });
  }
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "csv" && format !== "pdf") {
    return new Response("Choose csv or pdf.", { status: 400, headers });
  }
  try {
    const rows = prepareAttendeeExportRows(await listConfirmedAttendees());
    const now = new Date();
    const date = now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    const body = format === "csv" ? makeAttendeeCsv(rows) : new Uint8Array(await makeAttendeePdf(rows, now));
    return new Response(body, { headers: {
      ...headers,
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/pdf",
      "Content-Disposition": `attachment; filename="sexi-wedding-confirmed-attendees-${date}.${format}"`,
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Confirmed attendee export failed", error);
    return new Response("Export failed. Please try again.", { status: 500, headers });
  }
}
