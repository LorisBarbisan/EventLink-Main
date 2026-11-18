import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

/**
 * A handler that reads req.user on a route with no auth middleware can never
 * see a user: req.user is only set by authenticateJWT / authenticateOptionalJWT.
 * Such a route looks guarded and is simply dead (or worse, treats every caller
 * as anonymous). This finds them mechanically.
 */
const ROUTES = __dirname;
const CONTROLLERS = join(__dirname, "../controllers");

const AUTH_HINT =
  /authenticate(Optional)?JWT|requireAdmin|requireRole|requireAuth|\bauth\b|\.\.\.\w+|resolveCompany|Guard/;
const USES_USER = /\breq(\s+as\s+\w+)?\)?\.user\b|\(req as any\)\.user/;

function controllerSource(): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of readdirSync(CONTROLLERS)) {
    if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
    const src = readFileSync(join(CONTROLLERS, f), "utf8");
    const parts = src.split(/\nexport (?:async )?(?:function|const) /);
    for (const p of parts.slice(1)) {
      const name = p.match(/^(\w+)/)?.[1];
      if (name) out.set(name, p);
    }
  }
  return out;
}

function unguardedUserRoutes(): string[] {
  const handlers = controllerSource();
  const bad: string[] = [];
  for (const f of readdirSync(ROUTES)) {
    if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
    const src = readFileSync(join(ROUTES, f), "utf8");
    // A router-wide auth middleware guards every route in the file
    if (/router\.use\([^)]*(auth|authenticate)/i.test(src)) continue;
    const re =
      /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*(["'`])([^"'`]+)\2\s*,([\s\S]*?)\);\s*\n/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const [, method, , path, args] = m;
      // app.use("/path", limiter) style guards declared elsewhere in the file
      const pathGuarded = new RegExp(
        `\\.use\\(\\s*["'\`]${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]\\s*,[^)]*(auth|authenticate)`,
        "i"
      ).test(src);
      if (AUTH_HINT.test(args) || pathGuarded) continue;
      const handlerName = args
        .trim()
        .split(/[\s,]+/)
        .pop()!
        .replace(/\W/g, "");
      const body = /=>|function/.test(args) ? args : (handlers.get(handlerName) ?? "");
      if (USES_USER.test(body)) bad.push(`${f}: ${method.toUpperCase()} ${path} → ${handlerName}`);
    }
  }
  return bad;
}

describe("route auth", () => {
  it("no handler reads req.user on a route without auth middleware", () => {
    expect(unguardedUserRoutes()).toEqual([]);
  });
});
