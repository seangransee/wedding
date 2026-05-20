"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    if (state.values.status) {
      setStatus(state.values.status);
      setAttendingCount(state.values.attendingCount);
      setAttendeeNames(state.values.attendeeNames);
    }
  }, [state]);

  const visibleNames = useMemo(() => {
    const count = attendingCount ?? 0;
    return Array.from(
      { length: count },
      (_, index) => attendeeNames[index] ?? "",
    );
  }, [attendeeNames, attendingCount]);

  return (
    <form action={formAction} className="grid gap-5 sm:gap-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="attendingCount" value={attendingCount ?? ""} />

      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#054f2d]/70 sm:text-sm sm:tracking-[0.2em]">
          Invitation for
        </p>
        <h2 className="mt-1.5 break-words text-3xl font-semibold leading-tight text-[#054f2d] sm:mt-2 sm:text-4xl">
          {guestName}, You&apos;re invited!
        </h2>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#8f2448] sm:text-base">
          RSVP by November 1st
        </p>
      </div>

      <div className="grid gap-3">
        <p className="text-base font-semibold text-[#4a1f2e]">
          Will you be attending?
        </p>
        <p className="text-sm leading-relaxed text-[#4a1f2e]/72">
          If you&apos;re not sure, select &quot;Still deciding&quot; so we know
          you saw this. Please RSVP with a final answer by November 1st.
        </p>
        <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
          {RSVP_OPTIONS.map((option) => {
            const selected = status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setStatus(option.value);
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
      </div>

      {status === "yes" ? (
        <div className="grid gap-5">
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
          </div>

          {visibleNames.length > 0 ? (
            <div className="grid gap-3">
              <p className="text-sm text-[#4a1f2e]/70">
                Enter each full name exactly as it should appear on the place
                card.
              </p>
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
        {state.message ? (
          <p
            className={`text-center text-sm font-semibold sm:text-left ${state.ok ? "text-[#054f2d]" : "text-[#8f2448]"}`}
            role="status"
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
