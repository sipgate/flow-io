/**
 * eslint.design-system.mjs
 *
 * Minimale ESLint-Config ausschließlich für die flow-io-design-Regeln.
 * Wird im pre-commit Hook verwendet — keine anderen Fehler, nur Design System.
 *
 * Läuft unabhängig von eslint.config.mjs (keine next/core-web-vitals-Regeln).
 * TSX-Parsing via @typescript-eslint/parser (bereits als Transitive Abhängigkeit via eslint-config-next).
 */

import { createRequire } from "module";
import tsParser from "@typescript-eslint/parser";

const require = createRequire(import.meta.url);
const flow-ioDesign = require("./eslint-rules/index.js");

export default [
  {
    files: ["**/*.tsx", "**/*.ts"],
    ignores: [
      ".next/**",
      "eslint-rules/**",
      "app/design/**",
      "node_modules/**",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "flow-io-design": flow-ioDesign,
    },
    rules: {
      // Nur die drei hard-error Design-System-Regeln
      "flow-io-design/table-in-card": "error",
      "flow-io-design/badge-color-pairing": "error",
      "flow-io-design/no-button-in-card-header": "error",
      // no-hardcoded-jsx-text bleibt warn-only (nicht im pre-commit)
    },
  },
];
