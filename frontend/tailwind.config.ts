import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "var(--color-page-bg)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        "input-box": "var(--color-input-box)",
        "input-border": "var(--color-input-border)",
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          subtle: "var(--color-primary-subtle)",
        },
        main: "var(--color-text)",
        muted: "var(--color-muted)",
        subtle: "var(--color-subtle)",
        gold: {
          bg: "var(--color-gold-bg)",
          text: "var(--color-gold-text)",
          border: "var(--color-gold-border)",
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
