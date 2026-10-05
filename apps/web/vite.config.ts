import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const RACINE_DEPOT = "../..";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, RACINE_DEPOT, "");

  return {
    plugins: [react()],
    server: {
      // Même chemin qu'en production derrière nginx : le front n'a qu'une origine.
      proxy: {
        "/api": {
          target: `http://localhost:${env.PORT_API ?? "3000"}`,
          rewrite: (chemin) => chemin.replace(/^\/api/, ""),
        },
      },
    },
  };
});
