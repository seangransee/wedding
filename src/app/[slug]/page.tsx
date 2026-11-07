import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuestPageData } from "@/lib/db";
import { EMPTY_MAILING_ADDRESS } from "@/lib/mailing-address";
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

  if (!data) {
    return {
      title: "Invitation not found",
    };
  }

  const isAttending = data.rsvp?.status === "yes";
  // The query string only changes the URL so link-preview caches pick up the attending image.
  const imageUrl = `/${slug}/opengraph-image${isAttending ? "?rsvp=yes" : ""}`;
  const shareTitle = isAttending
    ? `${data.guest.name}, wedding details inside`
    : `${data.guest.name}, you're invited!`;
  const description = isAttending
    ? "Schedule, hotels, and details for Sean and Lexi's wedding."
    : "RSVP for Sean and Lexi's wedding.";

  return {
    title: `${data.guest.name} | Sexi Wedding`,
    description,
    openGraph: {
      title: shareTitle,
      description,
      type: "website",
      locale: "en_US",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: isAttending
            ? `${data.guest.name}, wedding details for Sean and Lexi's wedding inside.`
            : `${data.guest.name}, you're invited to Sean and Lexi's wedding.`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
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
      showFridayWelcome={data.guest.friDin}
      showRehearsal={data.guest.reh}
      scheduleFirst={data.rsvp?.status === "yes" || data.rsvp?.status === "no"}
      panel={
        <RsvpForm
          slug={slug}
          guestName={data.guest.name}
          guestCount={data.guest.guestCount}
          fuckYes={data.guest.fuckYes}
          initialStatus={data.rsvp?.status ?? ""}
          initialAttendingCount={data.rsvp?.attendingCount ?? null}
          initialAttendeeDetails={attendeeDetails}
          initialMailingAddress={data.rsvp?.mailingAddress ?? EMPTY_MAILING_ADDRESS}
        />
      }
    />
  );
}
