/**
 * The third help guard (epic §3).
 *
 * The other two guards (`help-key-check.mjs` and `help-coverage.test.ts`) only
 * check that the registry and the markup agree with each other. Neither asks
 * whether a piece of the product has any help at all, so a whole feature can
 * ship with zero markers and both stay green — which is exactly how the
 * direct-offer feature shipped help-less.
 *
 * This uses a signal the code already produces: a `title` attribute is one a
 * developer decided needs explaining. So in the dashboard, Books and profile
 * components, any element with a `title` must also carry a `data-help` key.
 *
 * It's a heuristic, not a proof — an element with neither attribute still slips
 * through — but it turns the common case (a developer who stopped at `title`)
 * from invisible into a failing build.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const COMPONENTS = join(__dirname, "..", "components");

// Files in scope. Kept explicit rather than globbed: the rule is deliberately
// scoped to the help-bearing surfaces, not the whole client.
const FILES = ["FreelancerDashboard.tsx", "BooksTab.tsx", "RecruiterDashboard.tsx"];

// Elements allowed to carry a `title` without a `data-help` key. Add a line
// only with a reason someone can act on; prefer adding help to removing the
// title. Format: `<file>::<title text>`.
const ALLOWED = new Set<string>([]);

/**
 * Returns each JSX opening tag in `text`. Walks from `<Tag` to the matching
 * top-level `>`, respecting quotes and `{}` depth so an attribute expression
 * containing `>` (e.g. `className={a > b ? …}`) doesn't end the tag early.
 */
function openingTags(text: string): string[] {
  const tags: string[] = [];
  const re = /<[A-Za-z][A-Za-z0-9.]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let depth = 0;
    let quote: string | null = null;
    let end = -1;
    for (let i = re.lastIndex; i < text.length; i++) {
      const c = text[i];
      if (quote) {
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) continue;
    tags.push(text.slice(m.index, end + 1));
    re.lastIndex = end + 1; // skip the tag interior
  }
  return tags;
}

function gaps(file: string): string[] {
  const text = readFileSync(join(COMPONENTS, file), "utf8");
  return openingTags(text)
    .filter((tag) => /\btitle=/.test(tag) && !/\bdata-help=/.test(tag))
    .map((tag) => {
      const t = tag.match(/\btitle=(?:"([^"]*)"|'([^']*)')/);
      return `${file}::${t?.[1] ?? t?.[2] ?? "(expression)"}`;
    })
    .filter((key) => !ALLOWED.has(key));
}

describe("help title coverage", () => {
  it.each(FILES)("every element with a title in %s also has a data-help key", (file) => {
    expect(gaps(file)).toEqual([]);
  });
});
