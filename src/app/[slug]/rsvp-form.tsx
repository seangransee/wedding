"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { submitRsvp, type RsvpActionState } from "./actions";
import type { RsvpStatus } from "@/lib/db";

type RsvpFormProps = {
  slug: string;
  guestName: string;
  guestCount: number;
  initialStatus: RsvpStatus | "";
  initialAttendingCount: number | null;
  initialAttendeeNames: string[];
};

const RSVP_OPTIONS: Array<{ value: RsvpStatus; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "deciding", label: "Still deciding" },
];

type ErrorLocation = "status" | "count" | "names" | "global" | null;

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-13 w-full rounded-md border border-[#b8860b]/65 bg-[#054f2d] px-6 text-sm font-semibold uppercase tracking-[0.18em] text-[#fff6fa] transition hover:bg-[#0d6b40] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:tracking-[0.2em]"
    >
      {pending ? "Saving..." : "Save RSVP"}
    </button>
  );
}

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
  initialStatus,
  initialAttendingCount,
  initialAttendeeNames,
}: RsvpFormProps) {
  const initialState: RsvpActionState = useMemo(
    () => ({
      ok: false,
      message: "",
      values: {
        status: initialStatus,
        attendingCount: initialAttendingCount,
        attendeeNames: initialAttendeeNames,
      },
    }),
    [initialAttendeeNames, initialAttendingCount, initialStatus],
  );
  const [state, formAction] = useActionState(submitRsvp, initialState);
  const [status, setStatus] = useState<RsvpStatus | "">(initialStatus);
  const [attendingCount, setAttendingCount] = useState<number | null>(
    initialAttendingCount,
  );
  const [attendeeNames, setAttendeeNames] =
    useState<string[]>(initialAttendeeNames);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [localError, setLocalError] = useState("");
  const effectiveAttendingCount = status === "yes" && guestCount === 1
    ? 1
    : attendingCount;

  useEffect(() => {
    if (state.values.status) {
      setStatus(state.values.status);
      setAttendingCount(state.values.attendingCount);
      setAttendeeNames(state.values.attendeeNames);
    }

    if (state.ok) {
      setLocalError("");
      setShowSuccessModal(true);
    }
  }, [state]);

  const visibleNames = useMemo(() => {
    const count = effectiveAttendingCount ?? 0;
    return Array.from(
      { length: count },
      (_, index) => attendeeNames[index] ?? "",
    );
  }, [attendeeNames, effectiveAttendingCount]);
  const displayedError = localError || (!state.ok ? state.message : "");
  const currentErrorLocation = errorLocation(displayedError, false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!status) {
      event.preventDefault();
      setLocalError("Choose an RSVP option.");
      return;
    }

    if (status === "yes") {
      if (!effectiveAttendingCount || effectiveAttendingCount < 1 || effectiveAttendingCount > guestCount) {
        event.preventDefault();
        setLocalError(`Choose a count from 1 to ${guestCount}.`);
        return;
      }

      const submittedNames = visibleNames.map((name) => name.trim());

      if (submittedNames.length !== effectiveAttendingCount || submittedNames.some((name) => !name)) {
        event.preventDefault();
        setLocalError("Enter the full name for each place card.");
        return;
      }
    }

    setLocalError("");
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="grid gap-5 sm:gap-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="attendingCount" value={effectiveAttendingCount ?? ""} />

      <div className="min-w-0">
        <h2 className="break-words text-3xl font-semibold leading-tight text-[#054f2d] sm:text-4xl">
          {guestName}, You&apos;re invited!
        </h2>
      </div>

      <div className="grid gap-3">
        <p className="text-base font-semibold text-[#4a1f2e]">
          Will you be attending?
        </p>
        <p className="text-sm leading-relaxed text-[#4a1f2e]/72">
          If you&apos;re not sure, select &quot;Still deciding&quot; so we know
          you saw this. Please RSVP with a final answer by{" "}
          <strong className="font-semibold text-[#4a1f2e]">November 1st</strong>.
        </p>
        <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
          {RSVP_OPTIONS.map((option) => {
            const selected = status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setLocalError("");
                  setStatus(option.value);
                  if (option.value === "yes" && guestCount === 1) {
                    setAttendingCount(1);
                    setAttendeeNames((current) => [current[0] ?? ""]);
                  }
                  if (option.value !== "yes") {
                    setAttendingCount(null);
                    setAttendeeNames([]);
                  }
                }}
                aria-pressed={selected}
                className={`min-h-13 rounded-md border px-4 text-sm font-semibold uppercase tracking-[0.14em] transition sm:tracking-[0.16em] ${
                  selected
                    ? "border-[#054f2d] bg-[#054f2d] text-[#fff6fa]"
                    : "border-[#b8860b]/35 bg-white/78 text-[#054f2d] hover:border-[#054f2d]"
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
                          setLocalError("");
                          setAttendingCount(count);
                          setAttendeeNames((current) =>
                            Array.from(
                              { length: count },
                              (_, nameIndex) => current[nameIndex] ?? "",
                            ),
                          );
                        }}
                        aria-pressed={selected}
                        className={`min-h-12 rounded-md border text-base font-semibold transition sm:aspect-square ${
                          selected
                            ? "border-[#054f2d] bg-[#054f2d] text-[#fff6fa]"
                            : "border-[#b8860b]/35 bg-white/78 text-[#054f2d] hover:border-[#054f2d]"
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
                Enter each full name exactly as it should appear on the place
                card.
              </p>
              {currentErrorLocation === "names" ? (
                <ErrorNote>{displayedError}</ErrorNote>
              ) : null}
              {visibleNames.map((name, index) => (
                <label
                  key={index}
                  className="grid gap-2 text-sm font-semibold text-[#054f2d]"
                >
                  Full name {index + 1}
                  <input
                    name="attendeeNames"
                    value={name}
                    onChange={(event) => {
                      setLocalError("");
                      const next = [...visibleNames];
                      next[index] = event.target.value;
                      setAttendeeNames(next);
                    }}
                    autoComplete="name"
                    className="min-h-12 rounded-md border border-[#b8860b]/35 bg-white px-3 text-base font-normal text-[#4a1f2e] outline-none transition focus:border-[#054f2d] focus:ring-2 focus:ring-[#054f2d]/20"
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="sticky bottom-0 -mx-4 -mb-4 grid gap-3 border-t border-[#b8860b]/20 bg-[#fff6fa]/96 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:m-0 sm:flex sm:border-t-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none sm:flex-row sm:items-center sm:justify-between">
        <SubmitButton />
        {currentErrorLocation === "global" ? (
          <p
            className="text-center text-sm font-semibold text-[#8f2448] sm:text-left"
            role="status"
          >
            {displayedError}
          </p>
        ) : null}
      </div>

      {showSuccessModal ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#2e1822]/50 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rsvp-success-title"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-lg border border-[#d9a441] bg-[#fff8fb] p-6 text-center shadow-[0_30px_90px_-35px_rgba(79,33,50,0.9)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-[linear-gradient(90deg,#054f2d,#d9a441,#be185d,#054f2d)]" />
            <div className="mx-auto mb-5 grid size-16 place-items-center rounded-full border border-[#d9a441]/60 bg-[#fff1d8] text-sm font-semibold uppercase tracking-[0.14em] text-[#8f2448]">
              <span aria-hidden="true">Saved</span>
            </div>
            <h3
              id="rsvp-success-title"
              className="text-3xl font-semibold leading-tight text-[#054f2d]"
            >
              The RSVP is in!
            </h3>
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="mt-6 min-h-12 w-full rounded-md border border-[#b8860b]/65 bg-[#054f2d] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#fff6fa] transition hover:bg-[#0d6b40] sm:w-auto"
            >
              Back to invitation
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
