import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { WEDDING_DETAILS } from "./wedding-details";

type WeddingPageShellProps = {
  panel: ReactNode;
  panelClassName?: string;
  panelId?: string;
  panelNavLabel?: string;
  showHotelBlocks?: boolean;
};

const defaultPanelClassName =
  "w-full min-w-0 rounded-lg border border-[#b8860b]/55 bg-[#fff6fa]/64 p-4 shadow-[0_30px_70px_-38px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:p-7 lg:p-8 lg:shadow-[0_40px_90px_-40px_rgba(0,0,0,0.55)]";

function DoubleHappinessFrame() {
  return (
    <div className="guest-double-happiness-frame" aria-hidden="true">
      <span className="guest-double-happiness guest-double-happiness-top-left">
        囍
      </span>
      <span className="guest-double-happiness guest-double-happiness-top-right">
        囍
      </span>
      <span className="guest-double-happiness guest-double-happiness-bottom-left">
        囍
      </span>
      <span className="guest-double-happiness guest-double-happiness-bottom-right">
        囍
      </span>
    </div>
  );
}

function EventHeroCopy() {
  return (
    <div className="px-1 text-center text-[#fff6fa] lg:px-0 lg:text-left">
      <p
        className="text-3xl leading-none text-[#f1b3c6] sm:text-5xl"
        style={{ fontFamily: "var(--font-dancing-script)", fontWeight: 600 }}
      >
        {WEDDING_DETAILS.brand}
      </p>
      <h1 className="mt-3 text-4xl font-semibold leading-none text-[#ffd86e] sm:mt-6 sm:text-6xl lg:text-7xl">
        {WEDDING_DETAILS.dateLabel}
      </h1>
      <div className="mt-4 grid gap-2 text-lg font-semibold sm:mt-7 sm:gap-3 sm:text-2xl">
        <a
          href={WEDDING_DETAILS.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center underline decoration-dashed decoration-1 underline-offset-6 transition hover:text-[#f1b3c6] lg:justify-start"
        >
          {WEDDING_DETAILS.venueName}
        </a>
        <p className="text-xs uppercase tracking-[0.25em] text-[#f1b3c6] sm:text-sm sm:tracking-[0.35em]">
          {WEDDING_DETAILS.locationLabel}
        </p>
      </div>
      <a
        href={WEDDING_DETAILS.calendarUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex min-h-11 items-center justify-center text-xs font-semibold uppercase tracking-[0.18em] text-[#f1b3c6] underline decoration-dashed decoration-1 underline-offset-4 transition hover:text-[#fff6fa] sm:mt-8 sm:text-sm sm:tracking-[0.22em]"
      >
        Add to calendar
      </a>
    </div>
  );
}

function PageNav({
  finalSectionLabel,
  panelId,
  panelNavLabel,
}: {
  finalSectionLabel: string;
  panelId: string;
  panelNavLabel: string;
}) {
  const navItems = [
    { href: `#${panelId}`, label: panelNavLabel },
    { href: "#weekend", label: "Weekend" },
    { href: "#our-story", label: "Our Story" },
    { href: "#details", label: finalSectionLabel },
  ];

  return (
    <nav
      aria-label="On this page"
      className="sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 mx-auto w-[calc(100%-8rem)] max-w-md rounded-lg border border-[#b8860b]/45 bg-[#031b12]/88 px-2 py-2 text-[#fff6fa] shadow-[0_18px_45px_-30px_rgba(0,0,0,0.75)] backdrop-blur-md sm:w-fit sm:max-w-[calc(100%-9rem)] sm:px-3 lg:max-w-6xl"
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex flex-wrap justify-center gap-2">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-9 items-center rounded-md border border-[#b8860b]/35 px-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#fff6fa] transition hover:border-[#f1b3c6] hover:text-[#f1b3c6] sm:px-3 sm:text-xs sm:tracking-[0.12em]"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

export function LockedNotice({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#b8860b]/35 bg-white/45 p-4 text-center shadow-[inset_0_0_0_1px_rgba(255,246,250,0.35)] sm:p-5">
      <div className="mx-auto grid size-11 place-items-center rounded-full border border-[#b8860b]/45 bg-[#054f2d] text-[#fff6fa]">
        <Lock size={19} strokeWidth={2.2} aria-hidden="true" />
      </div>
      <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#054f2d]">
        {title}
      </h2>
      <p className="mt-2 text-base leading-relaxed text-[#4a1f2e]/78">
        {children}
      </p>
    </div>
  );
}

function WeddingInfoSections({ showHotelBlocks }: { showHotelBlocks: boolean }) {
  return (
    <section className="relative z-10 mx-auto mt-5 grid max-w-6xl gap-4 pb-16 sm:mt-8 sm:gap-5 lg:grid-cols-3">
      <article
        id="weekend"
        className="scroll-mt-28 rounded-lg border border-[#b8860b]/45 bg-[#fff6fa]/76 p-5 text-[#4a1f2e] shadow-[0_24px_65px_-42px_rgba(0,0,0,0.6)] backdrop-blur-sm sm:p-7"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f2448]">
          The Weekend
        </p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#054f2d] sm:text-3xl">
          More celebration details are on the way.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[#4a1f2e]/78">
          We are planning a weekend full of good food, music, and time with the
          people we love. Check back here for schedule notes, travel ideas, and
          the little things that will make the trip easy.
        </p>
      </article>

      <article
        id="our-story"
        className="scroll-mt-28 rounded-lg border border-[#b8860b]/45 bg-[#fff6fa]/76 p-5 text-[#4a1f2e] shadow-[0_24px_65px_-42px_rgba(0,0,0,0.6)] backdrop-blur-sm sm:p-7"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f2448]">
          Our Story
        </p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#054f2d] sm:text-3xl">
          A love story with plenty more chapters ahead.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[#4a1f2e]/78">
          We met, we laughed, we kept choosing each other, and somewhere along
          the way this celebration became the obvious next page. We are excited
          to mark the moment with the people who helped shape our story.
        </p>
      </article>

      <article
        id="details"
        className="scroll-mt-28 rounded-lg border border-[#b8860b]/45 bg-[#fff6fa]/76 p-5 text-[#4a1f2e] shadow-[0_24px_65px_-42px_rgba(0,0,0,0.6)] backdrop-blur-sm sm:p-7"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f2448]">
          Hotel Blocks
        </p>
        {showHotelBlocks ? (
          <>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#054f2d] sm:text-3xl">
              Rooms are available through our wedding blocks.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#4a1f2e]/78">
              Use either Marriott reservation link below to book with the
              wedding rate. More travel notes, attire details, and frequently
              asked questions will live here as plans firm up.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {WEDDING_DETAILS.hotelBlocks.map((hotelBlock) => (
                <a
                  key={hotelBlock.url}
                  href={hotelBlock.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#054f2d] bg-[#054f2d] px-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#fff6fa] transition hover:bg-[#0d6b40]"
                >
                  {hotelBlock.label}
                </a>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4">
            <LockedNotice title="Hotel Blocks">
              Click the invitation link we sent you to view booking details.
            </LockedNotice>
          </div>
        )}
      </article>
    </section>
  );
}

export function WeddingPageShell({
  panel,
  panelClassName = defaultPanelClassName,
  panelId = "wedding-details",
  panelNavLabel = "Wedding Details",
  showHotelBlocks = false,
}: WeddingPageShellProps) {
  const finalSectionLabel = "Hotel Blocks";

  return (
    <main className="guest-invitation-page relative min-h-screen bg-[#054f2d] bg-cover bg-no-repeat px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[#4a1f2e] sm:px-6 sm:py-8 lg:px-8">
      <div
        className="pointer-events-none absolute inset-0 bg-[#031b12]/50"
        aria-hidden="true"
      />
      <DoubleHappinessFrame />
      <PageNav
        finalSectionLabel={finalSectionLabel}
        panelId={panelId}
        panelNavLabel={panelNavLabel}
      />

      <section className="relative z-10 mx-auto grid max-w-6xl items-start gap-4 pt-16 sm:gap-6 sm:pt-0 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <EventHeroCopy />
        <div id={panelId} className={`${panelClassName} scroll-mt-28`}>
          {panel}
        </div>
      </section>

      <WeddingInfoSections showHotelBlocks={showHotelBlocks} />
    </main>
  );
}
