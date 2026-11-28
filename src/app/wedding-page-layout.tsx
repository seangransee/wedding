"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { WEDDING_DETAILS } from "./wedding-details";

type WeddingPageLayoutProps = {
  scheduleFirst: boolean;
  hasCompletedRsvp: boolean;
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
  weddingParty: ReactNode;
  ourStory: ReactNode;
  photos: ReactNode;
};

const followingBlockClassName = "relative z-10 mx-auto mt-12 max-w-5xl sm:mt-16 lg:mt-20";

function PageNav({
  hasPhotos,
  panelId,
  panelNavLabel,
  scheduleFirst,
  hasCompletedRsvp,
}: {
  hasPhotos: boolean;
  panelId: string;
  panelNavLabel: string;
  scheduleFirst: boolean;
  hasCompletedRsvp: boolean;
}) {
  const panelItem = { href: `#${panelId}`, label: panelNavLabel };
  const scheduleItem = { href: "#schedule", label: "Schedule" };
  const weddingPartyItem = { href: "#wedding-party", label: "Wedding Party" };
  const hotelsItem = { href: "#hotel-blocks", label: "Hotels" };
  const leadingItems = hasCompletedRsvp
    ? [scheduleItem, weddingPartyItem]
    : scheduleFirst
      ? [scheduleItem, weddingPartyItem, panelItem]
      : [panelItem, scheduleItem, weddingPartyItem];
  const navItems = [
    ...leadingItems,
    { href: "#registry", label: "Gifts" },
    ...(hasCompletedRsvp ? [] : [hotelsItem]),
    { href: "#faqs", label: "FAQs" },
    { href: "#our-story", label: "Our Story" },
    ...(hasPhotos ? [{ href: "#photos", label: "Sexi Adventures" }] : []),
    ...(hasCompletedRsvp ? [hotelsItem, panelItem] : []),
  ];

  return (
    <nav
      aria-label="On this page"
      className="guest-page-nav sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 mx-auto rounded-lg border border-[#ffd6e4]/45 bg-[#031b12]/88 px-2 py-2 text-[#ffd6e4] shadow-[0_18px_45px_-30px_rgba(0,0,0,0.75)] backdrop-blur-md"
    >
      {scheduleFirst ? (
        <p
          className="pb-1.5 text-center text-4xl leading-tight text-[#ffd6e4] sm:text-5xl"
          style={{ fontFamily: "var(--font-brand-script)", fontWeight: 400 }}
        >
          {WEDDING_DETAILS.brand}
        </p>
      ) : null}
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
  hasCompletedRsvp,
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
  weddingParty,
  ourStory,
  photos,
}: WeddingPageLayoutProps) {
  // Freeze the order chosen when the page first loads, so an RSVP save that
  // refreshes the route does not move the form out from under the guest.
  const [isScheduleFirst] = useState(scheduleFirst);
  const [isRsvpComplete] = useState(hasCompletedRsvp);
  const layoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layout = layoutRef.current;
    const nav = layout?.querySelector<HTMLElement>(".guest-page-nav");
    if (!layout || !nav) return;
    const surfaces = Array.from(
      layout.querySelectorAll<HTMLElement>(".guest-panel-surface, .guest-hero-copy"),
    ).filter((surface) => !surface.parentElement?.closest(".guest-panel-surface, .guest-hero-copy"));
    // Mask each glass panel itself so its backdrop blur still sees the photo.
    surfaces.forEach((surface) => surface.classList.add("guest-content-fade"));

    let frame = 0;
    const updateFade = () => {
      frame = 0;
      const navBottom = nav.getBoundingClientRect().bottom;
      const positions = surfaces.map((surface) => navBottom - surface.getBoundingClientRect().top);
      const anchorOffset = nav.offsetHeight + parseFloat(getComputedStyle(nav).top);
      surfaces.forEach((surface, index) => {
        surface.style.setProperty("--guest-content-fade-top", `${positions[index]}px`);
      });
      layout.style.setProperty(
        "--guest-anchor-offset",
        `calc(${anchorOffset}px + var(--guest-content-fade-distance) + 1rem)`,
      );
    };
    const requestUpdate = () => {
      if (!frame) frame = requestAnimationFrame(updateFade);
    };
    const observer = new ResizeObserver(requestUpdate);
    observer.observe(nav);
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    updateFade();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      cancelAnimationFrame(frame);
      surfaces.forEach((surface) => {
        surface.classList.remove("guest-content-fade");
        surface.style.removeProperty("--guest-content-fade-top");
      });
      layout.style.removeProperty("--guest-anchor-offset");
    };
  }, []);

  const panelBlock = (
    <div id={panelId} className={`${panelClassName} scroll-mt-40 sm:scroll-mt-28`}>
      {panel}
    </div>
  );

  return (
    <div
      ref={layoutRef}
      className="contents"
      data-schedule-first={isScheduleFirst ? "true" : "false"}
    >
      <PageNav
        hasPhotos={hasPhotos}
        panelId={panelId}
        panelNavLabel={panelNavLabel}
        scheduleFirst={isScheduleFirst}
        hasCompletedRsvp={isRsvpComplete}
      />

      <section
        className={`guest-hero-section relative z-10 mx-auto grid max-w-5xl gap-4 ${
          isScheduleFirst
            ? "guest-hero-section-schedule-first"
            : "min-h-[calc(100svh-2rem)] items-end pt-[36svh]"
        }`}
      >
        {/* RSVP'd guests get the brand mark in the nav instead of the date/venue card. */}
        {isScheduleFirst ? null : heroCopy}
        {isScheduleFirst ? schedule : panelBlock}
      </section>

      <div className="pb-16">
        {/* Wedding Party always sits right below Schedule, wherever Schedule lands. */}
        {isScheduleFirst ? null : <div className={followingBlockClassName}>{schedule}</div>}
        {weddingParty}
        {isScheduleFirst && !isRsvpComplete ? (
          <div className={followingBlockClassName}>{panelBlock}</div>
        ) : null}
        {gifts}
        {isRsvpComplete ? null : hotels}
        {faqs}
        {ourStory}
        {photos}
        {isRsvpComplete ? (
          <>
            {hotels}
            <div className={followingBlockClassName}>{panelBlock}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}
