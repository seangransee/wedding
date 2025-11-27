export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#054f2d] flex items-center justify-center py-12 px-6 text-white sm:py-16 md:py-20">
      <div
        className="art-deco-bg pointer-events-none absolute inset-0 -z-20"
        aria-hidden="true"
      />
      <div
        className="art-deco-beams pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-2xl">
        <div className="flex flex-col items-center justify-center px-10 py-16 text-center sm:px-12 sm:py-20">
          <h1
            className="whitespace-nowrap text-[#f1b3c6] text-[clamp(3rem,10vw,6rem)]"
            style={{
              fontFamily: "var(--font-dancing-script)",
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            Sean + Lexi = Sexi
          </h1>
        </div>
      </div>
    </main>
  );
}
