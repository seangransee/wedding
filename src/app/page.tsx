import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { GUEST_COOKIE_NAME } from "@/lib/cookies";
import { guestSlugExists } from "@/lib/db";
import { isValidSlug } from "@/lib/slug";

export default async function Home() {
  const cookieStore = await cookies();
  const guestSlug = cookieStore.get(GUEST_COOKIE_NAME)?.value;

  if (isValidSlug(guestSlug) && (await guestSlugExists(guestSlug))) {
    redirect(`/${guestSlug}`);
  }

  redirect("/savethedate");
}
