/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        hpred: { DEFAULT: "#C8102E", dark: "#A30C25" },
        ink: "#1B1B1B",
        kraft: { 50: "#FBF5EC", 100: "#F4E6CF", 200: "#E8CFA5", DEFAULT: "#D2A76A", 700: "#8A6531" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Archivo", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
};
