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
      },
    },
  },
  plugins: [],
};
