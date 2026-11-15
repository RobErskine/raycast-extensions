import { useMemo } from "react";

import type { DocSummary } from "../api/types";
import { breadcrumb, docTitle } from "../lib/docs";
import { showError } from "../lib/errors";

import type { Orbit } from "./useOrbit";
import { useQuery } from "./useQuery";

export interface DocEntry {
  doc: DocSummary;
  title: string;
  path: string;
}

/** Every doc the token's person can see, newest first, with its title and parent path. */
export function useDocs(orbit: Orbit) {
  const { data, isLoading, revalidate } = useQuery(["docs", orbit.cacheScope], () => orbit.client.listDocs(), {
    keepPreviousData: true,
    onError: (error) => showError(error, "Could not load docs"),
  });
  const entries = useMemo(() => {
    const docs = data ?? [];
    const byId = new Map(docs.map((d) => [d.id, d]));
    const all = docs
      .map((doc): DocEntry => ({ doc, title: docTitle(doc), path: breadcrumb(doc, byId) }))
      .sort((a, b) => Date.parse(b.doc.updated_at) - Date.parse(a.doc.updated_at));
    return { all, privateDocs: all.filter((e) => e.doc.private), sharedDocs: all.filter((e) => !e.doc.private) };
  }, [data]);
  return { ...entries, isLoading, revalidate };
}
