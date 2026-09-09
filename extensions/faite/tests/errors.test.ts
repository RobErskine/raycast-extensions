import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { messageFor, normalizeHost } from "../src/lib/errors.ts";

describe("messageFor", () => {
  /**
   * Every error body `/api/v1` can return should map to something a person
   * can act on. A new server-side code landing here unmapped falls through to
   * the generic message — survivable, unhelpful.
   *
   * This list was checked against a live worker rather than read off the
   * source: each code below was provoked with a real request (bad key,
   * read-only key on a write, unknown id, empty body, deleting Backlog) and
   * the server returned exactly these strings.
   */
  it("maps every documented API error", () => {
    const codes = [
      "unauthenticated",
      "insufficient-scope",
      "invalid-request",
      "not-found",
      "backlog-not-deletable",
      "default-tab-not-deletable",
      "too-many-dependents",
    ];

    for (const code of codes) {
      const message = messageFor(400, code);
      assert.doesNotMatch(message, /unexpected error/, `${code} fell through to the generic message`);
      assert.ok(message.length > 20, `${code} should explain itself`);
    }
  });

  /** The most likely misconfiguration, so it must say what to DO, not just
   * that something went wrong. */
  it("tells a read-only key holder how to fix it", () => {
    assert.match(messageFor(403, "insufficient-scope"), /read-only/i);
    assert.match(messageFor(403, "insufficient-scope"), /Write/);
  });

  it("falls back to the status code for anything unrecognized", () => {
    assert.match(messageFor(502, undefined), /502/);
    assert.match(messageFor(500, "brand-new-code"), /500/);
  });
});

describe("normalizeHost", () => {
  it("uses the fallback when nothing is configured", () => {
    assert.equal(normalizeHost(undefined, "https://myfaite.app"), "https://myfaite.app");
    assert.equal(normalizeHost("", "https://myfaite.app"), "https://myfaite.app");
    assert.equal(normalizeHost("   ", "https://myfaite.app"), "https://myfaite.app");
  });

  /** `host/` + `/api/v1` is a double slash, which some proxies 404. */
  it("strips trailing slashes", () => {
    assert.equal(normalizeHost("http://localhost:8790/", "x"), "http://localhost:8790");
    assert.equal(normalizeHost("http://localhost:8790///", "x"), "http://localhost:8790");
  });

  it("trims surrounding whitespace from a pasted host", () => {
    assert.equal(normalizeHost("  http://localhost:8790  ", "x"), "http://localhost:8790");
  });
});
