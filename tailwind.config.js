/** @type {import('tailwindcss').Config} */

// Paleta «Trato cerrado» (rebranding nov-2026).
// Los nombres viejos (hpred, kraft) quedan como alias para no tocar cientos de clases:
// apuntan a los colores nuevos. En código nuevo usá `brand`.
const brand = { 50: "#F3F5FD", 100: "#E8ECFA", 200: "#C9D2F3", 300: "#A3B3EC", 400: "#8EA2F2", DEFAULT: "#2443B5", dark: "#1B3390", 700: "#1B3390" };

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand,
        hpred: { DEFAULT: brand.DEFAULT, dark: brand.dark },
        ink: "#1C1B19",
        paper: "#FAF9F7",
        // Antes cartón; ahora azul suave para fondos y detalles.
        kraft: { 50: brand[50], 100: brand[100], 200: brand[200], DEFAULT: brand[400], 700: brand[700] },
        // Grises cálidos: reemplazan al zinc frío de Tailwind en toda la app.
        zinc: { 50: "#FAF9F7", 100: "#F2F0EC", 200: "#E5E2DC", 300: "#CFCBC3", 400: "#8E897F", 500: "#6B675F", 600: "#57534C", 700: "#45423D", 800: "#2E2C29", 900: "#1C1B19", 950: "#12110F" },
        // Estados del trato, tonos sobrios: aceptado / en espera / rechazado.
        emerald: { 50: "#F0F7F2", 100: "#E6F1EA", 200: "#C9E2D2", 300: "#9DC8AE", 400: "#6AA982", 500: "#3F8A5D", 600: "#2E7048", 700: "#275F3D", 800: "#1F4C31", 900: "#183B26", 950: "#0F2618" },
        amber: { 50: "#FBF6EC", 100: "#F7EEDC", 200: "#EEDCB6", 300: "#E2C385", 400: "#D4A653", 500: "#B9852C", 600: "#9A6A17", 700: "#7A4F08", 800: "#5F3D07", 900: "#4A3006", 950: "#2E1D03" },
        rose: { 50: "#FBF1EF", 100: "#F8E5E2", 200: "#F0C8C2", 300: "#E3A198", 400: "#D07468", 500: "#BE4F43", 600: "#A8342B", 700: "#8F2A22", 800: "#74221C", 900: "#5C1B16", 950: "#3A100D" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Manrope", "Inter", "system-ui", "sans-serif"],
        marker: ["\"Permanent Marker\"", "cursive"],
      },
    },
  },
};
