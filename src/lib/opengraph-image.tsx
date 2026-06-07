import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";

const size = { width: 1200, height: 630 };

const fontPath = (...segments: string[]) =>
  path.join(process.cwd(), "public", "fonts", ...segments);

const fontDataCormorant = readFile(fontPath("CormorantGaramond-SemiBold.ttf"));
const fontDataLibre = readFile(fontPath("LibreBaskerville-Bold.ttf"));
const fontDataDancing = readFile(fontPath("DancingScript-SemiBold.ttf"));
const fontDataGreatVibes = readFile(fontPath("GreatVibes-Regular.ttf"));
const invitationBackgroundData = readFile(
  path.join(process.cwd(), "public", "sexi-background.jpg"),
).then((data) => `data:image/jpeg;base64,${data.toString("base64")}`);

function chunkLongWord(word: string, maxLength: number) {
  const chunks: string[] = [];

  for (let index = 0; index < word.length; index += maxLength) {
    chunks.push(word.slice(index, index + maxLength));
  }

  return chunks;
}

function splitNameLines(name: string) {
  const cleanName = name.trim().replace(/\s+/g, " ") || "You're invited";
  const maxLineLength =
    cleanName.length > 88
      ? 22
      : cleanName.length > 58
        ? 24
        : cleanName.length > 42
          ? 26
          : 30;
  const maxLines = 4;
  const words = cleanName
    .split(" ")
    .flatMap((word) =>
      word.length > maxLineLength ? chunkLongWord(word, maxLineLength) : word,
    );
  const lines: string[] = [];

  for (const word of words) {
    const currentLine = lines[lines.length - 1];
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (!currentLine) {
      lines.push(word);
    } else if (nextLine.length <= maxLineLength) {
      lines[lines.length - 1] = nextLine;
    } else if (lines.length < maxLines) {
      lines.push(word);
    } else {
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\.*$/, "")}...`;
      break;
    }
  }

  return {
    lines,
    isLong: cleanName.length > 58,
    fontSize:
      cleanName.length <= 24
        ? 76
        : cleanName.length <= 42
          ? 64
          : cleanName.length <= 66
            ? 54
            : cleanName.length <= 96
              ? 46
              : 40,
  };
}

type PublicOgImageOptions = {
  badge?: string;
};

export async function generateOgImage({
  badge = "SAVE THE DATE",
}: PublicOgImageOptions = {}) {
  const [cormorantFont, libreFont, dancingFont, greatVibesFont] = await Promise.all([
    fontDataCormorant,
    fontDataLibre,
    fontDataDancing,
    fontDataGreatVibes,
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
            border: "1px solid rgba(255, 214, 228, 0.45)",
            background:
              "linear-gradient(135deg, rgba(255, 214, 228, 0.9), rgba(255, 214, 228, 0.72))",
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
                "radial-gradient(circle at top center, rgba(255, 214, 228, 0.32), transparent 58%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "0",
              backgroundImage:
                "repeating-linear-gradient(120deg, rgba(255, 214, 228, 0.1), rgba(255, 214, 228, 0.1) 2px, transparent 2px, transparent 24px)",
              opacity: 0.55,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: "1200px",
              height: "1200px",
              borderRadius: "50%",
              border: "1px solid rgba(255, 214, 228, 0.28)",
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
              border: "1px solid rgba(255, 214, 228, 0.18)",
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
                color: "#ffd6e4",
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
                  background: "rgba(255, 214, 228, 0.45)",
                }}
              />
              {badge}
              <span
                style={{
                  display: "block",
                  height: "1px",
                  width: "120px",
                  background: "rgba(255, 214, 228, 0.45)",
                }}
              />
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div
                style={{
                  fontFamily: "'Great Vibes', 'Dancing Script', 'Cormorant Garamond', serif",
                  fontSize: "110px",
                  letterSpacing: "0px",
                  color: "#ffd6e4",
                  fontWeight: 400,
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
        {
          name: "Great Vibes",
          data: greatVibesFont,
          style: "normal",
          weight: 400,
        },
      ],
    }
  );
}

export async function generateInvitationOgImage(guestName: string) {
  const [cormorantFont, libreFont, dancingFont, greatVibesFont, backgroundImage] =
    await Promise.all([
      fontDataCormorant,
      fontDataLibre,
      fontDataDancing,
      fontDataGreatVibes,
      invitationBackgroundData,
    ]);
  const nameLayout = splitNameLines(guestName);
  const longestNameLineLength = Math.max(
    ...nameLayout.lines.map(
      (line, index) => line.length + (index === nameLayout.lines.length - 1 ? 1 : 0),
    ),
  );
  const invitationNameFontSize = Math.min(
    nameLayout.fontSize,
    longestNameLineLength > 24
      ? 54
      : longestNameLineLength > 18
        ? 64
        : 78,
  );
  const invitationSubheadFontSize = Math.min(
    invitationNameFontSize - 3,
    Math.round(invitationNameFontSize * 0.96),
  );
  const invitationBoxWidth = Math.ceil(
    Math.min(
      976,
      Math.max(
        300,
        longestNameLineLength * invitationNameFontSize * 0.58 + 44,
        "you're invited!".length * invitationSubheadFontSize * 0.42 + 44,
      ),
    ),
  );
  const strongInvitationShadow =
    "0 4px 0 rgba(3, 27, 18, 1), 0 -3px 0 rgba(3, 27, 18, 0.98), 4px 0 0 rgba(3, 27, 18, 0.98), -4px 0 0 rgba(3, 27, 18, 0.98), 3px 3px 0 rgba(3, 27, 18, 0.98), -3px 3px 0 rgba(3, 27, 18, 0.98), 3px -3px 0 rgba(3, 27, 18, 0.94), -3px -3px 0 rgba(3, 27, 18, 0.94), 0 0 18px rgba(3, 27, 18, 1), 0 0 34px rgba(3, 27, 18, 0.96), 0 14px 38px rgba(0, 0, 0, 1)";
  const softInvitationShadow =
    "0 3px 0 rgba(3, 27, 18, 1), 0 -3px 0 rgba(3, 27, 18, 0.96), 3px 0 0 rgba(3, 27, 18, 0.96), -3px 0 0 rgba(3, 27, 18, 0.96), 2px 2px 0 rgba(3, 27, 18, 0.96), -2px 2px 0 rgba(3, 27, 18, 0.96), 2px -2px 0 rgba(3, 27, 18, 0.92), -2px -2px 0 rgba(3, 27, 18, 0.92), 0 0 16px rgba(3, 27, 18, 1), 0 0 30px rgba(3, 27, 18, 0.94), 0 12px 34px rgba(0, 0, 0, 0.98)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#054f2d",
          color: "#ffd6e4",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backgroundImage}
          alt=""
          style={{
            position: "absolute",
            left: 0,
            top: "-520px",
            width: "1340px",
            height: "2010px",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(3, 27, 18, 0.82), rgba(3, 27, 18, 0.45) 52%, rgba(3, 27, 18, 0.76)), linear-gradient(180deg, rgba(3, 27, 18, 0.48), rgba(3, 27, 18, 0.18) 45%, rgba(3, 27, 18, 0.62))",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "34px",
            border: "2px solid rgba(255, 214, 228, 0.78)",
          }}
        />
        {[
          ["34px", "34px"],
          ["34px", "1114px"],
          ["528px", "34px"],
          ["528px", "1114px"],
        ].map(([top, left]) => (
          <div
            key={`${top}-${left}`}
            style={{
              position: "absolute",
              top,
              left,
              width: "52px",
              height: "52px",
              borderRadius: "999px",
              border: "1px solid rgba(255, 214, 228, 0.82)",
              background: "rgba(3, 27, 18, 0.66)",
              color: "#ffd6e4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily:
                "'Cormorant Garamond', 'Libre Baskerville', serif",
              fontSize: "34px",
              fontWeight: 600,
              lineHeight: 1,
              textShadow: "0 2px 8px rgba(0, 0, 0, 0.55)",
            }}
          >
            囍
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            top: "42px",
            left: 0,
            right: 0,
            zIndex: 2,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily:
                "'Great Vibes', 'Dancing Script', 'Cormorant Garamond', serif",
              fontSize: "70px",
              fontWeight: 400,
              lineHeight: 1,
              color: "#ffd6e4",
              letterSpacing: "0px",
              textShadow: strongInvitationShadow,
            }}
          >
            Sean + Lexi = Sexi
          </div>
        </div>
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "72px 112px 52px",
          }}
        >
          <div
            style={{
              display: "flex",
              position: "relative",
              flexDirection: "column",
              alignItems: "center",
              width: `${invitationBoxWidth}px`,
              gap: "4px",
              marginBottom: 0,
            }}
          >
            {nameLayout.lines.map((line, index) => (
              <div
                key={line}
                style={{
                  display: "flex",
                  fontFamily:
                    "'Libre Baskerville', 'Cormorant Garamond', serif",
                  fontSize: `${invitationNameFontSize}px`,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  color: "#ffd6e4",
                  whiteSpace: "nowrap",
                  textShadow: strongInvitationShadow,
                }}
              >
                {line}
                {index === nameLayout.lines.length - 1 ? "," : ""}
              </div>
            ))}
            <div
              style={{
                display: "flex",
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: `${invitationSubheadFontSize}px`,
                fontWeight: 600,
                lineHeight: 1.05,
                color: "#ffd6e4",
                whiteSpace: "nowrap",
                textShadow: softInvitationShadow,
              }}
            >
              you&apos;re invited!
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
        {
          name: "Great Vibes",
          data: greatVibesFont,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
