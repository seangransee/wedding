import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Save the Date!",
  description:
    "Sean and Lexi are finally getting married! December 12, 2026 at The Blackstone Hotel in Chicago, IL.",
  openGraph: {
    title: "Save the Date!",
    description:
      "Sean and Lexi are finally getting married! December 12, 2026 at The Blackstone Hotel in Chicago, IL.",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/savethedate/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Sean and Lexi are finally getting married! December 12, 2026 at The Blackstone Hotel in Chicago, IL.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Save the Date!",
    description:
      "Sean and Lexi are finally getting married! December 12, 2026 at The Blackstone Hotel in Chicago, IL.",
    images: ["/savethedate/opengraph-image"],
  },
};

export default function SaveTheDate() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#054f2d] flex items-center justify-center py-8 px-6 text-white sm:py-12 md:py-16">
      <span
        className="pointer-events-none absolute top-6 left-6 text-4xl text-[#b8860b] opacity-85 sm:text-5xl md:text-6xl"
        aria-hidden="true"
      >
        囍
      </span>
      <span
        className="pointer-events-none absolute top-6 right-6 text-4xl text-[#b8860b] opacity-85 sm:text-5xl md:text-6xl"
        aria-hidden="true"
      >
        囍
      </span>
      <span
        className="pointer-events-none absolute bottom-6 left-6 text-4xl text-[#b8860b] opacity-85 sm:text-5xl md:text-6xl"
        aria-hidden="true"
      >
        囍
      </span>
      <span
        className="pointer-events-none absolute bottom-6 right-6 text-4xl text-[#b8860b] opacity-85 sm:text-5xl md:text-6xl"
        aria-hidden="true"
      >
        囍
      </span>
      <div
        className="art-deco-bg pointer-events-none absolute inset-0 -z-20"
        aria-hidden="true"
      />
      <div
        className="art-deco-beams pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-3xl">
        <div
          className="absolute inset-0 rounded-[40px] bg-white/30 blur-3xl"
          aria-hidden="true"
        />
        <div className="hero-card relative overflow-hidden rounded-[40px] border border-[#b8860b]/45 bg-[#b8860b]/70 backdrop-blur-md shadow-2xl p-8 text-center text-[#054f2d] sm:p-10 md:p-12">
          <div
            className="hero-halo absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#f5c9dc]/20 blur-3xl"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center text-[min(45vw,28rem)] font-semibold text-[#b8860b] opacity-10"
            aria-hidden="true"
          >
            囍
          </span>
          <div className="deco-header mx-auto flex max-w-md items-center justify-center gap-3 text-[0.65rem] uppercase tracking-[0.55em]">
            <span className="deco-line" aria-hidden="true" />
            <span className="deco-badge text-[#f7c6d8]">SAVE THE DATE</span>
            <span className="deco-line" aria-hidden="true" />
          </div>
          <p
            className="mt-3 text-3xl text-[#f7c6d8] sm:text-4xl md:text-5xl"
            style={{
              fontFamily: "var(--font-dancing-script)",
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            Sean + Lexi = Sexi
          </p>
          <h1 className="mt-6 text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl lg:text-6xl">
            <span className="block">Sean and Lexi are</span>
            <span className="font-semibold text-[#f7c6d8]">finally</span>{" "}
            getting married!
          </h1>
          <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-center md:gap-16">
            <div>
              <p className="text-2xl font-semibold sm:text-3xl">
                <a
                  href="https://www.google.com/calendar/render?action=TEMPLATE&text=Sean%20%26%20Lexi%27s%20Wedding&dates=20261212/20261213&location=The%20Blackstone%2C%20Autograph%20Collection%2C%20636%20South%20Michigan%20Avenue%2C%20Chicago%2C%20IL%2060605%2C%20USA&details=Lexi%20and%20Sean%20are%20finally%20getting%20married."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-current underline decoration-dashed decoration-1 decoration-[#054f2d]/50 underline-offset-6 hover:text-[#054f2d] hover:decoration-[#054f2d]"
                >
                  December 12, 2026
                </a>
              </p>
            </div>
            <div className="md:hidden text-xs uppercase tracking-[0.4em] text-[#f7c6d8]">
              at
            </div>
            <div className="hidden md:block h-16 w-px bg-gradient-to-b from-[#f7c6d8]/35 via-[#054f2d]/60 to-[#f7c6d8]/35" />
            <div>
              <p className="text-2xl font-semibold sm:text-3xl">
                <a
                  href="https://maps.app.goo.gl/UKgUKENz1W4efCC7A"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-current underline decoration-dashed decoration-1 decoration-[#054f2d]/50 underline-offset-6 hover:text-[#054f2d] hover:decoration-[#054f2d]"
                >
                  The Blackstone Hotel
                </a>
              </p>
              <p className="mt-2 text-base uppercase tracking-[0.25em] text-[#f7c6d8] sm:text-lg">
                Chicago, IL
              </p>
            </div>
          </div>
          <div className="mt-8 sm:mt-10">
            <div className="deco-header mx-auto flex max-w-md items-center justify-center gap-3 text-[0.65rem] uppercase tracking-[0.55em]">
              <span className="deco-line" aria-hidden="true" />
              <span className="deco-badge text-[#f7c6d8]">INVITATION TO FOLLOW</span>
              <span className="deco-line" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
