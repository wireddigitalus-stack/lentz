import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lentz: {
          dark: "#08090C",
          surface: "#10131A",
          card: "#161B24",
          border: "rgba(255, 255, 255, 0.08)",
          subtle: "#94A3B8",
          blue: "#38BDF8",
          cobalt: "#2563EB",
          emerald: "#10B981",
          amber: "#F59E0B",
          crimson: "#EF4444",
          purple: "#8B5CF6",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "Menlo",
          "Monaco",
          "Cascadia Code",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.45)",
        "glow-blue": "0 0 25px -3px rgba(56, 189, 248, 0.25)",
        "glow-emerald": "0 0 25px -3px rgba(16, 185, 129, 0.25)",
        "glow-amber": "0 0 25px -3px rgba(245, 158, 11, 0.25)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
