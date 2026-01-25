/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
  build: {
    target: "es2020",
    minify: "terser",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("react") ||
              id.includes("react-dom") ||
              id.includes("react-router-dom")
            ) {
              return "react-vendor";
            }
            if (id.includes("@supabase")) {
              return "supabase-vendor";
            }
            if (id.includes("lucide-react")) {
              return "icons-vendor";
            }
            if (id.includes("framer-motion")) {
              return "animation-vendor";
            }
            if (id.includes("@tanstack/react-query")) {
              return "query-vendor";
            }
            if (id.includes("leaflet") || id.includes("react-leaflet")) {
              return "map-vendor";
            }
            if (id.includes("@radix-ui")) {
              return "ui-vendor";
            }

            // Catch-all for other node_modules to prevent them from being bundled into entry
            return "vendor";
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@supabase/supabase-js", "lucide-react"],
  },
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
  preview: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: false,
  },
});
