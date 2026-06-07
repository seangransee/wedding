import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD } from "@/lib/cookies";
import { getAdminWeddingPhotos } from "@/lib/photos";
import { AdminLoginForm } from "../admin-client";
import { PhotoAdminClient } from "./photo-admin-client";

export const dynamic = "force-dynamic";

async function getIsAdminLoggedIn() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE_NAME)?.value === ADMIN_PASSWORD;
}

function AdminLoginNotice() {
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
          Photo admin
        </h1>
        <p className="mt-4 max-w-md text-base text-[#4a1027]/75">
          Enter the admin password to manage Sexi Adventures photos.
        </p>
        <div className="mt-8 w-full rounded-lg border border-[#df7fa3] bg-[#fff8fb]/85 p-6 shadow-[0_30px_80px_-50px_rgba(143,36,72,0.9)]">
          <AdminLoginForm />
        </div>
      </section>
    </main>
  );
}

export default async function AdminPhotosPage() {
  const isAdmin = await getIsAdminLoggedIn();

  if (!isAdmin) {
    return <AdminLoginNotice />;
  }

  const photos = await getAdminWeddingPhotos();

  return (
    <main className="min-h-screen bg-[#f9d8e6] px-3 py-3 text-[#4a1027] sm:px-4">
      <section className="mx-auto max-w-[96rem] border border-[#df7fa3] bg-[#fff1f7] shadow-[0_18px_50px_-38px_rgba(143,36,72,0.8)]">
        <div className="flex items-center justify-between border-b border-[#df7fa3] bg-[#fff8fb] px-3 py-2 text-xs font-semibold">
          <Link
            href="/admin"
            className="text-[#8f2448] underline decoration-dashed underline-offset-4 transition hover:text-[#be185d]"
          >
            Back to RSVP admin
          </Link>
          <Link
            href="/#photos"
            className="text-[#8f2448] underline decoration-dashed underline-offset-4 transition hover:text-[#be185d]"
          >
            View gallery
          </Link>
        </div>
        <PhotoAdminClient photos={photos} />
      </section>
    </main>
  );
}
