import type { ReactNode } from "react";
import { MarkdownContent } from "./markdown-content";
import { WEDDING_DETAILS } from "./wedding-details";

export { LockedNotice } from "./locked-notice";

type WeddingPageShellProps = {
  panel: ReactNode;
  panelClassName?: string;
  panelId?: string;
  panelNavLabel?: string;
  showHotelBlocks?: boolean;
};

const defaultPanelClassName =
  "w-full min-w-0 rounded-lg border border-[#b8860b]/55 bg-[#fff6fa]/88 p-4 shadow-[0_30px_70px_-38px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:p-7 lg:p-8 lg:shadow-[0_40px_90px_-40px_rgba(0,0,0,0.55)]";

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
    <div className="guest-hero-copy mx-auto w-full max-w-[23rem] text-center text-[#fff6fa] lg:mx-0 lg:max-w-md lg:text-left">
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
  panelId,
  panelNavLabel,
}: {
  panelId: string;
  panelNavLabel: string;
}) {
  const navItems = [
    { href: `#${panelId}`, label: panelNavLabel },
    { href: "#our-story", label: "Our Story" },
    { href: "#faqs", label: "FAQs" },
    { href: "#hotel-blocks", label: "Hotels" },
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

function LongFormSections({ showHotelBlocks }: { showHotelBlocks: boolean }) {
  return (
    <div className="pb-16">
      <MarkdownContent id="our-story" fileName="our-story.md" />
      <MarkdownContent
        id="faqs"
        fileName="faqs.md"
        lockedBlocks={!showHotelBlocks}
        subtitleFromFirstParagraph
      />
      <MarkdownContent
        id="hotel-blocks"
        fileName="hotel-blocks.md"
        lockedBlocks={!showHotelBlocks}
      />
    </div>
  );
}

export function WeddingPageShell({
  panel,
  panelClassName = defaultPanelClassName,
  panelId = "wedding-details",
  panelNavLabel = "Wedding Details",
  showHotelBlocks = false,
}: WeddingPageShellProps) {
  return (
    <main className="guest-invitation-page relative min-h-screen bg-[#031b12] px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[#4a1f2e] sm:px-6 sm:py-8 lg:px-8">
      <div
        className="guest-photo-scrim pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
      />
      <DoubleHappinessFrame />
      <PageNav
        panelId={panelId}
        panelNavLabel={panelNavLabel}
      />

      <section className="guest-hero-section relative z-10 mx-auto grid min-h-[calc(100svh-2rem)] max-w-6xl items-end gap-4 pt-[57svh] sm:gap-6 sm:pt-[52svh] lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-8 lg:pb-14 lg:pt-[45svh]">
        <EventHeroCopy />
        <div id={panelId} className={`${panelClassName} scroll-mt-28`}>
          {panel}
        </div>
      </section>

      <LongFormSections showHotelBlocks={showHotelBlocks} />
    </main>
  );
}
