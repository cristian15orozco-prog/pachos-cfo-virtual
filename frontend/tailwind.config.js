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
        // Colores de estado — separados a propósito de brand.orange/brand.green:
        // "pagado"/"vencido" no son la marca, son un estado, y no deben
        // competir visualmente con el naranja de las acciones reales.
        status: {
          success: "#1F9254",
          successSoft: "#E4F6EC",
          warning: "#B7791F",
          warningSoft: "#FDF3E0",
          danger: "#C0362C",
          dangerSoft: "#FBE9E7",
          info: "#2563A8",
          infoSoft: "#E7F0FA",
        },
      },
      fontFamily: {
        poppins: ["Poppins", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
