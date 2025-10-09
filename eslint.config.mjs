// eslint.config.js
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "postcss.config.*",
      "tailwind.config.*",
    ],
  },

  // Grunnregler for moderne JS
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        navigator: "readonly",
        // legg til 'module'/'require' hvis du bruker CommonJS
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,

      // import-hjelp (kan justeres etter behov)
      "import/no-unresolved": "off", // slå på hvis du har bundler/alias
      "import/order": [
        "warn",
        {
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling", "index"],
          ],
        },
      ],
      // små forbedringer
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-constant-binary-expression": "error",
      "no-console": "off", // skru til "warn" i prod
    },
  },

  // Skru av alt som kolliderer med Prettier
  prettier,
];
