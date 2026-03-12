# Etapa 1: Construcción
FROM node:18-alpine AS builder

WORKDIR /app

# Instalar Angular CLI
RUN npm install -g @angular/cli@17

# Copiar package.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Construir la aplicación para producción
RUN ng build --configuration production

# Etapa 2: Servidor Nginx
FROM nginx:alpine

# Copiar archivos compilados de Angular
COPY --from=builder /app/dist/delivereats /usr/share/nginx/html

# Copiar configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

# Comando para iniciar Nginx
# Servidor WEB

CMD ["nginx", "-g", "daemon off;"]
