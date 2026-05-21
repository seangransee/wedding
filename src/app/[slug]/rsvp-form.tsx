"use client";

import {
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { autosaveRsvp, type RsvpActionState } from "./actions";
import type { RsvpStatus } from "@/lib/db";

type RsvpFormProps = {
  slug: string;
  guestName: string;
  guestCount: number;
  fuckYes: boolean;
  initialStatus: RsvpStatus | "";
  initialAttendingCount: number | null;
  initialAttendeeNames: string[];
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

type ErrorLocation = "status" | "count" | "names" | "global" | null;

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-md border border-[#be185d]/45 bg-[#fff1f7] px-3 py-2 text-sm font-semibold leading-relaxed text-[#8f2448] shadow-[inset_3px_0_0_#be185d]"
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
  initialAttendeeNames,
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
        attendeeNames: initialAttendeeNames,
      },
    }),
    [initialAttendeeNames, initialAttendingCount, visibleInitialStatus],
  );
  const [saveState, setSaveState] = useState<RsvpActionState>(initialState);
  const [status, setStatus] = useState<RsvpStatus | "">(visibleInitialStatus);
  const [selectedOptionId, setSelectedOptionId] = useState<string>(visibleInitialStatus);
  const [attendingCount, setAttendingCount] = useState<number | null>(
    initialAttendingCount,
  );
  const [attendeeNames, setAttendeeNames] =
    useState<string[]>(initialAttendeeNames);
  const [localError, setLocalError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const saveSequence = useRef(0);
  const effectiveAttendingCount = status === "yes" && guestCount === 1
    ? 1
    : attendingCount;

  const visibleNames = useMemo(() => {
    const count = effectiveAttendingCount ?? 0;
    return Array.from(
      { length: count },
      (_, index) => attendeeNames[index] ?? "",
    );
  }, [attendeeNames, effectiveAttendingCount]);
  const displayedError = localError || (!saveState.ok ? saveState.message : "");
  const currentErrorLocation = errorLocation(displayedError, false);

  function currentAttendeeNames() {
    return Array.from(
      formRef.current?.querySelectorAll<HTMLInputElement>(
        'input[name="attendeeNames"]',
      ) ?? [],
      (input) => input.value,
    );
  }

  async function saveDraft(nextValues?: {
    status?: RsvpStatus | "";
    attendingCount?: number | null;
    attendeeNames?: string[];
  }) {
    const nextStatus = nextValues?.status ?? status;
    const nextAttendingCount =
      nextStatus === "yes" && guestCount === 1
        ? 1
        : nextValues?.attendingCount ?? attendingCount;
    const namesFromInputs = currentAttendeeNames();
    const nextNames = nextValues?.attendeeNames ?? (
      namesFromInputs.length > 0 ? namesFromInputs : attendeeNames
    );

    if (!nextStatus) {
      setLocalError("Choose an RSVP option.");
      return;
    }

    if (nextStatus === "yes") {
      if (!nextAttendingCount || nextAttendingCount < 1 || nextAttendingCount > guestCount) {
        setLocalError(`Choose a count from 1 to ${guestCount}.`);
        return;
      }
    }

    setLocalError("");
    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("status", nextStatus);
    formData.set("attendingCount", nextStatus === "yes" ? String(nextAttendingCount) : "");

    if (nextStatus === "yes" && nextAttendingCount) {
      Array.from(
        { length: nextAttendingCount },
        (_, index) => nextNames[index] ?? "",
      ).forEach((name) => formData.append("attendeeNames", name));
    }

    const sequence = saveSequence.current + 1;
    saveSequence.current = sequence;
    setIsSaving(true);

    const result = await autosaveRsvp(formData);

    if (saveSequence.current === sequence) {
      setSaveState(result);
      setLocalError(result.ok ? "" : result.message);
      setIsSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="grid gap-5 sm:gap-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="attendingCount" value={effectiveAttendingCount ?? ""} />

      <div className="min-w-0">
        <h2 className="break-words text-3xl font-semibold leading-tight text-[#054f2d] sm:text-4xl">
          {guestName}, you&apos;re invited!
        </h2>
      </div>

      <div className="grid gap-3">
        <p className="text-base font-semibold text-[#4a1f2e]">
          Will you be attending?
        </p>
        <p className="text-sm leading-relaxed text-[#4a1f2e]/72">
          {fuckYes ? (
            <>
              Please RSVP with a final answer by{" "}
              <strong className="font-semibold text-[#4a1f2e]">November 1st</strong>.
            </>
          ) : (
            <>
              If you&apos;re not sure, select &quot;still deciding&quot; so we know
              you saw this. Please RSVP with a final answer by{" "}
              <strong className="font-semibold text-[#4a1f2e]">November 1st</strong>.
            </>
          )}
        </p>
        <div className={`grid gap-2 sm:gap-3 ${fuckYes ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
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
                        (_, nameIndex) => attendeeNames[nameIndex] ?? "",
                      )
                    : [];

                  setLocalError("");
                  setSelectedOptionId(option.id);
                  setStatus(option.value);
                  setAttendingCount(nextCount);
                  setAttendeeNames(nextNames);
                  void saveDraft({
                    status: option.value,
                    attendingCount: nextCount,
                    attendeeNames: nextNames,
                  });
                }}
                aria-pressed={selected}
                className={`min-h-13 rounded-md border px-4 text-sm font-semibold uppercase tracking-[0.14em] transition sm:tracking-[0.16em] ${
                  selected
                    ? "border-[#054f2d] bg-[#054f2d] text-[#fff6fa]"
                    : "border-[#b8860b]/35 bg-white/54 text-[#054f2d] hover:border-[#054f2d]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {currentErrorLocation === "status" ? (
          <ErrorNote>{displayedError}</ErrorNote>
        ) : null}
      </div>

      {status === "yes" ? (
        <div className="grid gap-5">
          {guestCount > 1 ? (
            <div className="grid gap-3">
              <p className="text-base font-semibold text-[#4a1f2e]">
                How many attending?
              </p>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {Array.from({ length: guestCount }, (_, index) => index + 1).map(
                  (count) => {
                    const selected = attendingCount === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => {
                          const nextNames = Array.from(
                            { length: count },
                            (_, nameIndex) => attendeeNames[nameIndex] ?? "",
                          );

                          setLocalError("");
                          setAttendingCount(count);
                          setAttendeeNames(nextNames);
                          void saveDraft({
                            status: "yes",
                            attendingCount: count,
                            attendeeNames: nextNames,
                          });
                        }}
                        aria-pressed={selected}
                        className={`min-h-12 rounded-md border text-base font-semibold transition sm:aspect-square ${
                          selected
                            ? "border-[#054f2d] bg-[#054f2d] text-[#fff6fa]"
                            : "border-[#b8860b]/35 bg-white/54 text-[#054f2d] hover:border-[#054f2d]"
                        }`}
                        aria-label={`${count} attending`}
                      >
                        {count}
                      </button>
                    );
                  },
                )}
              </div>
              {currentErrorLocation === "count" ? (
                <ErrorNote>{displayedError}</ErrorNote>
              ) : null}
            </div>
          ) : null}

          {visibleNames.length > 0 ? (
            <div className="grid gap-3">
              <p className="text-sm text-[#4a1f2e]/70">
                {visibleNames.length === 1
                  ? "Enter your full name exactly as it should appear on the place card."
                  : "Enter each full name exactly as it should appear on the place card."}
              </p>
              {currentErrorLocation === "names" ? (
                <ErrorNote>{displayedError}</ErrorNote>
              ) : null}
              {visibleNames.map((name, index) => (
                <div
                  key={index}
                  className="grid gap-2 text-sm font-semibold text-[#054f2d]"
                >
                  <label htmlFor={`attendee-name-${index}`}>
                    {visibleNames.length === 1 ? "Full name" : `Full name ${index + 1}`}
                  </label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      id={`attendee-name-${index}`}
                      name="attendeeNames"
                      value={name}
                      onBlur={() => {
                        void saveDraft({
                          status: "yes",
                          attendingCount: effectiveAttendingCount,
                        });
                      }}
                      onChange={(event) => {
                        setLocalError("");
                        const next = [...visibleNames];
                        next[index] = event.target.value;
                        setAttendeeNames(next);
                      }}
                      autoComplete="name"
                      className="min-h-12 min-w-0 rounded-md border border-[#b8860b]/35 bg-white px-3 text-base font-normal text-[#4a1f2e] outline-none transition focus:border-[#054f2d] focus:ring-2 focus:ring-[#054f2d]/20"
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        void saveDraft({
                          status: "yes",
                          attendingCount: effectiveAttendingCount,
                        });
                      }}
                      className="min-h-12 rounded-md border border-[#b8860b]/55 bg-[#054f2d] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff6fa] transition hover:bg-[#0d6b40] disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="-mx-4 -mb-4 grid gap-2 border-t border-[#b8860b]/20 bg-[#fff6fa]/38 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center text-sm font-semibold backdrop-blur-sm sm:m-0 sm:border-t-0 sm:bg-transparent sm:p-0 sm:text-left sm:backdrop-blur-none">
        <p className="text-[#054f2d]/75" role="status" aria-live="polite">
          {isSaving ? "Saving..." : saveState.ok ? "Saved" : ""}
        </p>
        {currentErrorLocation === "global" ? (
          <p className="text-[#8f2448]" role="alert">
            {displayedError}
          </p>
        ) : null}
      </div>
    </form>
  );
}
