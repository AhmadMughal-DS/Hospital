import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: true,
    port: 5173,
  },

  // ── Production Build Optimizations
  build: {
    target: "es2015",
    minify: "terser",
    cssMinify: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        // Manual chunking — split vendor libs for better cache hits
        manualChunks: {
          "react-vendor":  ["react", "react-dom"],
          "router":        ["react-router-dom"],
          "i18n":          ["i18next", "react-i18next"],
          "axios":         ["axios"],
          "lucide":        ["lucide-react"],
        },
        // Cache-busting asset filenames
        entryFileNames:  "assets/[name]-[hash].js",
        chunkFileNames:  "assets/[name]-[hash].js",
        assetFileNames:  "assets/[name]-[hash][extname]",
      },
    },
  },

  // ── Performance — preload module directives
  preview: {
    host: true,
    port: 4173,
    headers: {
      // Security + SEO headers for preview server
      "X-Frame-Options":           "SAMEORIGIN",
      "X-Content-Type-Options":    "nosniff",
      "X-XSS-Protection":          "1; mode=block",
      "Referrer-Policy":           "strict-origin-when-cross-origin",
      "Permissions-Policy":        "camera=(), microphone=(), geolocation=()",
      "Cache-Control":             "public, max-age=31536000, immutable",
    },
  },

  // ── CSS code splitting
  css: {
    devSourcemap: true,
  },
});
