import { notFound } from "next/navigation";
import { getGuestPageData } from "@/lib/db";
import { generateAttendingOgImage, generateInvitationOgImage } from "@/lib/opengraph-image";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type ImageProps = {
  params: Promise<{ slug: string }>;
};

export default async function Image({ params }: ImageProps) {
  const { slug } = await params;
  const data = await getGuestPageData(slug);

  if (!data) {
    notFound();
  }

  // Guests who said yes get "Name, wedding details inside" instead of the invitation.
  return data.rsvp?.status === "yes"
    ? generateAttendingOgImage(data.guest.name)
    : generateInvitationOgImage(data.guest.name);
}
