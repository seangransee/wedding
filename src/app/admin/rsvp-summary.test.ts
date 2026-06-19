import assert from "node:assert/strict";
import test from "node:test";
import { calculateRsvpSummaryCounts } from "./rsvp-summary.ts";

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
  });
});
