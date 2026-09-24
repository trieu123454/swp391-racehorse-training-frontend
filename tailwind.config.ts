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
          blue: "#1e3e62",
          gold: "#c5a059",
          champagne: "#ffdea5",
          ink: "#161c27",
          paper: "#f9f9ff",
          mist: "#f1f3ff",
          line: "#dde2f3",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Segoe UI", "Arial", "sans-serif"],
        serif: ["Playfair Display", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
