/**
 * The one CORS allowlist. Strings match exactly; anything with a wildcard
 * must be a RegExp — the cors package never expands "*" inside a string.
 */
export function allowedOrigins(env: {
  NODE_ENV?: string;
  APP_URL?: string;
}): Array<string | RegExp> {
  const list: Array<string | RegExp> = [
    "https://eventlink.one",
    "https://www.eventlink.one",
    /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/, // Railway deployments and previews
  ];
  if (env.APP_URL) list.push(env.APP_URL.replace(/\/+$/, ""));
  if (env.NODE_ENV !== "production") {
    list.push(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
  }
  return list;
}

export function isAllowedOrigin(origin: string, list: Array<string | RegExp>): boolean {
  return list.some((p) => (typeof p === "string" ? p === origin : p.test(origin)));
}
