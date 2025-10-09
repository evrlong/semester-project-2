# Semester Project 2

This project is structured as a small front-end prototype powered by Tailwind CSS, ESLint, Prettier and Husky. The repository now follows a clearer separation between source files, compiled assets and static pages.

## Project structure

```
public/
  assets/
    css/style.css       # Compiled Tailwind CSS
    js/                 # Browser scripts organised per page
      shared/           # Shared helpers and seed data
  index.html            # Landing page
  *.html                # Additional feature pages (login, listings, profile, register)
src/
  styles/tailwind.css   # Tailwind entry point with custom layers
```

Configuration files for ESLint, Prettier, Tailwind and Husky live in the repository root so that tooling works consistently across the project.

## Available scripts

- `npm run tailwind:build` – compile Tailwind to `public/assets/css/style.css`.
- `npm run tailwind:watch` – watch Tailwind source files during development.
- `npm test` / `npm run lint` / `npm run lint:fix` – run ESLint on the codebase.
- `npm run format` / `npm run format:check` – format files with Prettier.

Before committing, Husky runs `lint-staged` to lint and format staged JavaScript, HTML and CSS changes automatically.
