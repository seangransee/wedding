"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { autosaveRsvp, type RsvpActionState } from "./actions";
import type { MealType, RsvpAttendeeDetails, RsvpStatus } from "@/lib/db";
import {
  MAILING_ADDRESS_FIELDS,
  MAILING_ADDRESS_MAX_LENGTH,
  mailingAddressFormName,
  parsePastedMailingAddress,
  type MailingAddress,
} from "@/lib/mailing-address";

type RsvpFormProps = {
  slug: string;
  guestName: string;
  guestCount: number;
  fuckYes: boolean;
  initialStatus: RsvpStatus | "";
  initialAttendingCount: number | null;
  initialAttendeeDetails: RsvpAttendeeDetails[];
  initialMailingAddress: MailingAddress;
};

type RsvpOption = {
  id: string;
  value: RsvpStatus;
  label: string;
};

const RSVP_OPTIONS: RsvpOption[] = [
  { id: "yes", value: "yes", label: "Yes" },
  { id: "no", value: "no", label: "No" },
  { id: "deciding", value: "deciding", label: "Still deciding" },
];

const FUCK_YES_RSVP_OPTIONS: RsvpOption[] = [
  { id: "yes", value: "yes", label: "Yes" },
  { id: "fuck-yes", value: "yes", label: "Fuck yes" },
];

const MEAL_OPTIONS: Array<{ value: MealType; category: string; label: string; description: string; dietaryNote?: string }> = [
  {
    value: "beef",
    category: "Beef",
    label: "Center Cut Fillet",
    description: "Red wine caramelized onions, asparagus, truffle mashed potatoes, bourbon sauce.",
  },
  {
    value: "fish",
    category: "Fish",
    label: "Locally Sourced Whitefish",
    description: "Farro, charred Brussels sprouts, lemon caper coulis.",
  },
  {
    value: "vegetarian",
    category: "Vegetarian",
    label: "Truffle Mushroom Gnocchi",
    description: "Spinach, mushrooms, roasted tomatoes, parmesan, truffle mushroom cream sauce.",
    dietaryNote: "Can be made vegan; just add a dietary note below.",
  },
];

const INPUT_CLASS_NAME = "min-h-12 w-full min-w-0 rounded-md border border-[#ffd6e4]/55 bg-[#031b12]/55 px-3 font-normal text-[#ffd6e4] outline-none transition placeholder:text-[#ffd6e4]/45 focus:border-[#ffd6e4] focus:ring-2 focus:ring-[#ffd6e4]/25";

const LABEL_CLASS_NAME = "text-base font-semibold leading-snug text-[#ffd6e4] sm:text-lg";

const CHOICE_CLASS_NAME = "rounded-md border font-semibold leading-tight transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd6e4]";

function choiceStateClassName(selected: boolean) {
  return selected
    ? "border-[#ffd6e4] bg-[#ffd6e4] text-[#052018] shadow-[0_6px_18px_-10px_rgba(255,214,228,0.8)]"
    : "border-[#ffd6e4]/45 bg-[#fff6fa]/6 text-[#ffd6e4] hover:border-[#ffd6e4] hover:bg-[#fff6fa]/10";
}

const LINK_BUTTON_CLASS_NAME = "min-h-11 w-fit text-left text-base font-semibold text-[#ffd6e4] underline decoration-[#ffd6e4]/55 underline-offset-4 transition hover:decoration-[#ffd6e4] sm:text-lg";

