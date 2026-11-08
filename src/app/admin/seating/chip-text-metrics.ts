"use client";

import { useSyncExternalStore } from "react";

/**
 * Measures floor-plan chip text in em units (width at a 1px font) so tables
 * can shrink their font until every name fits. Uses a canvas with the chip's
 * real font once the page is hydrated and fonts have loaded; before that (and
 * on the server) it falls back to an average character width so the server
 * and first client render agree.
 */

const CHIP_CLASS = "seating-chip-plan";
const LETTER_SPACING_EM = -0.015;
const FALLBACK_CHAR_EM = 0.56;
const FALLBACK_BOLD_CHAR_EM = 0.62;

let version = 0;
let fontFamily: string | null = null;
let context: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();
const listeners = new Set<() => void>();

function handleFontsChanged() {
  version += 1;
  fontFamily = null;
  cache.clear();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const fonts = typeof document === "undefined" ? undefined : document.fonts;
  if (listeners.size === 1 && fonts) {
    fonts.addEventListener("loadingdone", handleFontsChanged);
    void fonts.ready.then(handleFontsChanged);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && fonts) {
      fonts.removeEventListener("loadingdone", handleFontsChanged);
    }
  };
}

/** 0 on the server and during hydration; bumps whenever web fonts finish loading. */
export function useChipTextVersion() {
  return useSyncExternalStore(
    subscribe,
    () => version + 1,
    () => 0,
  );
}

function chipFontFamily() {
  if (fontFamily === null) {
    const probe = document.createElement("span");
    probe.className = CHIP_CLASS;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    document.body.appendChild(probe);
    fontFamily = getComputedStyle(probe).fontFamily || "Georgia, serif";
    probe.remove();
  }

  return fontFamily;
}

/** Width of `text` in the chip font at 1px, including the chip's letter spacing. */
export function chipTextEm(text: string, textVersion: number, options: { bold?: boolean } = {}) {
  const bold = Boolean(options.bold);
  const fallback = text.length * (bold ? FALLBACK_BOLD_CHAR_EM : FALLBACK_CHAR_EM);
  if (textVersion === 0 || typeof document === "undefined") {
    return fallback;
  }

  const key = `${bold ? "b" : "r"}:${text}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  if (!context) {
    context = document.createElement("canvas").getContext("2d");
  }
  if (!context) {
    return fallback;
  }

  context.font = `${bold ? 700 : 400} 100px ${chipFontFamily()}`;
  const width = context.measureText(text).width / 100 + LETTER_SPACING_EM * text.length;
  cache.set(key, width);

  return width;
}
