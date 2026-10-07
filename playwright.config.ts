import { defineConfig, devices } from "@playwright/test";

// Parcours critiques de bout en bout (docs/conventions.md). Ils supposent Supabase lancé
// en local (supabase start) et démarrent eux-mêmes le front, sur un port à part.
const PORT = 5175;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -w apps/web -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
