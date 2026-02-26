# 🔧 Solución de Errores Comunes - Frontend Angular

## ❌ Error: "Can't bind to 'formGroup' since it isn't a known property of 'form'"

### Causa:
Falta importar `ReactiveFormsModule` en el módulo.

### Solución:
Verifica que en `app.module.ts` tengas:

```typescript
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@NgModule({
  imports: [
    BrowserModule,
    ReactiveFormsModule,  // ← IMPORTANTE
    FormsModule,          // ← IMPORTANTE
    HttpClientModule,
    RouterModule.forRoot(routes)
  ]
})
```

Si ya lo tienes y sigue el error:
```bash
# Detén el servidor (Ctrl + C)
# Borra node_modules
rm -rf node_modules package-lock.json
# Reinstala
npm install
# Inicia de nuevo
npm start
```

---

## ❌ Error: "Cannot find module '@angular/core'"

### Solución:
```bash
cd frontend
npm install
```

---

## ❌ Error: "Port 4200 is already in use"

### Solución:
```bash
# Ver qué está usando el puerto
lsof -i :4200

# Matar el proceso
kill -9 <PID>

# O usar otro puerto
ng serve --port 4201
```

---

## ❌ Error: "Component is not declared in any Angular module"

### Causa:
El componente no está declarado en `app.module.ts`

### Solución:
Agrega el componente en `declarations`:

```typescript
@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    RegisterComponent,      // ← Asegúrate de tenerlo
    CreateOrderComponent    // ← Asegúrate de tenerlo
  ]
})
```

---

## ❌ Error: "Can't resolve 'rxjs'"

### Solución:
```bash
cd frontend
npm install rxjs
```

---

## ❌ Error: "NullInjectorError: No provider for HttpClient"

### Causa:
Falta importar `HttpClientModule`

### Solución:
En `app.module.ts`:

```typescript
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [
    HttpClientModule  // ← IMPORTANTE
  ]
})
```

---

## ❌ Error: "Cannot match any routes"

### Causa:
La ruta no existe en el router.

### Solución:
Verifica las rutas en `app.module.ts`:

```typescript
const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'client/create-order', component: CreateOrderComponent }
];
```

---

## ❌ Error de CORS: "Access to XMLHttpRequest has been blocked by CORS policy"

### Causa:
El API Gateway no permite peticiones desde `http://localhost:4200`

### Solución:
Verifica que el API Gateway tenga configurado CORS:

**api-gateway/.env:**
```env
CORS_ORIGIN=http://localhost:4200
```

**api-gateway/src/server.ts:**
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true
}));
```

Reinicia el API Gateway:
```bash
# En la terminal del API Gateway
Ctrl + C
npm run dev
```

---

## ❌ Error: "Failed to compile" con errores de TypeScript

### Solución 1: Limpiar caché
```bash
cd frontend
rm -rf .angular
npm start
```

### Solución 2: Verificar tsconfig.json
Asegúrate de tener `tsconfig.json` correcto en `/frontend/`

---

## ❌ Error: "Property does not exist on type"

### Ejemplo:
```
Property 'value' does not exist on type 'AbstractControl | null'
```

### Solución:
Usa el operador de navegación segura `?.`:

```typescript
// ❌ Incorrecto
this.loginForm.get('email').value

// ✅ Correcto
this.loginForm.get('email')?.value
```

---

## ❌ Frontend se ve sin estilos

### Solución:
Verifica que existe `src/styles.css` y que esté importado.

Si no aparece:
```bash
cd frontend
# Crea el archivo styles.css con los estilos
# Reinicia
npm start
```

---

## ❌ Error 404 al hacer refresh en una ruta

### Causa:
Angular usa rutas del lado del cliente.

### Solución:
En desarrollo esto no debería pasar, pero si pasa:

1. Usa el navegador para ir a `http://localhost:4200`
2. Navega usando los links de la aplicación
3. No hagas refresh en rutas que no sean la raíz

Para producción, nginx.conf ya tiene configurado:
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## ❌ Cambios en el código no se reflejan

### Solución:
```bash
# Detén el servidor (Ctrl + C)
# Borra la caché
rm -rf .angular dist
# Inicia de nuevo
npm start
```

O simplemente fuerza un refresh en el navegador:
- Chrome/Firefox: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

---

## ❌ Error: "Cannot read property 'subscribe' of undefined"

### Causa:
El servicio no está inyectado correctamente.

### Solución:
Verifica que el servicio tenga `@Injectable({ providedIn: 'root' })`:

```typescript
@Injectable({
  providedIn: 'root'  // ← IMPORTANTE
})
export class AuthService {
  // ...
}
```

Y que esté inyectado en el constructor:

```typescript
constructor(
  private authService: AuthService  // ← IMPORTANTE
) {}
```

---

## ❌ Console del navegador muestra "404 Not Found" para llamadas al API

### Causa:
El API Gateway no está corriendo o la URL es incorrecta.

### Solución:

1. Verifica que el API Gateway esté corriendo:
```bash
# En la terminal del API Gateway deberías ver:
🚀 API Gateway escuchando en puerto 3000
```

2. Verifica la URL en `environment.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'http://localhost:3000'  // ← Debe ser esta
};
```

3. Prueba el API Gateway:
```bash
curl http://localhost:3000/health
# Debe responder: {"status":"OK",...}
```

---

## ❌ Error: "Unexpected token '<'"

### Causa:
El servidor está devolviendo HTML en vez de JSON (probablemente un error 404).

### Solución:
Verifica que la URL del endpoint sea correcta:

```typescript
// ❌ Incorrecto
this.http.post('http://localhost:3000/auth/logins', ...)

// ✅ Correcto
this.http.post('http://localhost:3000/auth/login', ...)
```

---

## 🔄 Reinicio Completo (Último Recurso)

Si nada funciona:

```bash
# 1. Detén TODOS los servidores (Ctrl + C en todas las terminales)

# 2. Detén Docker
docker-compose down

# 3. En frontend
cd frontend
rm -rf node_modules package-lock.json .angular dist
npm install

# 4. Levanta bases de datos
docker-compose -f docker-compose.dev.yml up -d

# 5. Espera 10 segundos

# 6. Levanta servicios uno por uno (en orden):
# Terminal 1: cd auth-service && npm run dev
# Terminal 2: cd restaurant-catalog-service && npm run dev
# Terminal 3: cd order-service && npm run dev
# Terminal 4: cd api-gateway && npm run dev
# Terminal 5: cd frontend && npm start

# 7. Espera a que Angular compile
# 8. Ve a http://localhost:4200
```

---

## 📞 Verificación Rápida

```bash
# ¿Bases de datos corriendo?
docker ps | grep delivereats

# ¿API Gateway respondiendo?
curl http://localhost:3000/health

# ¿Frontend compilando?
# Deberías ver en la terminal:
# ✔ Browser application bundle generation complete.
```

---

## 💡 Tip: DevTools del Navegador

Abre la consola del navegador (F12) y ve a:
- **Console**: Para ver errores de JavaScript
- **Network**: Para ver llamadas HTTP (si fallan, muestra el error)

Si ves un error 500, revisa los logs del servicio correspondiente.

---

¡Con esto deberías poder resolver los errores más comunes! 🚀
