import { notFound } from "next/navigation";
import { getGuestBySlug } from "@/lib/db";
import { generateInvitationOgImage } from "@/lib/opengraph-image";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type ImageProps = {
  params: Promise<{ slug: string }>;
};

export default async function Image({ params }: ImageProps) {
  const { slug } = await params;
  const guest = await getGuestBySlug(slug);

  if (!guest) {
    notFound();
  }

  return generateInvitationOgImage(guest.name);
}
