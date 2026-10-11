import { MarkdownCopy } from "./markdown-content";

export function ScheduleSection({ showFridayWelcome }: { showFridayWelcome: boolean }) {
  return (
    <section
      id="schedule"
      aria-labelledby="schedule-heading"
      className="relative z-10 mx-auto mt-12 max-w-5xl scroll-mt-40 sm:scroll-mt-28 sm:mt-16 lg:mt-20"
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
            </div>
          ) : null}
          <div className="guest-schedule-day">
            <MarkdownCopy fileName="schedule.md" />
          </div>
        </div>
      </div>
    </section>
  );
}
