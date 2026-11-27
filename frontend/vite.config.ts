import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const siteUrl = (process.env.VITE_SITE_URL || "").replace(/\/$/, "");

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: "cocolot-seo-urls",
      transformIndexHtml(html: string) {
        if (!siteUrl) return html;
        return html
          .replace(/content="\/og-image\.png"/g, `content="${siteUrl}/og-image.png"`)
          .replace(/property="og:url" content="\/"/g, `property="og:url" content="${siteUrl}/"`);
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
} as any);
