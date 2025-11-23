# Semester Project 2

HTML files live in `public/`. Tailwind source is in `src/styles/tailwind.css` and builds to `public/assets/css/style.css`.

## Getting started

1. Install dependencies: `npm install`.
2. Build CSS once: `npm run tailwind:build`.
3. During development: `npm run tailwind:watch` to update CSS automatically.
4. Open `public/index.html` (or any other HTML file in `public/`) in your browser.

## Useful scripts

- `npm run tailwind:build`: Build CSS.
- `npm run tailwind:watch`: Build CSS while you work.
- `npm run lint` / `npm run lint:fix`: Lint code and try to fix simple issues.
- `npm test`: Runs the same lint check.
- `npm run format` / `npm run format:check`: Format and check with Prettier.
- `npm run prepare`: Sets up Husky Git hooks (runs automatically after install).

## Before committing

Husky runs `lint-staged` to format and lint changed files automatically.
