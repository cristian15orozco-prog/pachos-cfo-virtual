/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pachos: {
          green: "#1B5E3A",
          gold: "#D4A017",
        },
        // Paleta del Brand Book de Pachos Minimarket — usada por ahora solo en
        // la pantalla de login; el resto de la app sigue con pachos.green/gold.
        brand: {
          orange: "#F26822",
          orangeDark: "#D95A15",
          green: "#65B32E",
          greenDark: "#2E7D32",
          greenDarker: "#1B5E20",
          greenLight: "#E8F5E9",
          grayLight: "#F2F4F7",
          grayDark: "#374151",
          text: "#111827",
        },
      },
      fontFamily: {
        poppins: ["Poppins", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
