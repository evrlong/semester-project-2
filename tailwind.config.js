/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./*.html", // HTML-filer i rot (index.html, listings.html, profil.html, osv.)
    "./**/*.html", // ev. HTML i undermapper
    "./*.js", // JS i rot (om du har)
    "./src/**/*.{js,ts,jsx,tsx}", // JS/TS i src/
    "!./node_modules/**", // ekskluder node_modules
    "!./dist/**", // ekskluder dist
    "!./build/**", // ekskluder build
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
