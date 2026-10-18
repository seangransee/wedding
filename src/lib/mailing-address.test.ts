import assert from "node:assert/strict";
import test from "node:test";
import { formatMailingAddress, parsePastedMailingAddress } from "./mailing-address.ts";

test("splits a one-line US address", () => {
  assert.deepEqual(parsePastedMailingAddress("123 Main St, Chicago, IL 60601"), {
    line1: "123 Main St",
    line2: "",
    city: "Chicago",
    region: "IL",
    postalCode: "60601",
    country: "",
  });
});

test("splits a multi-line address with an apartment and US country", () => {
  assert.deepEqual(
    parsePastedMailingAddress("123 Main St\nApt 4B\nChicago, il 60601-1234\nUnited States"),
    {
      line1: "123 Main St",
      line2: "Apt 4B",
      city: "Chicago",
      region: "IL",
      postalCode: "60601-1234",
      country: "",
    },
  );
});

test("handles city and state without a comma between them", () => {
  assert.deepEqual(parsePastedMailingAddress("500 W Madison St Unit 2, Chicago IL 60661, USA"), {
    line1: "500 W Madison St Unit 2",
    line2: "",
    city: "Chicago",
    region: "IL",
    postalCode: "60661",
    country: "",
  });
});

test("keeps spelled-out states and non-US countries", () => {
  assert.deepEqual(parsePastedMailingAddress("1 Front St W, Toronto, Ontario M5J 2X5, Canada"), {
    line1: "1 Front St W",
    line2: "",
    city: "Toronto",
    region: "Ontario",
    postalCode: "M5J 2X5",
    country: "Canada",
  });
});

test("ignores text that is not a full address", () => {
  assert.equal(parsePastedMailingAddress("123 Main St"), null);
  assert.equal(parsePastedMailingAddress("123 Main St, Apt 4"), null);
  assert.equal(parsePastedMailingAddress("hello, world"), null);
});

test("formats an address on one line", () => {
  assert.equal(
    formatMailingAddress({
      line1: "123 Main St",
      line2: "Apt 4B",
      city: "Chicago",
      region: "IL",
      postalCode: "60601",
      country: "",
    }),
    "123 Main St, Apt 4B, Chicago, IL 60601",
  );
});
