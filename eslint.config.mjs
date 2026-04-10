import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const designPlugin = require("./eslint-rules/index.js");

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Lokale ESLint-Regeln nicht selbst prüfen
    "eslint-rules/**",
  ]),
  // Flow-IO Design System Custom Rules
  {
    plugins: {
      "flow-io-design": designPlugin,
    },
    rules: {
      "flow-io-design/table-in-card": "error",
      "flow-io-design/badge-color-pairing": "error",
      "flow-io-design/no-button-in-card-header": "error",
      "flow-io-design/no-hardcoded-jsx-text": [
        "error",
        {
          minLength: 4,
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  // Allow console.log in files that legitimately need it
  {
    files: ["lib/utils/logger.ts", "server.ts", "scripts/**"],
    rules: {
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
