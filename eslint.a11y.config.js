// Accessibility rules (WCAG Level A mechanics), on their own so CI can hold
// them at zero with `--max-warnings 0` without also failing on unrelated
// warnings elsewhere (e.g. no-explicit-any). The rules stay at "warn", so the
// pre-commit hook never blocks a commit over them; CI is where they're enforced.
import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const recommended = jsxA11y.flatConfigs.recommended;
const asWarnings = Object.fromEntries(
  Object.entries(recommended.rules).map(([rule, setting]) => [
    rule,
    Array.isArray(setting) ? ["warn", ...setting.slice(1)] : setting === "off" ? "off" : "warn",
  ])
);

export const a11yBlock = {
  files: ["client/src/**/*.{jsx,tsx}"],
  // Other plugins are registered (with none of their rules on) only so the
  // eslint-disable comments in the code that name them still resolve.
  plugins: {
    "jsx-a11y": jsxA11y,
    "react-hooks": reactHooksPlugin,
    "@typescript-eslint": tseslint.plugin,
  },
  linterOptions: { reportUnusedDisableDirectives: "off" },
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  rules: {
    ...asWarnings,
    // Labels that wrap their field may hold the text a few elements deep, and
    // the field may be one of our components rather than a raw <input>.
    "jsx-a11y/label-has-associated-control": [
      "warn",
      {
        depth: 4,
        controlComponents: [
          "Input",
          "Textarea",
          "Checkbox",
          "Switch",
          "SelectTrigger",
          "SearchableSelect",
        ],
      },
    ],
  },
  // shadcn components render these elements; mapping them lets the rules see
  // icon-only <Button>s and <Label>/<Input> pairs, not just raw HTML.
  settings: {
    "jsx-a11y": {
      components: {
        Button: "button",
        Input: "input",
        Textarea: "textarea",
        Label: "label",
      },
    },
  },
};

export default [a11yBlock, { ignores: ["dist/", "node_modules/"] }];
