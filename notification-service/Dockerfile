FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Copiar archivos .proto a dist/ (tsc no los copia automáticamente)
RUN find src -name "*.proto" | while IFS= read -r f; do \
        dest="dist/${f#src/}"; \
        mkdir -p "$(dirname "$dest")"; \
        cp "$f" "$dest"; \
    done

EXPOSE 50055

CMD ["npm", "start"]
