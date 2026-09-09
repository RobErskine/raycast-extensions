import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { labelIdList } from "../src/lib/labels.ts";

describe("labelIdList", () => {
  it("splits a comma list", () => {
    assert.deepEqual(labelIdList("a,b,c"), ["a", "b", "c"]);
  });

  it("tolerates the spacing a model will actually produce", () => {
    assert.deepEqual(labelIdList("a, b ,c"), ["a", "b", "c"]);
    assert.deepEqual(labelIdList("a,,b"), ["a", "b"]);
    assert.deepEqual(labelIdList("a,b,"), ["a", "b"]);
    assert.deepEqual(labelIdList(",a"), ["a"]);
  });

  it("takes a single id", () => {
    assert.deepEqual(labelIdList("only-one"), ["only-one"]);
  });

  /**
   * `undefined`, not `[]`. On a PATCH an empty array CLEARS every label,
   * so "the model said nothing about labels" and "the model wants no labels"
   * must not collapse into the same request.
   */
  it("returns undefined for nothing, so a patch does not clear existing labels", () => {
    assert.equal(labelIdList(undefined), undefined);
    assert.equal(labelIdList(""), undefined);
    assert.equal(labelIdList("   "), undefined);
    assert.equal(labelIdList(",,,"), undefined);
  });
});
