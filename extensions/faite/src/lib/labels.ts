/**
 * Label-id parsing, split out so it can be tested — `create-todo.ts` reaches
 * `@raycast/api` transitively and cannot be imported outside Raycast's
 * runtime. Same split as `dates.ts` and `errors.ts`.
 */

/**
 * Splits the comma-separated label list an AI tool receives.
 *
 * **This should be `string[]`.** `ray build` fails with "Cannot read
 * properties of undefined (reading 'flags')" for ANY array-typed field on a
 * tool `Input` in @raycast/api 1.104.25 — reproduced down to a two-field type
 * on a plain, unwrapped tool, so it is neither this extension's auth wrapper
 * nor its types. Other published extensions do ship array inputs, so this
 * looks like a toolchain regression rather than an unsupported feature.
 * Revisit on the next bump; a documented comma list costs the model clarity,
 * not capability.
 *
 * Returns `undefined` rather than an empty array for "nothing here", so a
 * caller can omit the field entirely instead of sending `labelIds: []` — which
 * on a PATCH would CLEAR every label rather than leave them alone.
 */
export function labelIdList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;

  const ids = value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return ids.length > 0 ? ids : undefined;
}
