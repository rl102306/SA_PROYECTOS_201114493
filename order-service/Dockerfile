FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY src ./src

RUN npm run build

# Copiar archivos .proto a dist/ (tsc no los copia automáticamente)
RUN find src -name "*.proto" | while IFS= read -r f; do \
        dest="dist/${f#src/}"; \
        mkdir -p "$(dirname "$dest")"; \
        cp "$f" "$dest"; \
    done

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 50053

CMD ["node", "dist/server.js"]
