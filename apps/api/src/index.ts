import Fastify from "fastify";

const PORT = Number(process.env.PORT_API ?? 3000);

const app = Fastify({ logger: true });

app.get("/sante", async () => ({ statut: "ok" }));

await app.listen({ port: PORT, host: "0.0.0.0" });
