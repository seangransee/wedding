"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PHOTO_LOCATION_MAX_LENGTH, photoCountries } from "@/lib/photo-locations";
import type { AdminWeddingPhoto } from "@/lib/photos";
import { PhotoLocationCaption } from "../../photo-location-caption";
import { setPhotoLocation } from "./actions";

type LocationDraft = { countryCode: string; locationText: string };

function sameLocation(a: LocationDraft, b: LocationDraft) {
  return a.countryCode === b.countryCode && a.locationText === b.locationText;
}

export function PhotoLocationEditor({ photo }: { photo: AdminWeddingPhoto }) {
  const [draft, setDraft] = useState<LocationDraft>({
    countryCode: photo.countryCode,
    locationText: photo.locationText,
  });
  const [saved, setSaved] = useState(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const draftRef = useRef(draft);
  const savedRef = useRef(draft);
  const savingRef = useRef(false);
  const dirty = !sameLocation(draft, saved);

  const save = useCallback(async () => {
    if (savingRef.current || sameLocation(draftRef.current, savedRef.current)) return;
    savingRef.current = true;
    setSaving(true);
    setError("");

    try {
      // Each photo saves in order, picking up edits made while a request was in flight.
      while (!sameLocation(draftRef.current, savedRef.current)) {
        const next = draftRef.current;
        const result = await setPhotoLocation(photo.filename, next.countryCode, next.locationText);
        if (!result.ok) throw new Error(result.message);
        savedRef.current = next;
        setSaved(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [photo.filename]);

  useEffect(() => {
    if (sameLocation(draft, savedRef.current)) return;
    const timer = window.setTimeout(() => void save(), 1500);
    return () => window.clearTimeout(timer);
  }, [draft, save]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (savingRef.current || !sameLocation(draftRef.current, savedRef.current)) {
        event.preventDefault();
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") void save();
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [save]);

  function edit(next: LocationDraft) {
    draftRef.current = next;
    setDraft(next);
    setError("");
  }

  const fieldClass = "w-full min-w-0 rounded-sm border border-[#df7fa3] bg-white px-2 py-2 text-base text-[#4a1027] outline-none focus:border-[#be185d] focus:ring-1 focus:ring-[#be185d]";

  return (
    <form
      className="grid min-w-0 gap-2 border-t border-[#efb5c9] pt-2"
      aria-label={`Location for ${photo.alt}`}
      onSubmit={(event) => { event.preventDefault(); void save(); }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) void save();
      }}
    >
      <label className="grid min-w-0 gap-1 text-xs font-semibold text-[#7a1239]">
        Country / flag
        <select
          className={fieldClass}
          value={draft.countryCode}
          onChange={(event) => {
            edit({ ...draftRef.current, countryCode: event.target.value });
            void save();
          }}
        >
          <option value="">No country / flag</option>
          {photoCountries.map(({ code, flag, name }) => (
            <option key={code} value={code}>{flag} {name}</option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-xs font-semibold text-[#7a1239]">
        Where was this?
        <textarea
          className={`${fieldClass} resize-y font-normal`}
          rows={2}
          maxLength={PHOTO_LOCATION_MAX_LENGTH}
          placeholder="Thar Desert, India"
          value={draft.locationText}
          onChange={(event) => edit({ ...draftRef.current, locationText: event.target.value })}
        />
      </label>
      {draft.countryCode || draft.locationText ? (
        <div className="overflow-hidden rounded-sm border border-[#df7fa3]">
          <PhotoLocationCaption countryCode={draft.countryCode} locationText={draft.locationText} />
        </div>
      ) : null}
      <div className="flex min-h-7 items-center justify-between gap-1">
        <span className="text-xs leading-tight text-[#8f2448]" role="status" aria-live="polite">
          {error ? `Not saved: ${error}` : saving ? "Saving…" : dirty ? "Not saved yet" : "✓ All changes saved"}
        </span>
        {(dirty || error) ? (
          <button
            type="submit"
            className="shrink-0 rounded-sm border border-[#be185d] bg-[#fff1f7] px-2 py-1 text-xs font-semibold text-[#7a1239] disabled:opacity-50"
            disabled={saving}
          >
            {error ? "Retry" : "Save"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