function StepBadge({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold leading-snug ${
        done
          ? "border-[#ffd6e4] bg-[#ffd6e4] text-[#052018]"
          : "border-dashed border-[#ffd6e4]/70 text-[#ffd6e4]"
      }`}
    >
      {done ? <span aria-hidden="true">✓</span> : null}
      {children}
    </span>
  );
}

function missingLabel(missingName: boolean, missingMeal: boolean) {
  if (missingName && missingMeal) {
    return "Needs name & meal";
  }
  return missingName ? "Needs name" : "Needs meal";
}

// Typed changes save on their own after this pause, on blur, or with Save.
const AUTOSAVE_DELAY_MS = 1500;
// Keep "Saving..." on screen long enough to register before it flips to saved.
const MIN_SAVING_DISPLAY_MS = 450;

type SaveTone = "idle" | "pending" | "saving" | "saved" | "error";

function SaveStatusIcon({ tone }: { tone: SaveTone }) {
  if (tone === "saving") {
    return (
      <span
        aria-hidden="true"
        className="size-8 shrink-0 animate-spin rounded-full border-[3px] border-[#ffd6e4]/25 border-t-[#ffd6e4] sm:size-9"
      />
    );
  }

  if (tone === "saved") {
    return (
      <span
        aria-hidden="true"
        className="rsvp-save-pop grid size-8 shrink-0 place-items-center rounded-full bg-[#ffd6e4] text-[#052018] shadow-[0_0_0_4px_rgba(255,214,228,0.18)] sm:size-9"
      >
        <svg viewBox="0 0 20 20" fill="none" className="size-[1.1rem]">
          <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (tone === "error") {
    return (
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-[#ff9fb8] text-lg font-bold leading-none text-[#ff9fb8] sm:size-9"
      >
        !
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`grid size-8 shrink-0 place-items-center rounded-full border-2 border-dashed sm:size-9 ${
        tone === "pending" ? "border-[#ffd6e4]/85" : "border-[#ffd6e4]/45"
      }`}
    >
      {tone === "pending" ? <span className="size-2.5 animate-pulse rounded-full bg-[#ffd6e4]" /> : null}
    </span>
  );
}

type ErrorLocation = "status" | "count" | "names" | "global" | null;

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-md border border-[#ffd6e4]/55 bg-[#fff6fa]/10 px-4 py-3 text-lg font-semibold leading-relaxed text-[#ffd6e4] shadow-[inset_3px_0_0_#ffd6e4] sm:text-xl"
      role="alert"
    >
      {children}
    </div>
  );
}

function errorLocation(message: string, ok: boolean): ErrorLocation {
  if (ok || !message) {
    return null;
  }

  if (message === "Choose an RSVP option.") {
    return "status";
  }

  if (message.startsWith("Choose a count")) {
    return "count";
  }

  if (message === "Enter the full name for each place card.") {
    return "names";
  }

  return "global";
}

export function RsvpForm({
  slug,
  guestName,
  guestCount,
  fuckYes,
  initialStatus,
  initialAttendingCount,
  initialAttendeeDetails,
  initialMailingAddress,
}: RsvpFormProps) {
  const visibleInitialStatus = fuckYes && initialStatus !== "yes" ? "" : initialStatus;
  const rsvpOptions = fuckYes ? FUCK_YES_RSVP_OPTIONS : RSVP_OPTIONS;
  const initialState: RsvpActionState = useMemo(
    () => ({
      ok: false,
      message: "",
      values: {
        status: visibleInitialStatus,
        attendingCount: initialAttendingCount,
        attendeeDetails: initialAttendeeDetails,
        mailingAddress: initialMailingAddress,
      },
    }),
    [initialAttendeeDetails, initialAttendingCount, initialMailingAddress, visibleInitialStatus],
  );
  const [saveState, setSaveState] = useState<RsvpActionState>(initialState);
  const [status, setStatus] = useState<RsvpStatus | "">(visibleInitialStatus);
  const [selectedOptionId, setSelectedOptionId] = useState<string>(visibleInitialStatus);
  const [attendingCount, setAttendingCount] = useState<number | null>(
    initialAttendingCount,
  );
  const [attendeeDetails, setAttendeeDetails] =
    useState<RsvpAttendeeDetails[]>(initialAttendeeDetails);
  const [mailingAddress, setMailingAddress] = useState<MailingAddress>(initialMailingAddress);
  const [showCountry, setShowCountry] = useState(Boolean(initialMailingAddress.country));
  const [addressPasted, setAddressPasted] = useState(false);
  const [localError, setLocalError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [openDietaryNotes, setOpenDietaryNotes] = useState<ReadonlySet<number>>(() => new Set());
  const formRef = useRef<HTMLFormElement>(null);
  const saveSequence = useRef(0);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveCount, setSaveCount] = useState(0);
  // Every typed edit bumps editVersion; a save covers every edit up to the version it captured.
  const editVersion = useRef(0);
  const requestedVersion = useRef(0);
  const autosaveTimer = useRef<number | null>(null);
  const latestFlushEdits = useRef<() => void>(() => {});
  const effectiveAttendingCount = status === "yes" && guestCount === 1
    ? 1
    : attendingCount;

  const visibleAttendeeDetails = useMemo(() => {
    const count = effectiveAttendingCount ?? 0;
    return Array.from(
      { length: count },
      (_, index) => attendeeDetails[index] ?? {
        fullName: "",
        mealType: null,
        dietaryNotes: "",
      },
    );
  }, [attendeeDetails, effectiveAttendingCount]);
  const displayedError = localError || (!saveState.ok ? saveState.message : "");
  const currentErrorLocation = errorLocation(displayedError, false);

  function currentAttendeeDetails() {
    const names = Array.from(
      formRef.current?.querySelectorAll<HTMLInputElement>('input[name="attendeeNames"]') ?? [],
      (input) => input.value,
    );
    const mealTypes = Array.from(
      formRef.current?.querySelectorAll<HTMLInputElement>('input[name="attendeeMealTypes"]') ?? [],
      (input) => input.value,
    );
    const dietaryNotes = Array.from(
      formRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[name="attendeeDietaryNotes"]') ?? [],
      (field) => field.value,
    );
    const count = Math.max(names.length, mealTypes.length, dietaryNotes.length);

    return Array.from({ length: count }, (_, index) => ({
      fullName: names[index] ?? "",
      mealType: mealTypes[index] === "beef" || mealTypes[index] === "fish" || mealTypes[index] === "vegetarian"
        ? mealTypes[index]
        : null,
      dietaryNotes: dietaryNotes[index] ?? "",
    }));
  }

  async function saveDraft(
    nextValues?: {
      status?: RsvpStatus | "";
      attendingCount?: number | null;
      attendeeDetails?: RsvpAttendeeDetails[];
      mailingAddress?: MailingAddress;
    },
    explicit = false,
  ) {
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }

    const nextStatus = nextValues?.status ?? status;
    const nextAttendingCount =
      nextStatus === "yes" && guestCount === 1
        ? 1
        : nextValues?.attendingCount ?? attendingCount;
    const nextMailingAddress = nextValues?.mailingAddress ?? mailingAddress;
    const detailsFromInputs = currentAttendeeDetails();
    const nextDetails = nextValues?.attendeeDetails ?? (
      detailsFromInputs.length > 0 ? detailsFromInputs : attendeeDetails
    );

    if (!nextStatus) {
      setLocalError("Choose an RSVP option.");
      return;
    }

    if (nextStatus === "yes") {
      if (!nextAttendingCount || nextAttendingCount < 1 || nextAttendingCount > guestCount) {
        // The "How many attending?" question is enough guidance; don't surface an error.
        return;
      }
    }

    setLocalError("");
    const version = editVersion.current;
    requestedVersion.current = version;
    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("status", nextStatus);
    formData.set("attendingCount", nextStatus === "yes" ? String(nextAttendingCount) : "");
    MAILING_ADDRESS_FIELDS.forEach((field) => {
      formData.set(mailingAddressFormName(field), nextMailingAddress[field]);
    });

    if (nextStatus === "yes" && nextAttendingCount) {
      Array.from(
        { length: nextAttendingCount },
        (_, index) => nextDetails[index] ?? {
          fullName: "",
          mealType: null,
          dietaryNotes: "",
        },
      ).forEach((attendee) => {
        formData.append("attendeeNames", attendee.fullName);
        formData.append("attendeeMealTypes", attendee.mealType ?? "");
        formData.append("attendeeDietaryNotes", attendee.dietaryNotes);
      });
    }

    const sequence = saveSequence.current + 1;
    saveSequence.current = sequence;
    setIsSaving(true);
    const startedAt = Date.now();

    let result: RsvpActionState;
    try {
      result = await autosaveRsvp(formData);
    } catch {
      result = {
        ...saveState,
        ok: false,
        message: "We couldn't reach the server. Check your connection and tap Save to try again.",
      };
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_SAVING_DISPLAY_MS) {
      await new Promise((resolve) => window.setTimeout(resolve, MIN_SAVING_DISPLAY_MS - elapsed));
    }

    if (!result.ok) {
      // Let a later blur, pause, or Save retry the failed edits.
      requestedVersion.current = -1;
    } else if (editVersion.current === version) {
      setHasUnsavedEdits(false);
    }

    if (saveSequence.current === sequence) {
      setSaveState(result);
      setLocalError(result.ok ? "" : result.message);
      setIsSaving(false);
      if (result.ok) {
        setLastSavedAt(new Date());
        setSaveCount((count) => count + 1);
        if (explicit) {
          setJustSaved(true);
        }
      }
    }
  }

  function noteEdit() {
    setLocalError("");
    setJustSaved(false);
    editVersion.current += 1;
    setHasUnsavedEdits(true);
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null;
      latestFlushEdits.current();
    }, AUTOSAVE_DELAY_MS);
  }

  function flushEdits() {
    if (editVersion.current !== requestedVersion.current) {
      void saveDraft();
    }
  }

  useEffect(() => {
    latestFlushEdits.current = flushEdits;
  });

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        latestFlushEdits.current();
      }
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (editVersion.current !== requestedVersion.current) {
        latestFlushEdits.current();
        event.preventDefault();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (autosaveTimer.current !== null) {
        window.clearTimeout(autosaveTimer.current);
      }
    };
  }, []);

  function updateMailingAddress(field: keyof MailingAddress, value: string) {
    noteEdit();
    setAddressPasted(false);
    setMailingAddress((current) => ({ ...current, [field]: value }));
  }

  const completedAttendees = visibleAttendeeDetails.filter(
    (attendee) => attendee.fullName.trim() !== "" && attendee.mealType !== null,
  ).length;

  function openDietaryNote(index: number) {
    setOpenDietaryNotes((current) => new Set(current).add(index));
    window.requestAnimationFrame(() => {
      document.getElementById(`attendee-dietary-notes-${index}`)?.focus();
    });
  }

  const savedTime = lastSavedAt?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const saveIndicator: { tone: SaveTone; title: string; detail: string } = isSaving
    ? { tone: "saving", title: "Saving…", detail: "Hang tight, just a second." }
    : displayedError && currentErrorLocation !== "status"
      ? { tone: "error", title: "Not saved", detail: displayedError }
      : status === ""
        ? { tone: "idle", title: "No RSVP yet", detail: "Choose an option above to reply." }
        : status === "yes" && !effectiveAttendingCount
          ? { tone: "pending", title: "Not saved yet", detail: "Choose how many are attending." }
          : hasUnsavedEdits
            ? { tone: "pending", title: "Not saved yet", detail: "Saves automatically when you pause." }
            : justSaved
              ? { tone: "saved", title: "Saved!", detail: "Your RSVP is recorded." }
              : savedTime
                ? { tone: "saved", title: "All changes saved", detail: `Last saved at ${savedTime}` }
                : { tone: "saved", title: "All changes saved", detail: "Your RSVP is on file." };
  const saveButtonIsPrimary = saveIndicator.tone === "pending" || saveIndicator.tone === "error";

  return (
    <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="grid gap-5 sm:gap-6 [&_input]:scroll-mb-32 [&_textarea]:scroll-mb-32">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="attendingCount" value={effectiveAttendingCount ?? ""} />

      <div className="grid min-w-0 gap-1.5">
        <h2 className="break-words text-[1.75rem] font-semibold leading-[1.1] text-[#ffd6e4] sm:text-4xl">
          {guestName}, you&apos;re invited!
        </h2>
        <p className="text-base leading-snug text-[#ffd6e4]/85 sm:text-lg">
          {guestCount > 1 ? <>For up to {guestCount} guests · </> : null}
          Please reply by <strong className="font-semibold text-[#ffd6e4]">November 14</strong>
        </p>
      </div>

      <div role="group" aria-labelledby="rsvp-status-label" className="grid gap-2.5">
        <p id="rsvp-status-label" className="text-lg font-semibold leading-snug text-[#ffd6e4] sm:text-xl">
          Will you be attending?
        </p>
        <div className={`grid gap-2 ${rsvpOptions.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {rsvpOptions.map((option) => {
            const selected = selectedOptionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  const nextCount = option.value === "yes" && guestCount === 1
                    ? 1
                    : option.value === "yes"
                      ? attendingCount
                      : null;
                  const nextNames = option.value === "yes" && nextCount
                    ? Array.from(
                        { length: nextCount },
                        (_, attendeeIndex) => attendeeDetails[attendeeIndex] ?? {
                          fullName: "",
                          mealType: null,
                          dietaryNotes: "",
                        },
                      )
                    : [];

                  setLocalError("");
                  setJustSaved(false);
                  setSelectedOptionId(option.id);
                  setStatus(option.value);
                  setAttendingCount(nextCount);
                  setAttendeeDetails(nextNames);
                  void saveDraft({
                    status: option.value,
                    attendingCount: nextCount,
                    attendeeDetails: nextNames,
                  });
                }}
                aria-pressed={selected}
                className={`${CHOICE_CLASS_NAME} ${choiceStateClassName(selected)} min-h-12 px-1.5 text-base sm:min-h-14 sm:text-lg`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {!fuckYes && status === "" ? (
          <p className="text-base leading-snug text-[#ffd6e4]/80 sm:text-lg">
            Not sure yet? Pick &ldquo;Still deciding&rdquo; so we know you saw this.
          </p>
        ) : null}
        {currentErrorLocation === "status" ? (
          <ErrorNote>{displayedError}</ErrorNote>
        ) : null}
      </div>

      {status === "yes" && guestCount > 1 ? (
        <div role="group" aria-labelledby="rsvp-count-label" className="grid gap-2.5">
          <p id="rsvp-count-label" className="text-lg font-semibold leading-snug text-[#ffd6e4] sm:text-xl">
            How many attending?
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: guestCount }, (_, index) => index + 1).map((count) => {
              const selected = attendingCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => {
                    const nextNames = Array.from(
                      { length: count },
                      (_, attendeeIndex) => attendeeDetails[attendeeIndex] ?? {
                        fullName: "",
                        mealType: null,
                        dietaryNotes: "",
                      },
                    );

                    setLocalError("");
                    setJustSaved(false);
                    setAttendingCount(count);
                    setAttendeeDetails(nextNames);
                    void saveDraft({
                      status: "yes",
                      attendingCount: count,
                      attendeeDetails: nextNames,
                    });
                  }}
                  aria-pressed={selected}
                  aria-label={`${count} attending`}
                  className={`${CHOICE_CLASS_NAME} ${choiceStateClassName(selected)} size-12 text-lg sm:size-14 sm:text-xl`}
                >
                  {count}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {status === "yes" && visibleAttendeeDetails.length > 0 ? (
        <div className="grid gap-3">
          {visibleAttendeeDetails.length > 1 ? (
            <div className="grid gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-lg font-semibold leading-snug text-[#ffd6e4] sm:text-xl">
                  Place cards &amp; meals
                </p>
                <p className="shrink-0 text-sm font-semibold uppercase tracking-[0.12em] text-[#ffd6e4]/85">
                  {completedAttendees} of {visibleAttendeeDetails.length} done
                </p>
              </div>
              <div
                aria-hidden="true"
                className="h-1.5 overflow-hidden rounded-full bg-[#ffd6e4]/18"
              >
                <div
                  className="h-full rounded-full bg-[#ffd6e4] transition-[width] duration-300"
                  style={{ width: `${(completedAttendees / visibleAttendeeDetails.length) * 100}%` }}
                />
              </div>
            </div>
          ) : null}
          {currentErrorLocation === "names" ? (
            <ErrorNote>{displayedError}</ErrorNote>
          ) : null}
          {visibleAttendeeDetails.map((attendee, index) => {
            const missingName = attendee.fullName.trim() === "";
            const missingMeal = attendee.mealType === null;
            const showDietaryNotes = attendee.dietaryNotes !== "" || openDietaryNotes.has(index);

            return (
              <div
                key={index}
                className={`grid gap-3.5 rounded-md border p-3.5 text-[#ffd6e4] sm:p-5 ${
                  missingName || missingMeal
                    ? "border-[#ffd6e4]/55 bg-[#fff6fa]/8"
                    : "border-[#ffd6e4]/30 bg-[#fff6fa]/5"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#ffd6e4]/90">
                    {visibleAttendeeDetails.length === 1 ? "Place card & meal" : `Guest ${index + 1}`}
                  </p>
                  <StepBadge done={!missingName && !missingMeal}>
                    {missingName || missingMeal ? missingLabel(missingName, missingMeal) : "All set"}
                  </StepBadge>
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor={`attendee-name-${index}`} className={LABEL_CLASS_NAME}>
                    Name for place card
                  </label>
                  <input
                    id={`attendee-name-${index}`}
                    name="attendeeNames"
                    value={attendee.fullName}
                    onBlur={flushEdits}
                    onChange={(event) => {
                      noteEdit();
                      const next = [...visibleAttendeeDetails];
                      next[index] = {
                        ...next[index],
                        fullName: event.target.value,
                      };
                      setAttendeeDetails(next);
                    }}
                    autoComplete={index === 0 ? "name" : "off"}
                    placeholder="Full name, exactly as printed"
                    className={INPUT_CLASS_NAME}
                  />
                </div>

                <div
                  role="radiogroup"
                  aria-labelledby={`attendee-meal-label-${index}`}
                  className="grid gap-1.5"
                >
                  <p id={`attendee-meal-label-${index}`} className={LABEL_CLASS_NAME}>
                    Meal
                  </p>
                  <input
                    type="hidden"
                    name="attendeeMealTypes"
                    value={attendee.mealType ?? ""}
                  />
                  <div className="grid gap-2">
                    {MEAL_OPTIONS.map((option) => {
                      const selected = attendee.mealType === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-labelledby={`attendee-${index}-meal-${option.value}-name`}
                          aria-describedby={`attendee-${index}-meal-${option.value}-description`}
                          onClick={() => {
                            const next = [...visibleAttendeeDetails];
                            next[index] = {
                              ...next[index],
                              mealType: selected ? null : option.value,
                            };

                            setLocalError("");
                            setJustSaved(false);
                            setAttendeeDetails(next);
                            void saveDraft({
                              status: "yes",
                              attendingCount: effectiveAttendingCount,
                              attendeeDetails: next,
                            });
                          }}
                          className={`grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-md border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd6e4] sm:px-4 sm:py-3 ${
                            selected
                              ? "border-[#ffd6e4] bg-[#fff6fa]/16"
                              : "border-[#ffd6e4]/35 bg-[#031b12]/35 hover:border-[#ffd6e4]/75 hover:bg-[#fff6fa]/8"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-1 grid size-5 place-items-center rounded-full border ${
                              selected
                                ? "border-[#ffd6e4] bg-[#ffd6e4]"
                                : "border-[#ffd6e4]/60 bg-[#fff6fa]/8"
                            }`}
                          >
                            {selected ? (
                              <span className="size-2.5 rounded-full bg-[#031b12]" />
                            ) : null}
                          </span>
                          <span className="grid gap-0.5">
                            <span
                              id={`attendee-${index}-meal-${option.value}-name`}
                              className="flex flex-wrap items-baseline gap-x-2 leading-snug"
                            >
                              <span className="text-lg font-semibold sm:text-xl">{option.label}</span>
                              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#ffd6e4]/75">
                                {option.category}
                              </span>
                            </span>
                            <span
                              id={`attendee-${index}-meal-${option.value}-description`}
                              className="text-base leading-snug text-[#ffd6e4]/85 sm:text-lg"
                            >
                              {option.description}
                              {option.dietaryNote ? (
                                <span className="mt-0.5 block italic text-[#ffd6e4]">
                                  {option.dietaryNote}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {showDietaryNotes ? (
                  <div className="grid gap-1.5">
                    <label htmlFor={`attendee-dietary-notes-${index}`} className={LABEL_CLASS_NAME}>
                      Dietary restrictions or allergies
                    </label>
                    <textarea
                      id={`attendee-dietary-notes-${index}`}
                      name="attendeeDietaryNotes"
                      value={attendee.dietaryNotes}
                      rows={2}
                      onBlur={flushEdits}
                      onChange={(event) => {
                        noteEdit();
                        const next = [...visibleAttendeeDetails];
                        next[index] = {
                          ...next[index],
                          dietaryNotes: event.target.value,
                        };
                        setAttendeeDetails(next);
                      }}
                      className={`${INPUT_CLASS_NAME} min-h-20 resize-y py-2`}
                    />
                  </div>
                ) : (
                  <>
                    <input type="hidden" name="attendeeDietaryNotes" value="" />
                    <button
                      type="button"
                      onClick={() => openDietaryNote(index)}
                      className={`${LINK_BUTTON_CLASS_NAME} -mt-1`}
                    >
                      + Add dietary restrictions or allergies
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {status === "yes" ? (
        <div
          role="group"
          aria-labelledby="mailing-address-heading"
          onBlur={(event) => {
            // Save once focus leaves the address block (or after a typing pause), not on every field hop.
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
              return;
            }
            flushEdits();
          }}
          className="grid gap-3 rounded-md border border-[#ffd6e4]/30 bg-[#fff6fa]/5 p-3.5 text-[#ffd6e4] sm:p-5"
        >
          <div className="grid gap-0.5">
            <p id="mailing-address-heading" className="text-lg font-semibold leading-snug sm:text-xl">
              Mailing address{" "}
              <span className="text-base font-normal text-[#ffd6e4]/75 sm:text-lg">(optional)</span>
            </p>
            <p className="text-base leading-snug text-[#ffd6e4]/85 sm:text-lg">
              Where can we send you mail?
            </p>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="mailing-address-line1" className={LABEL_CLASS_NAME}>
              Street address
            </label>
            <input
              id="mailing-address-line1"
              name={mailingAddressFormName("line1")}
              value={mailingAddress.line1}
              maxLength={MAILING_ADDRESS_MAX_LENGTH}
              onPaste={(event) => {
                const parsed = parsePastedMailingAddress(event.clipboardData.getData("text"));
                if (!parsed) {
                  return;
                }

                event.preventDefault();
                noteEdit();
                setMailingAddress(parsed);
                setAddressPasted(true);
                if (parsed.country) {
                  setShowCountry(true);
                }
                void saveDraft({ mailingAddress: parsed });
              }}
              onChange={(event) => updateMailingAddress("line1", event.target.value)}
              autoComplete="shipping address-line1"
              enterKeyHint="next"
              placeholder="123 Main St"
              className={INPUT_CLASS_NAME}
            />
            {addressPasted ? (
              <p className="text-base leading-snug text-[#ffd6e4] sm:text-lg" role="status">
                ✨ We filled in your address below. Give it a quick look!
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="mailing-address-line2" className={LABEL_CLASS_NAME}>
              Apt, suite, or unit{" "}
              <span className="font-normal text-[#ffd6e4]/75">(optional)</span>
            </label>
            <input
              id="mailing-address-line2"
              name={mailingAddressFormName("line2")}
              value={mailingAddress.line2}
              maxLength={MAILING_ADDRESS_MAX_LENGTH}
              onChange={(event) => updateMailingAddress("line2", event.target.value)}
              autoComplete="shipping address-line2"
              enterKeyHint="next"
              className={INPUT_CLASS_NAME}
            />
          </div>

          <div
            className={`grid gap-2 ${
              showCountry
                ? "grid-cols-2"
                : "grid-cols-[minmax(0,1fr)_4.25rem_6rem] sm:grid-cols-[minmax(0,1fr)_6rem_8rem]"
            }`}
          >
            <div className={`grid min-w-0 gap-1.5 ${showCountry ? "col-span-2" : ""}`}>
              <label htmlFor="mailing-address-city" className={LABEL_CLASS_NAME}>
                City
              </label>
              <input
                id="mailing-address-city"
                name={mailingAddressFormName("city")}
                value={mailingAddress.city}
                maxLength={MAILING_ADDRESS_MAX_LENGTH}
                onChange={(event) => updateMailingAddress("city", event.target.value)}
                autoComplete="shipping address-level2"
                enterKeyHint="next"
                className={INPUT_CLASS_NAME}
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <label htmlFor="mailing-address-region" className={LABEL_CLASS_NAME}>
                {showCountry ? "State / Province" : "State"}
              </label>
              <input
                id="mailing-address-region"
                name={mailingAddressFormName("region")}
                value={mailingAddress.region}
                maxLength={MAILING_ADDRESS_MAX_LENGTH}
                onChange={(event) => updateMailingAddress("region", event.target.value)}
                autoComplete="shipping address-level1"
                autoCapitalize={showCountry ? "words" : "characters"}
                enterKeyHint="next"
                className={INPUT_CLASS_NAME}
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <label htmlFor="mailing-address-postal-code" className={LABEL_CLASS_NAME}>
                {showCountry ? "Postal code" : "ZIP"}
              </label>
              <input
                id="mailing-address-postal-code"
                name={mailingAddressFormName("postalCode")}
                value={mailingAddress.postalCode}
                maxLength={MAILING_ADDRESS_MAX_LENGTH}
                onChange={(event) => updateMailingAddress("postalCode", event.target.value)}
                autoComplete="shipping postal-code"
                inputMode={showCountry ? "text" : "numeric"}
                autoCapitalize="characters"
                enterKeyHint={showCountry ? "next" : "done"}
                className={INPUT_CLASS_NAME}
              />
            </div>
          </div>

          {showCountry ? (
            <div className="grid gap-1.5">
              <label htmlFor="mailing-address-country" className={LABEL_CLASS_NAME}>
                Country
              </label>
              <input
                id="mailing-address-country"
                name={mailingAddressFormName("country")}
                value={mailingAddress.country}
                maxLength={MAILING_ADDRESS_MAX_LENGTH}
                onChange={(event) => updateMailingAddress("country", event.target.value)}
                autoComplete="shipping country-name"
                enterKeyHint="done"
                className={INPUT_CLASS_NAME}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowCountry(true);
                window.requestAnimationFrame(() => {
                  document.getElementById("mailing-address-country")?.focus();
                });
              }}
              className={`${LINK_BUTTON_CLASS_NAME} -mt-1`}
            >
              Outside the US? Add a country
            </button>
          )}
        </div>
      ) : null}

      <div
        className={`${status ? "sticky bottom-0" : ""} z-20 -mx-5 -mb-5 rounded-b-[calc(0.5rem-1px)] border-t border-[#ffd6e4]/40 bg-[#031b12]/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-18px_36px_-24px_rgba(0,0,0,0.95)] backdrop-blur-md sm:-mx-8 sm:-mb-8 sm:px-8 sm:py-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))] lg:-mx-10 lg:-mb-10 lg:px-10`}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 sm:gap-5">
          <div
            role="status"
            aria-live="polite"
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <SaveStatusIcon
              key={saveIndicator.tone === "saved" ? `saved-${saveCount}` : saveIndicator.tone}
              tone={saveIndicator.tone}
            />
            <div className="min-w-0">
              <p
                className={`text-lg font-semibold leading-tight sm:text-xl ${
                  saveIndicator.tone === "error" ? "text-[#ff9fb8]" : "text-[#ffd6e4]"
                }`}
              >
                {saveIndicator.title}
              </p>
              <p className="text-sm leading-snug text-[#ffd6e4]/80 sm:text-base">
                {saveIndicator.detail}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              void saveDraft(undefined, true);
            }}
            className={`min-h-12 shrink-0 rounded-md border px-6 text-lg font-semibold tracking-normal transition disabled:cursor-not-allowed disabled:border-[#565b62] disabled:bg-[#3a3f45] disabled:text-[#9ba1a9] disabled:shadow-none sm:min-h-14 sm:px-10 sm:text-xl ${
              saveButtonIsPrimary
                ? "border-[#ffd6e4] bg-[#ffd6e4] text-[#052018] shadow-[0_8px_22px_-12px_rgba(255,214,228,0.9)] hover:bg-[#ffe6ef]"
                : "border-[#ffd6e4]/65 bg-[#fff6fa]/8 text-[#ffd6e4] hover:border-[#ffd6e4] hover:bg-[#fff6fa]/14"
            }`}
          >
            Save
          </button>
        </div>
      </div>
    </form>
  );
}
