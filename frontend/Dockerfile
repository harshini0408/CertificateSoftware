# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_BASE_PATH=/project-name/
ARG VITE_API_URL=/project-name/api
ARG VITE_BACKEND_BASE_URL=/project-name
ARG VITE_DEV_BACKEND_ORIGIN=http://backend:8000
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_BACKEND_BASE_URL=${VITE_BACKEND_BASE_URL}
ENV VITE_DEV_BACKEND_ORIGIN=${VITE_DEV_BACKEND_ORIGIN}

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g serve@14.2.4
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["serve", "-s", "dist", "-l", "4173"]
