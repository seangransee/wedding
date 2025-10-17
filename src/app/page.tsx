export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center py-8 px-6 text-[#4a1f2e] sm:py-12 md:py-16">
      <div className="relative w-full max-w-3xl">
        <div className="absolute inset-0 rounded-[40px] bg-white/30 blur-3xl" aria-hidden="true" />
        <div className="relative overflow-hidden rounded-[40px] border border-white/70 bg-white/80 backdrop-blur-md shadow-2xl p-8 text-center sm:p-10 md:p-12">
          <div className="absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#f5c9dc]/20 blur-3xl" aria-hidden="true" />
          <p className="text-xs tracking-[0.4em] uppercase text-[#a26786]">Save The Date</p>
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
          <h1 className="mt-6 text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl">
            Lexi and Sean are{" "}
            <span className="relative inline-flex items-center px-4 py-1 align-baseline">
              <span
                className="absolute inset-0 rounded-full bg-gradient-to-r from-[#f6c9dc] via-[#fbe3f1] to-[#f6c9dc] opacity-80"
                aria-hidden="true"
              />
              <span
                className="absolute inset-1 rounded-full border border-[#f2b5cd]/80"
                aria-hidden="true"
              />
              <span className="relative z-10 italic font-semibold tracking-wide text-[#7d3b54]">
                finally
              </span>
            </span>{" "}
            getting married.
          </h1>
          <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-center md:gap-16">
            <div>
              <p className="text-xl font-semibold text-[#b15581] sm:text-2xl">December 12, 2026</p>
            </div>
            <div className="hidden md:block h-16 w-px bg-gradient-to-b from-[#f1b9ce]/40 via-[#d48dad]/60 to-[#f1b9ce]/40" />
            <div>
              <p className="text-xl font-semibold text-[#b15581] sm:text-2xl">The Blackstone Hotel</p>
              <p className="mt-2 text-sm uppercase tracking-[0.25em] text-[#a26786]">Chicago, IL</p>
            </div>
          </div>
          <div className="mt-8 text-xs uppercase tracking-[0.45em] text-[#c07a9c] sm:mt-10">
            Invitation to follow
          </div>
        </div>
      </div>
    </main>
  );
}
