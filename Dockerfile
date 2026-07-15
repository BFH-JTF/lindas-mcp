FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/ dist/

ENV LINDAS_TRANSPORT=http
ENV LINDAS_PORT=8000
ENV LINDAS_HOST=0.0.0.0
EXPOSE 8000

CMD ["node", "dist/index.js"]