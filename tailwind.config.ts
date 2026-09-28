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
          navy: "#285f7e",
          "navy-soft": "#367795",
          "navy-deep": "#1d4e6b",
          blue: "#3b83a3",
          gold: "#a8602c",
          "gold-bright": "#e29b5d",
          champagne: "#fff0d9",
          ink: "#334654",
          muted: "#617583",
          subtle: "#778d9a",
          paper: "#f3f9fc",
          cream: "#ffffff",
          mist: "#eaf4f8",
          sand: "#deeff5",
          line: "#d8e7ee",
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
        layer: "0 4px 20px -6px rgba(40, 95, 126, 0.10)",
        "layer-hover":
          "0 18px 40px -12px rgba(40, 95, 126, 0.18), 0 2px 6px -2px rgba(40, 95, 126, 0.06)",
        brass: "0 10px 30px -10px rgba(168, 96, 44, 0.25)",
        "brass-tight": "0 6px 18px -8px rgba(168, 96, 44, 0.28)",
        float: "0 30px 60px -24px rgba(40, 95, 126, 0.25)",
        inset: "inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
      },
      backgroundImage: {
        "brass-sheen":
          "linear-gradient(118deg, #ffe8cc 0%, #f7c28f 48%, #e6a66b 100%)",
        "navy-veil":
          "linear-gradient(180deg, rgba(29,78,107,0.08) 0%, rgba(29,78,107,0.58) 60%, rgba(29,78,107,0.82) 100%)",
        "hairline-gold":
          "linear-gradient(90deg, transparent, rgba(226,155,93,0.6), transparent)",
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
