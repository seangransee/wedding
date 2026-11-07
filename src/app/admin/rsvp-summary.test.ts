import assert from "node:assert/strict";
import test from "node:test";
import { calculateRsvpSummaryCounts, findIncompleteRsvps } from "./rsvp-summary.ts";

test("counts actual yes attendees and full maybe or no-response invitations", () => {
  const guests = [
    { guestCount: 2, rsvpStatus: "yes", attendingCount: 1 },
    { guestCount: 4, rsvpStatus: "yes", attendingCount: 3 },
    { guestCount: 2, rsvpStatus: "deciding", attendingCount: null },
    { guestCount: 5, rsvpStatus: null, attendingCount: null },
    { guestCount: 6, rsvpStatus: "no", attendingCount: null },
  ] as const;

  assert.deepEqual(calculateRsvpSummaryCounts(guests), {
    yesCount: 4,
    yesMaybeCount: 6,
    yesMaybeNoResponseCount: 11,
    friDinnerCount: 0,
  });
});

test("counts Friday dinner using attendees for yes and max for deciding/no-response", () => {
  const guests = [
    // yes + friDin -> counts attendingCount (2)
    { guestCount: 4, rsvpStatus: "yes", attendingCount: 2, friDin: true },
    // deciding + friDin -> counts guestCount (3)
    { guestCount: 3, rsvpStatus: "deciding", attendingCount: null, friDin: true },
    // no response + friDin -> counts guestCount (5)
    { guestCount: 5, rsvpStatus: null, attendingCount: null, friDin: true },
    // no + friDin -> contributes nothing
    { guestCount: 6, rsvpStatus: "no", attendingCount: null, friDin: true },
    // yes without friDin -> excluded from Friday dinner
    { guestCount: 2, rsvpStatus: "yes", attendingCount: 2, friDin: false },
  ] as const;

  assert.deepEqual(calculateRsvpSummaryCounts(guests), {
    yesCount: 4,
    yesMaybeCount: 7,
    yesMaybeNoResponseCount: 12,
    friDinnerCount: 10,
  });
});

test("finds guests awaiting a response and yes guests missing place cards or meals", () => {
  const guests = [
    { id: 1, rsvpStatus: null, attendingCount: null, attendeeDetails: [] },
    { id: 2, rsvpStatus: "deciding", attendingCount: null, attendeeDetails: [] },
    { id: 3, rsvpStatus: "no", attendingCount: null, attendeeDetails: [] },
    {
      id: 4,
      rsvpStatus: "yes",
      attendingCount: 2,
      attendeeDetails: [
        { fullName: "Ann", mealType: "fish" },
        { fullName: "Bo", mealType: "beef" },
      ],
    },
    {
      id: 5,
      rsvpStatus: "yes",
      attendingCount: 3,
      attendeeDetails: [
        { fullName: "Cy", mealType: null },
        { fullName: " ", mealType: "vegetarian" },
      ],
    },
  ] as const;

  const result = findIncompleteRsvps(guests);

  assert.deepEqual(result.awaitingResponse.map((guest) => guest.id), [1, 2]);
  assert.deepEqual(result.missingDetails.map(({ guest }) => guest.id), [5]);
  assert.deepEqual(result.missingDetails[0].attendees, [
    { position: 1, fullName: "Cy", missingName: false, missingMeal: true },
    { position: 2, fullName: "", missingName: true, missingMeal: false },
    { position: 3, fullName: "", missingName: true, missingMeal: true },
  ]);
});
