/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./public/**/*.html",
    "./public/assets/js/**/*.js",
    "./src/**/*.{js,ts,jsx,tsx}",
    "!./node_modules/**",
    "!./dist/**",
    "!./build/**",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
