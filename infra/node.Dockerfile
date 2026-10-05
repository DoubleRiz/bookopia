# Image commune à l'API et au worker : seule la commande change, fixée dans Compose.
FROM node:24-slim
WORKDIR /app
COPY . .
RUN npm ci
