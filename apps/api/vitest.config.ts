import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    globalSetup: ["./test/preparer-base-de-test.ts"],
    // Une seule base de test : deux fichiers en parallèle videraient les tables l'un de l'autre.
    fileParallelism: false,
  },
});
