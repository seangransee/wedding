import type { ReactNode } from "react";
import { MarkdownContent } from "./markdown-content";
import { getWeddingCalendarUrl, WEDDING_DETAILS } from "./wedding-details";

export { LockedNotice } from "./locked-notice";

type WeddingPageShellProps = {
  panel: ReactNode;
  calendarWebsiteUrl?: string;
  panelClassName?: string;
  panelId?: string;
  panelNavLabel?: string;
  showHotelBlocks?: boolean;
};

const defaultPanelClassName =
  "guest-panel-surface w-full min-w-0 rounded-lg border border-[#b8860b]/65 p-5 text-[#f1b3c6] sm:p-8 lg:p-10";

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

function EventHeroCopy({ calendarWebsiteUrl }: { calendarWebsiteUrl: string }) {
  return (
    <div className="guest-hero-copy mx-0 w-full max-w-none text-center text-[#f1b3c6]">
      <p
        className="text-3xl leading-none text-[#f1b3c6]"
        style={{ fontFamily: "var(--font-dancing-script)", fontWeight: 600 }}
      >
        {WEDDING_DETAILS.brand}
      </p>
      <h1 className="mt-3 text-4xl font-semibold leading-none text-[#ffd86e]">
        {WEDDING_DETAILS.dateLabel}
      </h1>
      <div className="mt-4 grid gap-2 text-lg font-semibold">
        <a
          href={WEDDING_DETAILS.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center underline decoration-dashed decoration-1 underline-offset-6 transition hover:text-[#f1b3c6]"
        >
          {WEDDING_DETAILS.venueName}
        </a>
        <p className="text-xs uppercase tracking-[0.25em] text-[#f1b3c6]">
          {WEDDING_DETAILS.locationLabel}
        </p>
      </div>
      <a
        href={getWeddingCalendarUrl({ websiteUrl: calendarWebsiteUrl })}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex min-h-11 items-center justify-center text-xs font-semibold uppercase tracking-[0.18em] text-[#f1b3c6] underline decoration-dashed decoration-1 underline-offset-4 transition hover:text-[#ffd86e]"
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
      className="guest-page-nav sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 mx-auto rounded-lg border border-[#b8860b]/45 bg-[#031b12]/88 px-2 py-2 text-[#f1b3c6] shadow-[0_18px_45px_-30px_rgba(0,0,0,0.75)] backdrop-blur-md"
    >
      <div className="guest-page-nav-list">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="guest-page-nav-link inline-flex min-h-9 items-center justify-center rounded-md border border-[#b8860b]/35 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#f1b3c6] transition hover:border-[#f1b3c6] hover:text-[#ffd86e] sm:text-[0.66rem]"
          >
            {item.label}
          </a>
        ))}
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
        emphasizeHeadings
        lockedBlocks={!showHotelBlocks}
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
  calendarWebsiteUrl = WEDDING_DETAILS.websiteUrl,
  panelClassName = defaultPanelClassName,
  panelId = "wedding-details",
  panelNavLabel = "Wedding Details",
  showHotelBlocks = false,
}: WeddingPageShellProps) {
  return (
    <main className="guest-invitation-page relative min-h-screen bg-[#031b12] px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[#4a1f2e]">
      <div
        className="guest-photo-scrim pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
      />
      <DoubleHappinessFrame />
      <PageNav
        panelId={panelId}
        panelNavLabel={panelNavLabel}
      />

      <section className="guest-hero-section relative z-10 mx-auto grid min-h-[calc(100svh-2rem)] max-w-5xl items-end gap-4 pt-[42svh]">
        <EventHeroCopy calendarWebsiteUrl={calendarWebsiteUrl} />
        <div id={panelId} className={`${panelClassName} scroll-mt-28`}>
          {panel}
        </div>
      </section>

      <LongFormSections showHotelBlocks={showHotelBlocks} />
    </main>
  );
}
