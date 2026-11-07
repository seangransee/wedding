import { Fragment } from "react";
import { InlineMarkdown, readScheduleDay, type ScheduleEvent } from "./markdown-content";
import { getRehearsalCalendarUrl, getWeddingCalendarUrl, getWelcomePartyCalendarUrl } from "./wedding-details";

type ScheduleSource = {
  fileName: string;
  calendarHref: string;
};

type ScheduleEventWithCalendar = ScheduleEvent & { calendarHref?: string };

// Each schedule file holds one day; files for the same day merge under one date heading.
function buildScheduleDays(sourcesByDay: ScheduleSource[][]) {
  return sourcesByDay
    .filter((sources) => sources.length > 0)
    .map((sources) => {
      const parsed = sources.map((source) => ({ ...readScheduleDay(source.fileName), source }));
      const events: ScheduleEventWithCalendar[] = parsed.flatMap(({ events, source }) =>
        // The calendar link belongs to the file's last event (each file has one event today).
        events.map((event, index) => (index === events.length - 1 ? { ...event, calendarHref: source.calendarHref } : event)),
      );

      return {
        weekday: parsed[0].weekday,
        date: parsed[0].date,
        intro: parsed.flatMap((day) => day.intro),
        events,
      };
    });
}

function ScheduleEventCard({ event }: { event: ScheduleEventWithCalendar }) {
  const [venueName, ...venueRest] = event.venue;

  return (
    <li className="schedule-event">
      {event.time ? <p className="schedule-event-time">{event.time}</p> : null}
      <h4 className="schedule-event-title">{event.title}</h4>
      {venueName ? (
        <address className="schedule-event-venue">
          <span className="schedule-event-venue-name">
            <InlineMarkdown text={venueName} />
          </span>
          {venueRest.map((line) => (
            <span key={line} className="schedule-event-venue-line">
              <InlineMarkdown text={line} />
            </span>
          ))}
        </address>
      ) : null}
      {event.notes.map((note) => (
        <p key={note} className="schedule-event-note">
          <InlineMarkdown text={note} />
        </p>
      ))}
      {event.calendarHref ? (
        // Shown only to guests who have already RSVP'd (see .guest-schedule-calendar-link in globals.css).
        <a
          href={event.calendarHref}
          target="_blank"
          rel="noopener noreferrer"
          className="guest-schedule-calendar-link schedule-event-calendar"
        >
          Add to calendar
        </a>
      ) : null}
    </li>
  );
}

export function ScheduleSection({
  showFridayWelcome,
  showRehearsal,
  calendarWebsiteUrl,
}: {
  showFridayWelcome: boolean;
  showRehearsal: boolean;
  calendarWebsiteUrl: string;
}) {
  const websiteUrl = calendarWebsiteUrl;
  const days = buildScheduleDays([
    [
      ...(showRehearsal
        ? [{ fileName: "schedule-rehearsal.md", calendarHref: getRehearsalCalendarUrl({ websiteUrl }) }]
        : []),
      ...(showFridayWelcome
        ? [{ fileName: "schedule-friday.md", calendarHref: getWelcomePartyCalendarUrl({ websiteUrl }) }]
        : []),
    ],
    [{ fileName: "schedule.md", calendarHref: getWeddingCalendarUrl({ websiteUrl }) }],
  ]);

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
        <div className={`schedule-days ${days.length > 1 ? "schedule-days-multi" : ""}`}>
          {days.map((day, dayIndex) => (
            <Fragment key={day.date}>
              {dayIndex > 0 ? (
                <div className="schedule-day-divider" aria-hidden="true">
                  <span>囍</span>
                </div>
              ) : null}
              <div className="schedule-day">
                <header className="schedule-day-header">
                  {day.weekday ? (
                    <p className="schedule-day-weekday" style={{ fontFamily: "var(--font-brand-script)" }}>
                      {day.weekday}
                    </p>
                  ) : null}
                  <h3 className="schedule-day-date">{day.date}</h3>
                </header>
                {day.intro.map((text) => (
                  <p key={text} className="schedule-day-intro">
                    <InlineMarkdown text={text} />
                  </p>
                ))}
                <ol className="schedule-events">
                  {day.events.map((event) => (
                    <ScheduleEventCard key={event.title} event={event} />
                  ))}
                </ol>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
