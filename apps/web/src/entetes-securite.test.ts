import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Le front est servi par Vercel : ses en-têtes de sécurité vivent dans vercel.json, à la racine.
const config = JSON.parse(
  readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8"),
) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};

const entetes = new Map(
  config.headers
    .find((regle) => regle.source === "/(.*)")
    ?.headers.map((e) => [e.key, e.value]) ?? [],
);

describe("en-têtes de sécurité du front (BK-121)", () => {
  const csp = entetes.get("Content-Security-Policy") ?? "";
  const directive = (nom: string) =>
    csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith(`${nom} `)) ?? "";

  it("interdit l'affichage dans une iframe", () => {
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("n'autorise de scripts que ceux du domaine et de Google Identity", () => {
    expect(directive("script-src")).toBe(
      "script-src 'self' https://accounts.google.com/gsi/client",
    );
  });

  it("part d'une base fermée et limite les connexions à Supabase et Google", () => {
    expect(directive("default-src")).toBe("default-src 'self'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("connect-src")).toBe(
      "connect-src 'self' https://*.supabase.co https://accounts.google.com https://photospicker.googleapis.com https://*.googleusercontent.com",
    );
  });

  it("sert Referrer-Policy et nosniff", () => {
    expect(entetes.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(entetes.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
