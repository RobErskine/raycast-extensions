import { isConflict } from "../api/problem";

/**
 * Runs a versioned write. When the record changed after it was read (409), reads it again and
 * writes once more with the fresh record. A second conflict is reported to the caller.
 */
export async function withVersionRetry<R extends { version: number }, T>(
  current: R,
  read: () => Promise<R>,
  write: (record: R) => Promise<T>,
): Promise<T> {
  try {
    return await write(current);
  } catch (error) {
    if (!isConflict(error)) throw error;
    return write(await read());
  }
}
