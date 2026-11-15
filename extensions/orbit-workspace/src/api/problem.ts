/** An Orbit API failure. `status` is 0 when the request did not reach Orbit. */
export class OrbitError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly retryAfterSeconds?: number;
  readonly currentVersion?: number;

  constructor(init: {
    status: number;
    code: string;
    detail: string;
    retryAfterSeconds?: number;
    currentVersion?: number;
  }) {
    super(init.detail);
    this.name = "OrbitError";
    this.status = init.status;
    this.code = init.code;
    this.detail = init.detail;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.currentVersion = init.currentVersion;
  }
}

export function isOrbitError(error: unknown): error is OrbitError {
  return error instanceof OrbitError;
}

/** A version conflict: the task or doc changed after it was read. */
export function isConflict(error: unknown): boolean {
  return isOrbitError(error) && error.status === 409 && error.code === "conflict";
}

function retryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

/** Reads an RFC 9457 problem document, or makes one from the status for any other body. */
export async function parseProblem(response: Response): Promise<OrbitError> {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    // Not JSON: keep the defaults below.
  }
  const conflict = body.conflict as { current_version?: unknown } | undefined;
  const fallbackCode =
    response.status === 401 ? "unauthorized" : response.status === 429 ? "rate_limit_exceeded" : "http_error";
  return new OrbitError({
    status: response.status,
    code: typeof body.code === "string" ? body.code : fallbackCode,
    detail:
      typeof body.detail === "string" && body.detail
        ? body.detail
        : typeof body.title === "string" && body.title
          ? body.title
          : `Request failed with status ${response.status}.`,
    retryAfterSeconds: response.status === 429 ? retryAfter(response.headers.get("retry-after")) : undefined,
    currentVersion: typeof conflict?.current_version === "number" ? conflict.current_version : undefined,
  });
}
