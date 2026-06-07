import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { GUEST_COOKIE_NAME } from "@/lib/cookies";
import { guestSlugExists } from "@/lib/db";
import { isValidSlug } from "@/lib/slug";
import { LockedNotice, WeddingPageShell } from "./wedding-page-shell";

export const metadata: Metadata = {
  title: "Sexi Wedding",
  description:
    "Sean and Lexi are getting married on December 12, 2026 at The Blackstone Hotel in Chicago, IL.",
};

export default async function Home() {
  const cookieStore = await cookies();
  const guestSlug = cookieStore.get(GUEST_COOKIE_NAME)?.value;

  if (isValidSlug(guestSlug) && (await guestSlugExists(guestSlug))) {
    redirect(`/${guestSlug}`);
  }

  return (
    <WeddingPageShell
      panelId="rsvp"
      panelNavLabel="RSVP"
      panel={
        <LockedNotice title="RSVP">
          Click the invitation link we sent you to RSVP.
        </LockedNotice>
      }
    />
  );
}
