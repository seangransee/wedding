import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const fontPath = (...segments: string[]) =>
  path.join(process.cwd(), "public", "fonts", ...segments);

const fontDataCormorant = readFile(fontPath("CormorantGaramond-SemiBold.ttf"));
const fontDataLibre = readFile(fontPath("LibreBaskerville-Bold.ttf"));
const fontDataDancing = readFile(fontPath("DancingScript-SemiBold.ttf"));

export default async function handler() {
  const [cormorantFont, libreFont, dancingFont] = await Promise.all([
    fontDataCormorant,
    fontDataLibre,
    fontDataDancing,
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9eef4",
        }}
      >
        <div
          style={{
            width: "92%",
            height: "82%",
            borderRadius: "48px",
            border: "1px solid rgba(255,255,255,0.65)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
            boxShadow: "0 45px 90px rgba(76, 51, 69, 0.25)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "72px 96px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "0",
              background:
                "radial-gradient(circle at top center, rgba(245, 201, 220, 0.38), transparent 58%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "0",
              backgroundImage:
                "repeating-linear-gradient(120deg, rgba(212, 141, 173, 0.08), rgba(212, 141, 173, 0.08) 2px, transparent 2px, transparent 24px)",
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: "1200px",
              height: "1200px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.25)",
              top: "-60%",
              left: "50%",
              marginLeft: "-600px",
              opacity: 0.4,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: "1400px",
              height: "1400px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.12)",
              top: "-68%",
              left: "50%",
              marginLeft: "-700px",
              opacity: 0.3,
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              height: "100%",
              padding: "12px 0 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "18px",
                textTransform: "uppercase",
                letterSpacing: "12px",
                color: "#a26786",
                fontSize: "32px",
                fontFamily: "'Libre Baskerville', 'Cormorant Garamond', serif",
                fontWeight: 700,
                marginBottom: "0px",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "1px",
                  width: "120px",
                  background: "rgba(162, 103, 134, 0.4)",
                }}
              />
              SAVE THE DATE
              <span
                style={{
                  display: "block",
                  height: "1px",
                  width: "120px",
                  background: "rgba(162, 103, 134, 0.4)",
                }}
              />
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div
                style={{
                  fontFamily: "'Dancing Script', 'Cormorant Garamond', serif",
                  fontSize: "110px",
                  letterSpacing: "6px",
                  color: "#d48dad",
                  fontWeight: 600,
                }}
              >
                Sean + Lexi = Sexi
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                color: "#4a1f2e",
                display: "flex",
                flexDirection: "column",
                gap: "28px",
                marginTop: "auto",
                marginBottom: "-12px",
              }}
            >
              <div
                style={{
                  fontFamily:
                    "'Libre Baskerville', 'Cormorant Garamond', serif",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "54px",
                  fontWeight: 700,
                  letterSpacing: "8px",
                  textTransform: "uppercase",
                  color: "#a26786",
                }}
              >
                December 12, 2026
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Cormorant Garamond",
          data: cormorantFont,
          style: "normal",
          weight: 600,
        },
        {
          name: "Libre Baskerville",
          data: libreFont,
          style: "normal",
          weight: 700,
        },
        {
          name: "Dancing Script",
          data: dancingFont,
          style: "normal",
          weight: 600,
        },
      ],
    }
  );
}
