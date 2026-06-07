"use client";

import {
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { autosaveRsvp, type RsvpActionState } from "./actions";
import type { MealType, RsvpAttendeeDetails, RsvpStatus } from "@/lib/db";

type RsvpFormProps = {
  slug: string;
  guestName: string;
  guestCount: number;
  fuckYes: boolean;
  initialStatus: RsvpStatus | "";
  initialAttendingCount: number | null;
  initialAttendeeDetails: RsvpAttendeeDetails[];
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

const MEAL_OPTIONS: Array<{ value: MealType; label: string }> = [
  { value: "beef", label: "Beef" },
  { value: "fish", label: "Fish" },
  { value: "vegetarian", label: "Vegetarian" },
];

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
      },
    }),
    [initialAttendeeDetails, initialAttendingCount, visibleInitialStatus],
  );
  const [saveState, setSaveState] = useState<RsvpActionState>(initialState);
  const [status, setStatus] = useState<RsvpStatus | "">(visibleInitialStatus);
  const [selectedOptionId, setSelectedOptionId] = useState<string>(visibleInitialStatus);
  const [attendingCount, setAttendingCount] = useState<number | null>(
    initialAttendingCount,
  );
  const [attendeeDetails, setAttendeeDetails] =
    useState<RsvpAttendeeDetails[]>(initialAttendeeDetails);
  const [localError, setLocalError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const saveSequence = useRef(0);
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
      formRef.current?.querySelectorAll<HTMLTextAreaElement>('textarea[name="attendeeDietaryNotes"]') ?? [],
      (textarea) => textarea.value,
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

  async function saveDraft(nextValues?: {
    status?: RsvpStatus | "";
    attendingCount?: number | null;
    attendeeDetails?: RsvpAttendeeDetails[];
  }) {
    const nextStatus = nextValues?.status ?? status;
    const nextAttendingCount =
      nextStatus === "yes" && guestCount === 1
        ? 1
        : nextValues?.attendingCount ?? attendingCount;
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

    const result = await autosaveRsvp(formData);

    if (saveSequence.current === sequence) {
      setSaveState(result);
      setLocalError(result.ok ? "" : result.message);
      setIsSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="grid gap-6 sm:gap-7">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="attendingCount" value={effectiveAttendingCount ?? ""} />

      <div className="min-w-0">
        <h2 className="break-words text-3xl font-semibold leading-tight text-[#ffd6e4] sm:text-5xl">
          {guestName}, you&apos;re invited!
        </h2>
      </div>

      <div className="grid gap-4">
        <p className="text-lg font-semibold leading-[1.65] text-[#ffd6e4] sm:text-xl">
          Will you be attending?
        </p>
        <p className="text-lg leading-[1.85] text-[#ffd6e4] sm:text-xl">
          {fuckYes ? (
            <>
              Please RSVP with a final answer by{" "}
              <strong className="font-semibold text-[#ffd6e4]">November 1st</strong>.
            </>
          ) : (
            <>
              If you&apos;re not sure, select &quot;still deciding&quot; so we know
              you saw this. Please RSVP with a final answer by{" "}
              <strong className="font-semibold text-[#ffd6e4]">November 1st</strong>.
            </>
          )}
        </p>
        <div className="grid gap-3">
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
                className={`min-h-14 rounded-md border px-4 text-base font-semibold tracking-normal transition sm:text-lg ${
                  selected
                    ? "border-[#ffd6e4] bg-[#fff6fa]/12 text-[#ffd6e4]"
                    : "border-[#ffd6e4]/45 bg-[#fff6fa]/6 text-[#ffd6e4] hover:border-[#ffd6e4] hover:text-[#ffd6e4]"
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
            <div className="grid gap-4">
              <p className="text-lg font-semibold leading-[1.65] text-[#ffd6e4] sm:text-xl">
                How many attending?
              </p>
              <div className="grid grid-cols-5 gap-2">
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
                            (_, attendeeIndex) => attendeeDetails[attendeeIndex] ?? {
                              fullName: "",
                              mealType: null,
                              dietaryNotes: "",
                            },
                          );

                          setLocalError("");
                          setAttendingCount(count);
                          setAttendeeDetails(nextNames);
                          void saveDraft({
                            status: "yes",
                            attendingCount: count,
                            attendeeDetails: nextNames,
                          });
                        }}
                        aria-pressed={selected}
                        className={`min-h-12 rounded-md border text-lg font-semibold transition sm:min-h-14 sm:text-xl ${
                          selected
                            ? "border-[#ffd6e4] bg-[#fff6fa]/12 text-[#ffd6e4]"
                            : "border-[#ffd6e4]/45 bg-[#fff6fa]/6 text-[#ffd6e4] hover:border-[#ffd6e4] hover:text-[#ffd6e4]"
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

          {visibleAttendeeDetails.length > 0 ? (
            <div className="grid gap-4">
              <p className="text-lg leading-[1.85] text-[#ffd6e4] sm:text-xl">
                {visibleAttendeeDetails.length === 1
                  ? "Enter your full name exactly as it should appear on the place card."
                  : "Enter each full name exactly as it should appear on the place card."}
              </p>
              <p className="text-lg leading-[1.85] text-[#ffd6e4] sm:text-xl">
                Please select your meal type and note below if you have any dietary restrictions or allergies we need to be aware of.
              </p>
              {currentErrorLocation === "names" ? (
                <ErrorNote>{displayedError}</ErrorNote>
              ) : null}
              {visibleAttendeeDetails.map((attendee, index) => (
                <div
                  key={index}
                  className="grid gap-4 rounded-md border border-[#ffd6e4]/40 bg-[#fff6fa]/8 p-4 text-lg font-semibold leading-[1.5] text-[#ffd6e4] sm:text-xl"
                >
                  <label htmlFor={`attendee-name-${index}`}>
                    {visibleAttendeeDetails.length === 1 ? "Full Name" : `Full Name ${index + 1}`}
                  </label>
                  <input
                    id={`attendee-name-${index}`}
                    name="attendeeNames"
                    value={attendee.fullName}
                    onBlur={() => {
                      void saveDraft({
                        status: "yes",
                        attendingCount: effectiveAttendingCount,
                      });
                    }}
                    onChange={(event) => {
                      setLocalError("");
                      const next = [...visibleAttendeeDetails];
                      next[index] = {
                        ...next[index],
                        fullName: event.target.value,
                      };
                      setAttendeeDetails(next);
                    }}
                    autoComplete="name"
                    className="min-h-12 min-w-0 rounded-md border border-[#ffd6e4]/55 bg-[#031b12]/55 px-3 text-lg font-normal text-[#ffd6e4] outline-none transition focus:border-[#ffd6e4] focus:ring-2 focus:ring-[#ffd6e4]/25 sm:min-h-14 sm:text-xl"
                  />
                  <fieldset
                    role="radiogroup"
                    aria-labelledby={`attendee-meal-label-${index}`}
                    className="grid gap-2"
                  >
                    <legend id={`attendee-meal-label-${index}`} className="text-lg font-semibold text-[#ffd6e4] sm:text-xl">
                      Meal Type
                    </legend>
                    <input
                      type="hidden"
                      name="attendeeMealTypes"
                      value={attendee.mealType ?? ""}
                    />
                    <div className="grid gap-3">
                      {MEAL_OPTIONS.map((option) => {
                        const selected = attendee.mealType === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => {
                              const next = [...visibleAttendeeDetails];
                              next[index] = {
                                ...next[index],
                                mealType: selected ? null : option.value,
                              };

                              setLocalError("");
                              setAttendeeDetails(next);
                              void saveDraft({
                                status: "yes",
                                attendingCount: effectiveAttendingCount,
                                attendeeDetails: next,
                              });
                            }}
                            className={`grid min-h-12 grid-cols-[auto_1fr] items-center gap-3 rounded-md border px-3 text-left text-lg font-semibold transition sm:min-h-14 sm:text-xl ${
                              selected
                                ? "border-[#ffd6e4] bg-[#fff6fa]/12 text-[#ffd6e4]"
                                : "border-[#ffd6e4]/40 bg-[#fff6fa]/6 text-[#ffd6e4] hover:border-[#ffd6e4] hover:text-[#ffd6e4]"
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`grid size-4 place-items-center rounded-[3px] border ${
                                selected
                                  ? "border-[#ffd6e4] bg-[#ffd6e4]"
                                  : "border-[#ffd6e4]/55 bg-[#fff6fa]/10"
                              }`}
                            >
                              {selected ? (
                                <span className="size-2 rounded-[2px] bg-[#031b12]" />
                              ) : null}
                            </span>
                            <span>{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <div className="grid gap-2">
                    <label htmlFor={`attendee-dietary-notes-${index}`}>
                      Dietary Restrictions/Allergies
                    </label>
                    <textarea
                      id={`attendee-dietary-notes-${index}`}
                      name="attendeeDietaryNotes"
                      value={attendee.dietaryNotes}
                      rows={3}
                      onBlur={() => {
                        void saveDraft({
                          status: "yes",
                          attendingCount: effectiveAttendingCount,
                        });
                      }}
                      onChange={(event) => {
                        setLocalError("");
                        const next = [...visibleAttendeeDetails];
                        next[index] = {
                          ...next[index],
                          dietaryNotes: event.target.value,
                        };
                        setAttendeeDetails(next);
                      }}
                      className="min-h-28 min-w-0 resize-y rounded-md border border-[#ffd6e4]/55 bg-[#031b12]/55 px-3 py-2 text-lg font-normal text-[#ffd6e4] outline-none transition focus:border-[#ffd6e4] focus:ring-2 focus:ring-[#ffd6e4]/25 sm:text-xl"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="-mx-5 -mb-5 grid gap-2 border-t border-[#ffd6e4]/35 bg-[#fff6fa]/6 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-lg font-semibold backdrop-blur-sm sm:-mx-8 sm:-mb-8 sm:px-8 sm:text-xl lg:-mx-10 lg:-mb-10 lg:px-10">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            void saveDraft();
          }}
          className="mx-auto min-h-12 w-full max-w-sm rounded-md border border-[#ffd6e4]/65 bg-[#fff6fa]/10 px-5 text-lg font-semibold tracking-normal text-[#ffd6e4] transition hover:border-[#ffd6e4] hover:bg-[#fff6fa]/14 hover:text-[#ffd6e4] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-14 sm:text-xl"
        >
          Save
        </button>
        <p className="text-[#ffd6e4]" role="status" aria-live="polite">
          {isSaving ? "Saving..." : ""}
        </p>
        {currentErrorLocation === "global" ? (
          <p className="text-[#ffd6e4]" role="alert">
            {displayedError}
          </p>
        ) : null}
      </div>
    </form>
  );
}
