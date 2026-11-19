import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import ts from "typescript";

/**
 * Every icon-only <Button size="icon"> needs an accessible name (WCAG 4.1.2):
 * a screen reader otherwise announces just "button". eslint-plugin-jsx-a11y
 * can't see this — it assumes an icon component child might contain text —
 * so this parses the JSX (not a regex: attributes span lines and arrow
 * functions contain ">") and checks each one.
 */
const ROOT = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return p.endsWith(".tsx") && !p.endsWith(".test.tsx") ? [p] : [];
  });
}

function unlabelledIconButtons(): string[] {
  const out: string[] = [];
  for (const file of files(ROOT)) {
    const src = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        if (node.tagName.getText(src) === "Button") {
          const attrs = new Map<string, string>();
          for (const a of node.attributes.properties) {
            if (ts.isJsxAttribute(a))
              attrs.set(a.name.getText(src), a.initializer?.getText(src) ?? "");
            if (ts.isJsxSpreadAttribute(a)) attrs.set("...", "");
          }
          const isIcon = attrs.get("size") === '"icon"';
          const named = attrs.has("aria-label") || attrs.has("aria-labelledby") || attrs.has("...");
          if (isIcon && !named) {
            const { line } = src.getLineAndCharacterOfPosition(node.getStart(src));
            out.push(`${relative(ROOT, file).replace(/\\/g, "/")}:${line + 1}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(src);
  }
  return out;
}

describe("icon buttons", () => {
  it('every <Button size="icon"> has an aria-label', () => {
    expect(unlabelledIconButtons()).toEqual([]);
  });
});
