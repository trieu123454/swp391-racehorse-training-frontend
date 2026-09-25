import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        equine: {
          navy: "#0b192c",
          "navy-soft": "#12293f",
          "navy-deep": "#071322",
          blue: "#1e3e62",
          gold: "#c5a059",
          "gold-bright": "#e5c158",
          champagne: "#ffdea5",
          ink: "#1a202c",
          muted: "#6f6558",
          subtle: "#8d8474",
          paper: "#f7f3ec",
          cream: "#fffdfa",
          mist: "#efe9de",
          sand: "#e8dfd0",
          line: "#e2d8c6",
        },
      },
      fontFamily: {
        sans: ["Be Vietnam Pro", "Segoe UI", "Arial", "sans-serif"],
        display: [
          "Playfair Display",
          "Be Vietnam Pro",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
      },
      borderRadius: {
        lux: "0.375rem",
        "lux-lg": "0.75rem",
        "lux-xl": "1.25rem",
      },
      boxShadow: {
        layer: "0 4px 20px -6px rgba(11, 25, 44, 0.10)",
        "layer-hover":
          "0 18px 40px -12px rgba(11, 25, 44, 0.24), 0 2px 6px -2px rgba(11, 25, 44, 0.06)",
        brass: "0 10px 30px -10px rgba(197, 160, 89, 0.45)",
        "brass-tight": "0 6px 18px -8px rgba(197, 160, 89, 0.5)",
        float: "0 30px 60px -24px rgba(11, 25, 44, 0.35)",
        inset: "inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
      },
      backgroundImage: {
        "brass-sheen":
          "linear-gradient(118deg, #ffe9c4 0%, #ffdea5 42%, #d9ae64 100%)",
        "navy-veil":
          "linear-gradient(180deg, rgba(7,19,34,0.12) 0%, rgba(7,19,34,0.70) 60%, rgba(7,19,34,0.95) 100%)",
        "hairline-gold":
          "linear-gradient(90deg, transparent, rgba(197,160,89,0.6), transparent)",
      },
      transitionTimingFunction: {
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
        silk: "cubic-bezier(0.22, 1, 0.36, 1)",
        seal: "cubic-bezier(0.34, 1.4, 0.64, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
