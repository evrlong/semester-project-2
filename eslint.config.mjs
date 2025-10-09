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
        FormData: "readonly",
        URLSearchParams: "readonly",
        // legg til 'module'/'require' hvis du bruker CommonJS
      },
    },
    rules: {
      // små forbedringer
      eqeqeq: ["error", "smart"],
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "error",
      "no-unreachable": "error",
      "no-constant-binary-expression": "error",
      "no-unsafe-negation": "error",
      "no-console": "off", // skru til "warn" i prod
    },
  },
];
