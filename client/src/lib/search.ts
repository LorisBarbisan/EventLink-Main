export interface Searchable {
  label: string;
  sublabel?: string;
  keywords?: (string | null | undefined)[];
}

/**
 * Case-insensitive substring match: every whitespace-separated term must appear
 * somewhere in the label, sublabel or keywords. Substring, not prefix, so "119"
 * finds "INV-0119".
 */
export function matchesSearch(item: Searchable, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [item.label, item.sublabel, ...(item.keywords ?? [])]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return terms.every((t) => haystack.includes(t));
}

/** Narrows the list without reordering it. */
export function filterOptions<T extends Searchable>(items: T[], query: string): T[] {
  return query.trim() ? items.filter((i) => matchesSearch(i, query)) : items;
}
