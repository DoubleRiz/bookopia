import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export function creerClientPrisma(urlBase: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: urlBase }),
  });
}

export type { PrismaClient };
