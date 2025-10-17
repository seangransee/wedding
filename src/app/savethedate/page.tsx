import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Save The Date! - Sexi Wedding",
  description: "Lexi and Sean are finally getting married. December 12, 2026 at The Blackstone Hotel in Chicago, IL.",
  openGraph: {
    title: "Save The Date! - Sexi Wedding",
    description:
      "Lexi and Sean are finally getting married. December 12, 2026 at The Blackstone Hotel in Chicago, IL.",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/savethedate/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Lexi and Sean are finally getting married. December 12, 2026 at The Blackstone Hotel in Chicago, IL.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Save The Date! - Sexi Wedding",
    description:
      "Lexi and Sean are finally getting married. December 12, 2026 at The Blackstone Hotel in Chicago, IL.",
    images: ["/savethedate/opengraph-image"],
  },
};

export default function SaveTheDate() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f9eef4] flex items-center justify-center py-8 px-6 text-[#4a1f2e] sm:py-12 md:py-16">
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
        <div className="hero-card relative overflow-hidden rounded-[40px] border border-white/70 bg-white/80 backdrop-blur-md shadow-2xl p-8 text-center sm:p-10 md:p-12">
          <div
            className="hero-halo absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#f5c9dc]/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="deco-header mx-auto flex max-w-md items-center justify-center gap-3 text-[0.65rem] uppercase tracking-[0.55em] text-[#a26786]">
            <span className="deco-line" aria-hidden="true" />
            <span className="deco-badge">SAVE THE DATE</span>
            <span className="deco-line" aria-hidden="true" />
          </div>
          <p
            className="mt-3 text-3xl text-[#d48dad] sm:text-4xl md:text-5xl"
            style={{
              fontFamily: "var(--font-dancing-script)",
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            Sean + Lexi = Sexi
          </p>
          <h1 className="mt-6 text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl lg:text-6xl">
            <span className="block">Lexi and Sean are</span>
            <span className="finally-shimmer font-semibold text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
              finally
            </span>{" "}
            getting married.
          </h1>
          <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-center md:gap-16">
            <div>
              <p className="text-2xl font-semibold text-[#b15581] sm:text-3xl">
                December 12, 2026
              </p>
            </div>
            <div className="md:hidden text-xs uppercase tracking-[0.4em] text-[#a26786]">at</div>
            <div className="hidden md:block h-16 w-px bg-gradient-to-b from-[#f1b9ce]/40 via-[#d48dad]/60 to-[#f1b9ce]/40" />
            <div>
              <p className="text-2xl font-semibold text-[#b15581] sm:text-3xl">
                The Blackstone Hotel
              </p>
              <p className="mt-2 text-base uppercase tracking-[0.25em] text-[#a26786] sm:text-lg font-support-strong">
                Chicago, IL
              </p>
            </div>
          </div>
          <div className="mt-8 text-xs uppercase tracking-[0.45em] text-[#c07a9c] sm:mt-10 font-support-strong">
            Invitation to follow
          </div>
        </div>
      </div>
    </main>
  );
}
