FROM node:24-slim AS construction
WORKDIR /app
COPY . .
RUN npm ci && npm run build -w apps/web

FROM nginx:1-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=construction /app/apps/web/dist /usr/share/nginx/html
