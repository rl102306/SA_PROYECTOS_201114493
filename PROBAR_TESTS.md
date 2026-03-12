# Guía para Probar Tests Manualmente

## Prerequisitos

Necesitas tener Node.js instalado. Verifica con:
```bash
node --version
npm --version
```

---

## ¿Cómo funciona `npm test`?

Cuando corres `npm test` dentro de un servicio, Jest busca todos los archivos `.test.ts`
dentro de la carpeta `__tests__/` y los ejecuta uno por uno.

Los tests están escritos con **Jest** + **ts-jest** (que compila TypeScript al vuelo).
No necesitas levantar Docker ni ninguna base de datos — los tests usan **mocks**
(objetos falsos que simulan la BD, gRPC, etc.).

---

## TEST 1 — restaurant-catalog-service (47 tests)

### ¿Qué prueba?
- Cálculo matemático de **cupones** (PERCENTAGE, FIXED)
- Cálculo matemático de **promociones** (PERCENTAGE, FIXED, FREE_DELIVERY)
- **Calificaciones** (Rating): validación de estrellas 1-5, promedios, restaurantes destacados

### Cómo correrlo

```bash
# 1. Abre una terminal y ve al directorio del servicio
cd D:/USAC/1S2026/SA/SA_PROYECTOS_201114493/restaurant-catalog-service

# 2. Instala dependencias (solo la primera vez)
npm install

# 3. Corre todos los tests
npm test
```

### Qué deberías ver
```
PASS  __tests__/discount.test.ts
  Coupon – tipo PERCENTAGE
    ✓ aplica 20% de descuento a un total de Q100 (X ms)
    ✓ no descuenta más que el total del pedido
    ...
  Promotion – tipo FREE_DELIVERY
    ✓ descuenta el costo de envío completo
    ...

PASS  __tests__/rating.test.ts
  Rating – validación de estrellas
    ✓ crea rating de restaurante con 5 estrellas sin error
    ✓ lanza error si estrellas son 0
    ...

Test Suites: 2 passed, 2 total
Tests:       47 passed, 47 total
```

### Para ver un test específico
```bash
# Solo el archivo de descuentos
npm test -- discount.test.ts

# Solo el archivo de calificaciones
npm test -- rating.test.ts

# Con más detalle (--verbose)
npm test -- --verbose
```

### Para ver cobertura de código
```bash
npm run test:coverage
```
Esto genera una tabla mostrando qué % de cada archivo está cubierto por tests.

---

## TEST 2 — auth-service (16 tests)

### ¿Qué prueba?
- **LoginUserUseCase**: el proceso completo de login
  - Login exitoso con credenciales válidas
  - Error cuando el usuario no existe
  - Error cuando la contraseña es incorrecta
  - Error cuando los campos vienen vacíos
  - Login de usuario tipo RESTAURANT (con restaurantId)

### Cómo correrlo

```bash
cd D:/USAC/1S2026/SA/SA_PROYECTOS_201114493/auth-service
npm install
npm test
```

### Qué deberías ver
```
PASS  __tests__/login.test.ts
  LoginUserUseCase – login exitoso
    ✓ retorna token JWT cuando las credenciales son correctas
    ✓ el token contiene el userId y el rol
    ...
  LoginUserUseCase – casos de error
    ✓ lanza error si el usuario no existe
    ✓ lanza error si la contraseña es incorrecta
    ✓ lanza error si el email está vacío
    ...

Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
```

### Para ver un test en modo "watch" (se re-ejecuta al guardar)
```bash
npm run test:watch
```
Útil cuando estás modificando código y quieres ver el resultado en tiempo real.
Sal con `Ctrl+C`.

---

## TEST 3 — order-service (20 tests)

### ¿Qué prueba?
- **CreateOrderUseCase**: crear un pedido
  - Creación exitosa con datos válidos
  - Cálculo correcto del total (precio × cantidad)
  - Error cuando el servicio de catálogo (gRPC) falla
  - Validación del DTO (campos requeridos)
  - Estado inicial de la orden (`PENDING`)
  - Casos límite: carrito vacío, cantidades negativas, etc.

### Cómo correrlo

```bash
cd D:/USAC/1S2026/SA/SA_PROYECTOS_201114493/order-service
npm install
npm test
```

### Qué deberías ver
```
PASS  __tests__/createOrder.test.ts
  CreateOrderUseCase – creación exitosa
    ✓ crea una orden con estado PENDING
    ✓ calcula el total correctamente (suma precio × cantidad)
    ...
  CreateOrderUseCase – validación de DTO
    ✓ lanza error si no hay items en el carrito
    ✓ lanza error si falta el restaurantId
    ...

Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
```

---

## Comandos útiles de Jest

| Comando | Qué hace |
|---------|----------|
| `npm test` | Corre todos los tests una vez |
| `npm test -- --verbose` | Muestra el nombre de cada test individual |
| `npm test -- archivo.test.ts` | Corre solo ese archivo |
| `npm test -- -t "nombre del test"` | Corre solo los tests cuyo nombre coincide |
| `npm run test:watch` | Modo vigilancia: re-ejecuta al guardar |
| `npm run test:coverage` | Muestra cobertura de código |

---

## ¿Qué significa cada resultado?

| Símbolo | Significado |
|---------|-------------|
| `✓` verde | Test pasó correctamente |
| `✕` rojo | Test falló — hay un bug |
| `○` amarillo | Test saltado (`test.skip`) |
| `PASS` | Todos los tests del archivo pasaron |
| `FAIL` | Al menos un test falló |

---

## Si algo falla

Si ves un error como `Cannot find module '../src/...'`, corre primero:
```bash
npm install
```

Si ves un error de TypeScript, es un problema en el código del test o del servicio,
no en la configuración.

---

## Estructura de un test (para entender el código)

```typescript
describe('LoginUserUseCase – login exitoso', () => {   // <- agrupa tests relacionados

  test('retorna token cuando las credenciales son correctas', async () => {
    // ARRANGE: preparar datos de entrada
    mockUserRepo.findByEmail.mockResolvedValue(VALID_USER);
    mockPasswordHasher.compare.mockResolvedValue(true);
    mockJwtGenerator.generate.mockReturnValue('mi-token-jwt');

    // ACT: ejecutar lo que queremos probar
    const resultado = await useCase.execute({ email: 'a@b.com', password: '123' });

    // ASSERT: verificar que el resultado es el esperado
    expect(resultado.token).toBe('mi-token-jwt');
    expect(resultado.role).toBe('CLIENT');
  });

});
```

- **ARRANGE**: pones los mocks a devolver lo que necesitas
- **ACT**: llamas a la función que estás probando
- **ASSERT**: verificas con `expect(...)` que el resultado sea correcto
