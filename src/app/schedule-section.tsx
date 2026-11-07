import { MarkdownCopy } from "./markdown-content";
import { getWeddingCalendarUrl, getWelcomePartyCalendarUrl } from "./wedding-details";

// Shown only to guests who have already RSVP'd (see .guest-schedule-calendar-link in globals.css).
function ScheduleCalendarLink({ href }: { href: string }) {
  return (
    <div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="guest-schedule-calendar-link mt-4 inline-flex min-h-11 items-center justify-self-start text-xs font-semibold uppercase tracking-[0.18em] text-[#ffd6e4] underline decoration-dashed decoration-1 underline-offset-4 transition hover:text-[#ffd6e4]"
      >
        Add to calendar
      </a>
    </div>
  );
}

export function ScheduleSection({
  showFridayWelcome,
  calendarWebsiteUrl,
}: {
  showFridayWelcome: boolean;
  calendarWebsiteUrl: string;
}) {
  return (
    <section
      id="schedule"
      aria-labelledby="schedule-heading"
      className="relative z-10 mx-auto w-full max-w-5xl scroll-mt-40 sm:scroll-mt-28"
    >
      <div className="guest-panel-surface rounded-lg border border-[#ffd6e4]/60 p-5 sm:p-8 lg:p-10">
        <header className="border-b border-[#ffd6e4]/45 pb-5 text-center sm:pb-6">
          <h2 id="schedule-heading" className="text-4xl font-semibold leading-tight sm:text-6xl">
            Schedule
          </h2>
        </header>
        <div className="mx-auto grid max-w-2xl gap-10 pt-6 sm:gap-12 sm:pt-8">
          {showFridayWelcome ? (
            <div className="guest-schedule-day">
              <MarkdownCopy fileName="schedule-friday.md" />
              <ScheduleCalendarLink href={getWelcomePartyCalendarUrl({ websiteUrl: calendarWebsiteUrl })} />
            </div>
          ) : null}
          <div className="guest-schedule-day">
            <MarkdownCopy fileName="schedule.md" />
            <ScheduleCalendarLink href={getWeddingCalendarUrl({ websiteUrl: calendarWebsiteUrl })} />
          </div>
        </div>
      </div>
    </section>
  );
}
