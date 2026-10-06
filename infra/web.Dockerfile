FROM node:24-slim AS construction
WORKDIR /app
COPY . .
RUN npm ci && npm run build -w apps/web

FROM caddy:2-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=construction /app/apps/web/dist /srv
