import { defineConfig } from "vitest/config";

const COVERAGE_THRESHOLD_PERCENT = 80;

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // The pure modules. Liquid templates and the code that touches the page are covered end to end.
      include: ["assets/js/quotes/**", "assets/js/portal/state.js"],
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      thresholds: {
        statements: COVERAGE_THRESHOLD_PERCENT,
        branches: COVERAGE_THRESHOLD_PERCENT,
        functions: COVERAGE_THRESHOLD_PERCENT,
        lines: COVERAGE_THRESHOLD_PERCENT,
      },
    },
  },
});
