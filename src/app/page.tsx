export default function Home() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <h1
        className="text-6xl md:text-8xl text-pink-500 text-center font-bold"
        style={{
          fontFamily: 'var(--font-dancing-script)',
          fontWeight: '700',
          textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
        }}
      >
        Sean + Lexi = Sexi
      </h1>
    </div>
  );
}
