FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Copiar archivos .proto a dist/ (tsc no los copia automáticamente)
RUN find src -name "*.proto" | while IFS= read -r f; do \
        dest="dist/${f#src/}"; \
        mkdir -p "$(dirname "$dest")"; \
        cp "$f" "$dest"; \
    done

# Exponer puerto gRPC
EXPOSE 50054

# Comando de inicio
CMD ["npm", "start"]
