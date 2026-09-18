import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#dcecff",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
        },
        compliance: {
          green: { bg: "#ecfdf3", text: "#027a48", ring: "#abefc6" },
          yellow: { bg: "#fffaeb", text: "#b54708", ring: "#fedf89" },
          orange: { bg: "#fff4ed", text: "#c4320a", ring: "#f9dbaf" },
          red: { bg: "#fef3f2", text: "#b42318", ring: "#fecdca" },
          gray: { bg: "#f9fafb", text: "#414651", ring: "#d5d7da" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
