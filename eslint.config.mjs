import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  // Built, generated or copied files, the local Reference Site baseline and test reports.
  globalIgnores([
    "_site/**",
    "assets/js/vendor/**",
    "assets/css/**",
    "reference-site/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".parity/**",
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  { files: ["assets/js/**/*.js"], languageOptions: { globals: globals.browser } },
  {
    files: ["scripts/**/*.mjs", "e2e/**/*.ts", "tests/**/*.ts", "*.ts", "*.mts"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
]);

export default eslintConfig;
