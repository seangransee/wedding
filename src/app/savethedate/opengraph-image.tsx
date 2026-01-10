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
          background: "#054f2d",
        }}
      >
        <div
          style={{
            width: "92%",
            height: "82%",
            borderRadius: "48px",
            border: "1px solid rgba(241, 179, 198, 0.45)",
            background:
              "linear-gradient(135deg, rgba(184, 134, 11, 0.9), rgba(184, 134, 11, 0.72))",
            boxShadow: "0 45px 90px rgba(5, 79, 45, 0.32)",
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
                "radial-gradient(circle at top center, rgba(241, 179, 198, 0.32), transparent 58%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "0",
              backgroundImage:
                "repeating-linear-gradient(120deg, rgba(241, 179, 198, 0.1), rgba(241, 179, 198, 0.1) 2px, transparent 2px, transparent 24px)",
              opacity: 0.55,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: "1200px",
              height: "1200px",
              borderRadius: "50%",
              border: "1px solid rgba(241, 179, 198, 0.28)",
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
              border: "1px solid rgba(241, 179, 198, 0.18)",
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
                color: "#f1b3c6",
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
                  background: "rgba(241, 179, 198, 0.45)",
                }}
              />
              SAVE THE DATE
              <span
                style={{
                  display: "block",
                  height: "1px",
                  width: "120px",
                  background: "rgba(241, 179, 198, 0.45)",
                }}
              />
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div
                style={{
                  fontFamily: "'Dancing Script', 'Cormorant Garamond', serif",
                  fontSize: "110px",
                  letterSpacing: "6px",
                  color: "#f1b3c6",
                  fontWeight: 600,
                  textShadow: "0 6px 18px rgba(5, 79, 45, 0.35)",
                }}
              >
                Sean + Lexi = Sexi
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                color: "#054f2d",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
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
                  color: "#054f2d",
                }}
              >
                December 12, 2026
              </div>
              <div
                style={{
                  fontFamily:
                    "'Libre Baskerville', 'Cormorant Garamond', serif",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "28px",
                  fontWeight: 700,
                  letterSpacing: "6px",
                  textTransform: "uppercase",
                  color: "#054f2d",
                }}
              >
                Chicago, IL
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
