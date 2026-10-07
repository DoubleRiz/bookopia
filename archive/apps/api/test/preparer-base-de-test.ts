import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  URL_BASE_DE_DEVELOPPEMENT,
  URL_BASE_DE_TEST,
} from "./url-base-de-test";

export async function setup(): Promise<void> {
  const nomBase = decodeURIComponent(
    new URL(URL_BASE_DE_TEST).pathname.slice(1),
  );
  const client = new pg.Client({ connectionString: URL_BASE_DE_DEVELOPPEMENT });
  await client.connect();
  try {
    const existante = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [nomBase],
    );
    if (existante.rowCount === 0) {
      await client.query(`CREATE DATABASE "${nomBase}"`);
    }
  } finally {
    await client.end();
  }

  // Les mêmes migrations qu'en production, contraintes SQL brutes comprises.
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: fileURLToPath(new URL("../../../packages/db", import.meta.url)),
    env: { ...process.env, DATABASE_URL: URL_BASE_DE_TEST },
    stdio: "inherit",
  });
}
