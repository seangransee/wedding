"use client";

import { useEffect } from "react";

/**
 * Opens a collapsed FAQ question when the URL hash (or a clicked in-page link)
 * points at it, e.g. the schedule's "Black Tie Optional" link to the dress code.
 */
export function FaqAnchorOpener() {
  useEffect(() => {
    function openQuestion(hash: string) {
      if (!hash.startsWith("#faq-")) return;
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!(target instanceof HTMLDetailsElement)) return;
      target.open = true;
      target.scrollIntoView({ block: "start" });
    }

    function handleClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest?.("a[href^='#faq-']");
      if (!link) return;
      const hash = link.getAttribute("href") ?? "";
      event.preventDefault();
      if (window.location.hash !== hash) history.pushState(null, "", hash);
      openQuestion(hash);
    }

    function handleHashChange() {
      openQuestion(window.location.hash);
    }

    openQuestion(window.location.hash);
    document.addEventListener("click", handleClick);
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return null;
}
