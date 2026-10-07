import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Un seul .env, à la racine du dépôt.
  envDir: "../..",
});
