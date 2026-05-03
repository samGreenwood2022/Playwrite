// eslint.config.mjs — ESLint v9+ flat config for TypeScript.
//
// Lints every .ts file in the project (tests, page objects, configs) using
// the typescript-eslint recommended rule set. Project-generated and vendor
// directories are skipped via the top-level `ignores` block — anything in
// there isn't ours to lint.

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "reports/**",
      "artifacts/**",
      "playwright-report/**",
      "test-results/**",
      "tests/snapshots/**",
      "tests-examples/**",
      ".features-gen/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Treat names prefixed with _ (variables, args, caught errors,
      // destructured siblings) as intentionally unused. Lets us preserve
      // an API contract — e.g. a method parameter currently unused but
      // expected by callers — without disabling the rule wholesale.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
];
