"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export function AttendeeExportButtons() {
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);
  const [error, setError] = useState("");

  async function download(format: "csv" | "pdf") {
    setBusy(format);
    setError("");
    try {
      const response = await fetch(`/admin/attendees/export?format=${format}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401
        ? "Please sign in again to download attendees." : "Download failed. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
        ?? `sexi-wedding-confirmed-attendees.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Download failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        {(["pdf", "csv"] as const).map((format) => (
          <button key={format} type="button" disabled={busy !== null}
            onClick={() => download(format)}
            title={`Download confirmed attendees as ${format.toUpperCase()}`}
            className="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap border border-[#7a1239] bg-[#fff8fb] px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#7a1239] transition hover:bg-[#ffe0ec] disabled:cursor-wait disabled:opacity-60">
            <Download aria-hidden="true" className="size-3.5" />
            {busy === format ? "Downloading…" : `Attendees ${format.toUpperCase()}`}
          </button>
        ))}
      </div>
      <span role="status" className={error ? "text-xs text-red-800" : "sr-only"}>{error}</span>
    </div>
  );
}
