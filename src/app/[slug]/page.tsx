import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuestPageData } from "@/lib/db";
import { WEDDING_DETAILS } from "../wedding-details";
import { WeddingPageShell } from "../wedding-page-shell";
import { RsvpForm } from "./rsvp-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getGuestPageData(slug);
  const imageUrl = `/${slug}/opengraph-image`;

  if (!data) {
    return {
      title: "Invitation not found",
    };
  }

  return {
    title: `${data.guest.name} | Sexi Wedding`,
    description: "RSVP for Sean and Lexi's wedding.",
    openGraph: {
      title: `${data.guest.name}, you're invited!`,
      description: "RSVP for Sean and Lexi's wedding.",
      type: "website",
      locale: "en_US",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${data.guest.name}, you're invited to Sean and Lexi's wedding.`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${data.guest.name}, you're invited!`,
      description: "RSVP for Sean and Lexi's wedding.",
      images: [imageUrl],
    },
  };
}

export default async function GuestPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getGuestPageData(slug);

  if (!data) {
    notFound();
  }

  const attendeeDetails = Array.from(
    { length: data.rsvp?.attendingCount ?? 0 },
    (_, index) => {
      const attendee = data.attendees.find((entry) => entry.position === index + 1);

      return {
        fullName: attendee?.fullName ?? "",
        mealType: attendee?.mealType ?? null,
        dietaryNotes: attendee?.dietaryNotes ?? "",
      };
    },
  );

  return (
    <WeddingPageShell
      calendarWebsiteUrl={new URL(slug, WEDDING_DETAILS.websiteUrl).toString()}
      panelId="rsvp"
      panelNavLabel="RSVP"
      showHotelBlocks
      panel={
        <RsvpForm
          slug={slug}
          guestName={data.guest.name}
          guestCount={data.guest.guestCount}
          fuckYes={data.guest.fuckYes}
          initialStatus={data.rsvp?.status ?? ""}
          initialAttendingCount={data.rsvp?.attendingCount ?? null}
          initialAttendeeDetails={attendeeDetails}
        />
      }
    />
  );
}
