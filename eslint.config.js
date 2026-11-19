import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import prettier from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  // Base JavaScript config
  js.configs.recommended,

  // TypeScript configs
  ...tseslint.configs.recommended,

  // React configuration with jsx-runtime for React 17+
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],

  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "react-hooks": reactHooksPlugin,
      prettier,
      // Registered so eslint-disable comments naming its rules resolve; the
      // rules themselves run from eslint.a11y.config.js (npm run lint:a11y).
      "jsx-a11y": jsxA11y,
    },
    // jsx-a11y rules run from eslint.a11y.config.js, not here, so their
    // disable comments look "unused" to this config — and `eslint --fix` in
    // the pre-commit hook would delete them. Don't report (or fix) those.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Prettier integration
      "prettier/prettier": "error",

      // TypeScript rules
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",

      // React rules (jsx-runtime config already disables react-in-jsx-scope)
      "react/prop-types": "off", // Using TypeScript for prop validation
      "react/jsx-filename-extension": ["warn", { extensions: [".js", ".jsx", ".ts", ".tsx"] }],

      // React Hooks rules
      ...reactHooksPlugin.configs.recommended.rules,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  // Prettier config must be last to override conflicting rules
  eslintConfigPrettier,
  {
    ignores: ["dist/", "node_modules/", ".git/", "*.config.js"],
  },
];
