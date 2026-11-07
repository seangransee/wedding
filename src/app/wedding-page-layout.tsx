"use client";

import { useState, type ReactNode } from "react";

type WeddingPageLayoutProps = {
  scheduleFirst: boolean;
  hasPhotos: boolean;
  panelId: string;
  panelNavLabel: string;
  panelClassName: string;
  heroCopy: ReactNode;
  panel: ReactNode;
  schedule: ReactNode;
  gifts: ReactNode;
  hotels: ReactNode;
  faqs: ReactNode;
  ourStory: ReactNode;
  photos: ReactNode;
};

const followingBlockClassName = "relative z-10 mx-auto mt-12 max-w-5xl sm:mt-16 lg:mt-20";

function PageNav({
  hasPhotos,
  panelId,
  panelNavLabel,
  scheduleFirst,
}: {
  hasPhotos: boolean;
  panelId: string;
  panelNavLabel: string;
  scheduleFirst: boolean;
}) {
  const panelItem = { href: `#${panelId}`, label: panelNavLabel };
  const scheduleItem = { href: "#schedule", label: "Schedule" };
  const navItems = [
    ...(scheduleFirst ? [scheduleItem, panelItem] : [panelItem, scheduleItem]),
    { href: "#registry", label: "Gifts" },
    { href: "#hotel-blocks", label: "Hotels" },
    { href: "#faqs", label: "FAQs" },
    { href: "#our-story", label: "Our Story" },
    ...(hasPhotos ? [{ href: "#photos", label: "Sexi Adventures" }] : []),
  ];

  return (
    <nav
      aria-label="On this page"
      className="guest-page-nav sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 mx-auto rounded-lg border border-[#ffd6e4]/45 bg-[#031b12]/88 px-2 py-2 text-[#ffd6e4] shadow-[0_18px_45px_-30px_rgba(0,0,0,0.75)] backdrop-blur-md"
    >
      <div className="guest-page-nav-list">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="guest-page-nav-link inline-flex min-h-9 items-center justify-center rounded-md border border-[#ffd6e4]/35 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#ffd6e4] transition hover:border-[#ffd6e4] hover:text-[#ffd6e4] sm:text-[0.66rem]"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function WeddingPageLayout({
  scheduleFirst,
  hasPhotos,
  panelId,
  panelNavLabel,
  panelClassName,
  heroCopy,
  panel,
  schedule,
  gifts,
  hotels,
  faqs,
  ourStory,
  photos,
}: WeddingPageLayoutProps) {
  // Freeze the order chosen when the page first loads, so an RSVP save that
  // refreshes the route does not move the form out from under the guest.
  const [isScheduleFirst] = useState(scheduleFirst);

  const panelBlock = (
    <div id={panelId} className={`${panelClassName} scroll-mt-40 sm:scroll-mt-28`}>
      {panel}
    </div>
  );

  return (
    <>
      <PageNav
        hasPhotos={hasPhotos}
        panelId={panelId}
        panelNavLabel={panelNavLabel}
        scheduleFirst={isScheduleFirst}
      />

      <section className="guest-hero-section relative z-10 mx-auto grid min-h-[calc(100svh-2rem)] max-w-5xl items-end gap-4 pt-[36svh]">
        {heroCopy}
        {isScheduleFirst ? schedule : panelBlock}
      </section>

      <div className="pb-16">
        <div className={followingBlockClassName}>{isScheduleFirst ? panelBlock : schedule}</div>
        {gifts}
        {hotels}
        {faqs}
        {ourStory}
        {photos}
      </div>
    </>
  );
}
