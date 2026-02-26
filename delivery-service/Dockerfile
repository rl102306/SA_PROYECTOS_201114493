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

# Exponer puerto gRPC
EXPOSE 50054

# Comando de inicio
CMD ["npm", "start"]
