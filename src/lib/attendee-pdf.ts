import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import {
  ATTENDEE_EXPORT_HEADERS,
  attendeeExportValues,
  type ConfirmedAttendee,
} from "./attendee-export";

const WIDTHS = [111, 58, 141, 54, 110, 66];
const TABLE_WIDTH = WIDTHS.reduce((sum, width) => sum + width, 0);
const MARGIN = 36;
const LINE_HEIGHT = 13;
const PAD = 5;
const GREEN = "#183e32";

/** Wrap without trimming, normalizing or abbreviating the source text. */
export function wrapPdfText(
  text: string, width: number, measure: (text: string) => number,
) {
  return text.split(/\r\n|\r|\n/).flatMap((paragraph) => {
    const lines: string[] = [];
    let line = "";
    for (const character of paragraph) {
      if (line && measure(line + character) > width) {
        const breakAt = line.search(/\s\S*$/);
        if (breakAt >= 0 && breakAt < line.length - 1) {
          lines.push(line.slice(0, breakAt + 1));
          line = line.slice(breakAt + 1);
        } else {
          lines.push(line);
          line = "";
        }
      }
      line += character;
    }
    lines.push(line);
    return lines;
  });
}

export async function makeAttendeePdf(
  rows: readonly ConfirmedAttendee[], generatedAt = new Date(),
): Promise<Buffer> {
  const [regular, bold, check] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/attendee-export/NotoSans-Regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/attendee-export/NotoSans-Bold.ttf")),
    readFile(path.join(process.cwd(), "public/attendee-export/friday-check.png")),
  ]);
  const doc = new PDFDocument({
    size: "LETTER", layout: "portrait", margin: MARGIN,
    font: path.join(process.cwd(), "public/fonts/attendee-export/NotoSans-Regular.ttf"),
    bufferPages: true,
    info: { Title: "Confirmed attendees - Sean + Lexi", Author: "Sean + Lexi" },
  });
  doc.registerFont("body", regular).registerFont("bold", bold);
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const date = generatedAt.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric",
  });
  const bottom = doc.page.height - MARGIN - 20;
  let y = 0;

  function header() {
    doc.font("bold").fontSize(22).fillColor(GREEN)
      .text("Confirmed attendees", MARGIN, 30, { lineBreak: false });
    doc.font("body").fontSize(9).fillColor("#58685f")
      .text(`Sean + Lexi  |  ${rows.length} confirmed attendees  |  ${date}`, MARGIN, 62,
        { lineBreak: false });
    y = 87;
    let x = MARGIN;
    doc.rect(x, y, TABLE_WIDTH, 36).fill(GREEN);
    doc.font("bold").fontSize(9).fillColor("#ffffff");
    ATTENDEE_EXPORT_HEADERS.forEach((title, i) => {
      const lines = wrapPdfText(title, WIDTHS[i] - 2 * PAD, (s) => doc.widthOfString(s));
      lines.forEach((line, j) => doc.text(line, x + PAD, y + 5 + j * 12, { lineBreak: false }));
      x += WIDTHS[i];
    });
    y += 36;
  }
  header();
  rows.forEach((row, index) => {
    doc.font("body").fontSize(9.5);
    const lines = attendeeExportValues(row).map((value, i) => i === 5 ? [""] :
      wrapPdfText(value, WIDTHS[i] - 2 * PAD, (s) => doc.widthOfString(s)));
    const totalLines = Math.max(...lines.map((cell) => cell.length));
    const rowHeight = totalLines * LINE_HEIGHT + 2 * PAD;
    if (y + rowHeight > bottom && rowHeight <= bottom - 123) {
      doc.addPage();
      header();
    }
    let offset = 0;
    while (offset < totalLines) {
      const fit = Math.floor((bottom - y - 2 * PAD) / LINE_HEIGHT);
      if (fit < 1) {
        doc.addPage();
        header();
        continue;
      }
      const count = Math.min(fit, totalLines - offset);
      const height = count * LINE_HEIGHT + 2 * PAD;
      doc.rect(MARGIN, y, TABLE_WIDTH, height).fill(index % 2 ? "#f0f5f1" : "#ffffff");
      doc.font("body").fontSize(9.5).fillColor("#1e3028");
      let x = MARGIN;
      lines.forEach((cell, i) => {
        cell.slice(offset, offset + count).forEach((line, j) => {
          doc.text(line, x + PAD, y + PAD + j * LINE_HEIGHT, { lineBreak: false });
        });
        if (i === 5 && row.invitedFriday && offset === 0) {
          doc.image(check, x + (WIDTHS[i] - 13) / 2, y + PAD, { width: 13, height: 13 });
        }
        x += WIDTHS[i];
      });
      doc.moveTo(MARGIN, y + height).lineTo(MARGIN + TABLE_WIDTH, y + height)
        .lineWidth(0.4).strokeColor("#d9e3dc").stroke();
      y += height;
      offset += count;
    }
  });
  if (rows.length === 0) {
    doc.font("body").fontSize(11).fillColor(GREEN)
      .text("No confirmed attendees yet.", MARGIN + PAD, y + 20);
  }
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    doc.font("body").fontSize(8).fillColor("#58685f")
      .text(`Page ${i + 1} of ${pages.count}`, MARGIN, doc.page.height - MARGIN - 12,
        { width: TABLE_WIDTH, align: "right", lineBreak: false });
  }
  doc.end();
  return result;
}
