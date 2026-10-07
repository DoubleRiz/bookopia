import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "./generated/prisma/client";

export function creerClientPrisma(urlBase: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: urlBase }),
  });
}

export type Transaction = Prisma.TransactionClient;
export type { PrismaClient };
export type { RoleDoublePage } from "./generated/prisma/client";
