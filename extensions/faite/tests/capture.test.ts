import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCaptureSource,
  CAPTURE_SOURCE_MAX_BYTES,
  serializeCaptureSource,
} from "../src/lib/capture.ts";

describe("buildCaptureSource", () => {
  it("a browser tab becomes a browser capture", () => {
    const source = buildCaptureSource({
      url: "https://amazon.com/dp/B123",
      pageTitle: "A Thing To Buy",
      appName: "Safari",
      bundleId: "com.apple.Safari",
    });

    assert.equal(source?.kind, "browser");
    assert.equal(source?.url, "https://amazon.com/dp/B123");
    assert.equal(source?.pageTitle, "A Thing To Buy");
    assert.deepEqual(source?.app, { name: "Safari", bundleId: "com.apple.Safari" });
    assert.equal(source?.v, 1);
  });

  /** No URL means it was not a browser — Faite's badge renders these
   * differently, so the kind has to be honest about which it was. */
  it("an app with no tab becomes an app capture", () => {
    const source = buildCaptureSource({ appName: "Slack" });

    assert.equal(source?.kind, "app");
    assert.equal(source?.url, undefined);
    assert.deepEqual(source?.app, { name: "Slack" });
  });

  /**
   * Not an empty capture. A blob carrying only a timestamp renders as
   * "Captured" in Faite, implying context that was never collected.
   */
  it("returns undefined when there is nothing worth recording", () => {
    assert.equal(buildCaptureSource({}), undefined);
    assert.equal(buildCaptureSource({ url: "", appName: "" }), undefined);
    assert.equal(buildCaptureSource({ url: "   ", appName: "  " }), undefined);
  });

  it("omits blank optional fields rather than storing empty strings", () => {
    const source = buildCaptureSource({ url: "https://x.test", pageTitle: "   " });

    assert.equal(source?.pageTitle, undefined);
    assert.equal(source?.app, undefined);
  });

  it("stamps the capture moment, not the caller's clock later", () => {
    const source = buildCaptureSource({ appName: "Slack", at: "2026-09-09T12:00:00.000Z" });
    assert.equal(source?.at, "2026-09-09T12:00:00.000Z");
  });

  /** Faite's own schema does not capture window titles, and neither should
   * this — "Re: layoffs — Mail" is not context anyone wants attached. */
  it("has no window-title field at all", () => {
    const source = buildCaptureSource({ appName: "Mail" });
    assert.equal("window" in (source ?? {}), false);
  });
});

describe("serializeCaptureSource", () => {
  it("round-trips a normal capture", () => {
    const source = buildCaptureSource({ url: "https://x.test", pageTitle: "Hi", appName: "Safari" });
    const json = serializeCaptureSource(source);

    assert.deepEqual(JSON.parse(json as string), source);
  });

  it("passes undefined through", () => {
    assert.equal(serializeCaptureSource(undefined), undefined);
  });

  /**
   * The server does NOT truncate on the /api/v1 path, so an oversized blob
   * is a rejected write rather than a trimmed one. A URL you can click beats
   * a title you can read, so the title goes first.
   */
  it("drops the page title before giving up, keeping the URL", () => {
    const json = serializeCaptureSource(
      buildCaptureSource({ url: "https://x.test/thing", pageTitle: "T".repeat(4000) }),
    );

    assert.ok(json);
    assert.ok(new TextEncoder().encode(json).length <= CAPTURE_SOURCE_MAX_BYTES);
    const parsed = JSON.parse(json);
    assert.equal(parsed.url, "https://x.test/thing");
    assert.equal(parsed.pageTitle, undefined);
  });

  /** If the URL alone blows the cap, send nothing rather than a write the
   * server will reject and lose the whole to-do with it. */
  it("gives up entirely when even the URL is too long", () => {
    const json = serializeCaptureSource(
      buildCaptureSource({ url: `https://x.test/${"a".repeat(4000)}` }),
    );

    assert.equal(json, undefined);
  });
});
