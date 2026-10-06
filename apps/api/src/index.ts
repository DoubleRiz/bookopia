import { creerClientPrisma } from "@bookopia/db";
import { construireApp } from "./app";

const PORT = Number(process.env.PORT_API ?? 3000);
const URL_BASE = process.env.DATABASE_URL;

if (!URL_BASE) {
  throw new Error("DATABASE_URL manquante");
}

const prisma = creerClientPrisma(URL_BASE);
const app = await construireApp(prisma, { logger: true });

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

await app.listen({ port: PORT, host: "0.0.0.0" });
