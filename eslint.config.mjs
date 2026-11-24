import eslint from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import playwright from "eslint-plugin-playwright";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["playwright-report/**", "test-results/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["tests/**/*.ts"],
    ...playwright.configs["flat/recommended"],
  },
  prettier,
);
