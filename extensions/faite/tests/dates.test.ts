import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, humanDate, isCivilDate, todayIn } from "../src/lib/dates.ts";

/**
 * These exist because of EI-309: `addDays("")` produced an Invalid Date and
 * `toISOString()` threw a RangeError from inside a render, taking down any
 * view holding a to-do with a date. The bug was reachable the moment a list
 * had rows, and nothing caught it because none of this was tested.
 *
 * The rule these encode: a date helper must never throw. Every one of them
 * takes a string from the network or from a not-yet-loaded hook, so "the
 * caller will always pass something valid" is not an assumption any of them
 * gets to make.
 */

describe("isCivilDate", () => {
  it("accepts a real civil date", () => {
    assert.equal(isCivilDate("2026-09-08"), true);
    assert.equal(isCivilDate("2028-02-29"), true, "2028 is a leap year");
  });

  /**
   * `Date.UTC` rolls over silently, so these all LOOK like dates and would
   * produce confidently wrong ones — "2026-13-45" becomes 2027-02-15.
   */
  it("rejects dates that match the pattern but do not exist", () => {
    for (const value of ["2026-13-45", "2026-02-30", "2026-00-10", "2027-02-29"]) {
      assert.equal(isCivilDate(value), false, `expected ${value} to be rejected`);
    }
  });

  it("rejects everything that is not one", () => {
    for (const value of ["", "nope", "2026-9-8", "2026-09-08T00:00:00Z", null, undefined]) {
      assert.equal(isCivilDate(value as string), false, `expected ${JSON.stringify(value)} to be rejected`);
    }
  });
});

describe("addDays", () => {
  it("moves forward and backward", () => {
    assert.equal(addDays("2026-09-08", 1), "2026-09-09");
    assert.equal(addDays("2026-09-08", -1), "2026-09-07");
    assert.equal(addDays("2026-09-08", 0), "2026-09-08");
  });

  it("crosses month and year boundaries", () => {
    assert.equal(addDays("2026-09-30", 1), "2026-10-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  });

  it("handles a leap day", () => {
    assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  });

  /** THE REGRESSION. This threw RangeError before EI-309. */
  it("returns null for an empty string instead of throwing", () => {
    assert.equal(addDays("", 1), null);
  });

  it("returns null for anything malformed instead of throwing", () => {
    for (const value of ["nope", "2026-13-45", "2026-9-8", "----"]) {
      assert.doesNotThrow(() => addDays(value, 1));
      assert.equal(addDays(value, 1), null, `expected ${value} to be rejected`);
    }
  });
});

describe("humanDate", () => {
  const today = "2026-09-08";

  it("names the days around today", () => {
    assert.equal(humanDate("2026-09-08", today), "Today");
    assert.equal(humanDate("2026-09-09", today), "Tomorrow");
    assert.equal(humanDate("2026-09-07", today), "Yesterday");
  });

  it("formats a further-off date", () => {
    assert.match(humanDate("2026-11-20", today), /Nov/);
  });

  it("includes the year only when it differs from today's", () => {
    assert.doesNotMatch(humanDate("2026-11-20", today), /2026/);
    assert.match(humanDate("2027-11-20", today), /2027/);
  });

  /** Degrades to the raw string — still readable, and never worth taking a
   * view down for. */
  it("does not throw on a malformed date", () => {
    assert.doesNotThrow(() => humanDate("nope", today));
    assert.equal(humanDate("nope", today), "nope");
  });

  /** The exact shape of EI-309: `today` itself was the empty string. */
  it("does not throw when TODAY is malformed", () => {
    assert.doesNotThrow(() => humanDate("2026-09-08", ""));
    assert.doesNotThrow(() => humanDate("", ""));
  });
});

describe("todayIn", () => {
  const noon = new Date("2026-09-08T17:00:00.000Z");

  it("returns the civil date in the given zone", () => {
    assert.equal(todayIn("UTC", noon), "2026-09-08");
    assert.equal(todayIn("America/New_York", noon), "2026-09-08");
  });

  /** 17:00 UTC is already the 9th in Auckland — the entire reason the account's
   * timezone is used instead of the machine's. */
  it("can differ by a day across zones", () => {
    assert.equal(todayIn("Pacific/Auckland", noon), "2026-09-09");
  });

  it("falls back instead of throwing on an unknown zone", () => {
    assert.doesNotThrow(() => todayIn("Not/AZone", noon));
    assert.match(todayIn("Not/AZone", noon), /^\d{4}-\d{2}-\d{2}$/);
  });
});
