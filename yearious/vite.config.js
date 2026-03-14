import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: './',
  plugins: [react()],
  // Use the project root (where index.html is) so Vite finds index.html during build
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
