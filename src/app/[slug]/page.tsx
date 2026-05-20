import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuestPageData } from "@/lib/db";
import { RsvpForm } from "./rsvp-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getGuestPageData(slug);

  if (!data) {
    return {
      title: "Invitation not found",
    };
  }

  return {
    title: `${data.guest.name} | Sexi Wedding`,
    description: "RSVP for Sean and Lexi's wedding.",
  };
}

export default async function GuestPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getGuestPageData(slug);

  if (!data) {
    notFound();
  }

  const attendeeNames = data.attendees.map((attendee) => attendee.fullName);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#054f2d] px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[#4a1f2e] sm:px-6 sm:py-8 lg:px-8">
      <div className="art-deco-bg pointer-events-none absolute inset-0 -z-20" aria-hidden="true" />
      <div className="art-deco-beams pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <section className="mx-auto grid max-w-6xl items-start gap-4 sm:gap-6 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="px-1 text-center text-[#fff6fa] lg:px-0 lg:text-left">
          <p
            className="text-3xl leading-none text-[#f1b3c6] sm:text-5xl"
            style={{ fontFamily: "var(--font-dancing-script)", fontWeight: 600 }}
          >
            Sean + Lexi = Sexi
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-none text-[#b8860b] sm:mt-6 sm:text-6xl lg:text-7xl">
            December 12, 2026
          </h1>
          <div className="mt-4 grid gap-2 text-lg font-semibold sm:mt-7 sm:gap-3 sm:text-2xl">
            <a
              href="https://maps.app.goo.gl/UKgUKENz1W4efCC7A"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center underline decoration-dashed decoration-1 underline-offset-6 transition hover:text-[#f1b3c6] lg:justify-start"
            >
              The Blackstone Hotel
            </a>
            <p className="text-xs uppercase tracking-[0.25em] text-[#f1b3c6] sm:text-sm sm:tracking-[0.35em]">Chicago, IL</p>
          </div>
          <a
            href="https://www.google.com/calendar/render?action=TEMPLATE&text=Sean%20%26%20Lexi%27s%20Wedding&dates=20261212/20261213&location=The%20Blackstone%2C%20Autograph%20Collection%2C%20636%20South%20Michigan%20Avenue%2C%20Chicago%2C%20IL%2060605%2C%20USA&details=Sean%20%2B%20Lexi%20%3D%20Sexi"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center justify-center text-xs font-semibold uppercase tracking-[0.18em] text-[#f1b3c6] underline decoration-dashed decoration-1 underline-offset-4 transition hover:text-[#fff6fa] sm:mt-8 sm:text-sm sm:tracking-[0.22em]"
          >
            Add to calendar
          </a>
        </div>

        <div className="w-full min-w-0 rounded-lg border border-[#b8860b]/45 bg-[#fff6fa]/94 p-4 shadow-[0_30px_70px_-38px_rgba(0,0,0,0.45)] backdrop-blur sm:p-7 lg:p-8 lg:shadow-[0_40px_90px_-40px_rgba(0,0,0,0.45)]">
          <RsvpForm
            slug={slug}
            guestName={data.guest.name}
            guestCount={data.guest.guestCount}
            initialStatus={data.rsvp?.status ?? ""}
            initialAttendingCount={data.rsvp?.attendingCount ?? null}
            initialAttendeeNames={attendeeNames}
          />
        </div>
      </section>
    </main>
  );
}
