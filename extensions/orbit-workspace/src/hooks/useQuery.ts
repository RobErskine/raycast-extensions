import { useCachedPromise } from "@raycast/utils";

interface QueryOptions<T> {
  execute?: boolean;
  keepPreviousData?: boolean;
  onError?: (error: Error) => void;
  initialData?: T;
}

/**
 * `useCachedPromise` stores its cache under a hash of its arguments (in a namespace made from the
 * function's source text), and every command of the extension shares that cache. All `useQuery`
 * calls share one function, so each query names itself in `key`
 * (for example `["projects", orbit.cacheScope]`): two queries never read each other's data.
 */
export function useQuery<T>(key: string[], load: (cacheKey: string) => Promise<T>, options: QueryOptions<T> = {}) {
  return useCachedPromise((cacheKey: string) => load(cacheKey), [key.join("\u0000")], options);
}
