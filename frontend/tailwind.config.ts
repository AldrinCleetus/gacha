import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "rgb(var(--rgb-page-bg) / <alpha-value>)",
        surface: "rgb(var(--rgb-surface) / <alpha-value>)",
        border: "rgb(var(--rgb-border) / <alpha-value>)",
        "input-box": "rgb(var(--rgb-input-box) / <alpha-value>)",
        "input-border": "rgb(var(--rgb-input-border) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--rgb-primary) / <alpha-value>)",
          hover: "rgb(var(--rgb-primary-hover) / <alpha-value>)",
          subtle: "var(--color-primary-subtle)",
        },
        main: "rgb(var(--rgb-text) / <alpha-value>)",
        muted: "rgb(var(--rgb-muted) / <alpha-value>)",
        subtle: "rgb(var(--rgb-subtle) / <alpha-value>)",
        gold: {
          bg: "rgb(var(--rgb-gold-bg) / <alpha-value>)",
          text: "rgb(var(--rgb-gold-text) / <alpha-value>)",
          border: "rgb(var(--rgb-gold-border) / <alpha-value>)",
        },
        scheme: {
          bg: "var(--scheme-bg)",
          border: "var(--scheme-border)",
          text: "var(--scheme-text)",
        },
      },
      borderRadius: {
        "xl": "16px",
        "2xl": "20px",
        "3xl": "24px",
        "4xl": "28px",
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        mono: ["DM Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 2px 12px -2px rgba(5, 105, 90, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)",
        card: "0 4px 24px -4px rgba(5, 105, 90, 0.06), 0 1px 4px rgba(0, 0, 0, 0.02)",
        elevated: "0 12px 36px -6px rgba(5, 105, 90, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)",
        glow: "0 0 24px -2px var(--color-primary-subtle)",
      },
    },
  },
  plugins: [],
};

export default config;
