import type { Viewport } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD } from "@/lib/cookies";
import { getSeatingChart, isMissingSeatingTablesError } from "@/lib/db";
import type { SeatingChartData } from "@/lib/seating";
import { AdminLoginForm } from "../admin-client";
import { SeatingChartClient } from "./seating-chart-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Seating chart - Sexi Wedding",
};
// Full-screen app layout: extend under the notch/home indicator and pad with
// safe-area insets instead. The floor plan handles its own pinch zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

async function getIsAdminLoggedIn() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE_NAME)?.value === ADMIN_PASSWORD;
}

function AdminNotice({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <main className="min-h-screen bg-[#fde8f1] px-6 py-12 text-[#4a1027]">
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl flex-col items-center justify-center text-center">
        <p
          className="text-4xl text-[#be185d] sm:text-5xl"
          style={{ fontFamily: "var(--font-brand-script)", fontWeight: 400 }}
        >
          Sean + Lexi
        </p>
        <h1 className="mt-5 text-4xl font-semibold text-[#8f2448] sm:text-5xl">{title}</h1>
        {children}
      </section>
    </main>
  );
}

export default async function AdminSeatingPage() {
  const isAdmin = await getIsAdminLoggedIn();

  if (!isAdmin) {
    return (
      <AdminNotice title="Seating chart">
        <p className="mt-4 max-w-md text-base text-[#4a1027]/75">
          Enter the admin password to plan table assignments.
        </p>
        <div className="mt-8 w-full rounded-lg border border-[#df7fa3] bg-[#fff8fb]/85 p-6 shadow-[0_30px_80px_-50px_rgba(143,36,72,0.9)]">
          <AdminLoginForm />
        </div>
      </AdminNotice>
    );
  }

  let data: SeatingChartData;

  try {
    data = await getSeatingChart();
  } catch (error) {
    if (!isMissingSeatingTablesError(error)) {
      throw error;
    }

    return (
      <AdminNotice title="Seating chart">
        <p className="mt-4 max-w-md text-base text-[#4a1027]/75">
          The seating chart tables don&apos;t exist in this database yet. Run{" "}
          <code className="font-mono text-sm">npm run db:migrate</code> and reload.
        </p>
        <Link
          href="/admin"
          className="mt-6 text-sm font-semibold text-[#8f2448] underline decoration-dashed underline-offset-4"
        >
          Back to RSVP admin
        </Link>
      </AdminNotice>
    );
  }

  return <SeatingChartClient initialData={data} loadedAt={Date.now()} />;
}
