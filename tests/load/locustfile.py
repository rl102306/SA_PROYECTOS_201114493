"""
DeliverEats — Locust Load Test
=======================================================
Simula el comportamiento de usuarios reales:
  - Clientes navegando el catálogo (alta frecuencia)
  - Clientes creando pedidos (baja frecuencia)

Pesos de tareas (weight):
  - get_restaurants: 5  → 5x más frecuente que crear pedido
  - get_products:    4
  - create_order:    1

Uso headless (CI/CD):
  locust --headless --host http://34.44.246.195 \\
         --users 10 --spawn-rate 2 --run-time 2m \\
         --html report.html --locustfile locustfile.py

Uso con UI (local):
  locust --host http://34.44.246.195 --locustfile locustfile.py
  → Abrir http://localhost:8089
"""

import json
import random
import string
import time
from locust import HttpUser, task, between, events


# ── Datos compartidos entre usuarios (se cargan en on_start) ─────────────────
RESTAURANTS = []


def random_email():
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"locust_{suffix}@test.com"


# ── Usuario de tipo Cliente ───────────────────────────────────────────────────

class DeliverEatsUser(HttpUser):
    """
    Simula un usuario cliente típico:
    1. Se registra y hace login al arrancar
    2. Navega el catálogo (frecuente)
    3. Eventualmente crea un pedido (poco frecuente)
    """
    wait_time = between(1, 3)

    def _base_headers(self):
        return {"Host": "api.delivereats.local"}

    def _auth_headers(self):
        headers = {"Host": "api.delivereats.local"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def on_start(self):
        """Se ejecuta una vez cuando el usuario virtual arranca."""
        global RESTAURANTS

        self.token = None
        self.user_id = None
        self.email = random_email()
        self.password = "LocustTest123!"
        self.restaurant_id = None
        self.products = []

        # Registro
        with self.client.post("/auth/register", json={
            "email": self.email,
            "password": self.password,
            "firstName": "Locust",
            "lastName": "User",
            "role": "CLIENT"
        }, headers=self._base_headers(), catch_response=True, name="/auth/register") as resp:
            if resp.status_code != 200:
                resp.failure(f"Register falló: {resp.status_code}")
                return

        # Login
        with self.client.post("/auth/login", json={
            "email": self.email,
            "password": self.password
        }, headers=self._base_headers(), catch_response=True, name="/auth/login") as resp:
            if resp.status_code == 200:
                data = resp.json()
                self.token = data.get("token")
                self.user_id = data.get("user", {}).get("id")
                resp.success()
            else:
                resp.failure(f"Login falló: {resp.status_code}")
                return

        # Cargar restaurantes una sola vez para todos los usuarios
        if not RESTAURANTS:
            with self.client.get("/catalog/restaurants",
                                 headers=self._base_headers(),
                                 name="/catalog/restaurants",
                                 catch_response=True) as resp:
                if resp.status_code == 200:
                    data = resp.json()
                    RESTAURANTS.extend(data.get("restaurants", []))

        # Asignarse un restaurante aleatorio
        if RESTAURANTS:
            self.restaurant_id = random.choice(RESTAURANTS).get("id")
            self._load_products()

    def _load_products(self):
        """Carga productos del restaurante asignado."""
        if not self.restaurant_id:
            return
        with self.client.get(
            f"/catalog/restaurants/{self.restaurant_id}/products",
            headers=self._base_headers(),
            name="/catalog/restaurants/:id/products",
            catch_response=True
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                self.products = data.get("products", [])

    # ── Tareas ────────────────────────────────────────────────────────────────

    @task(5)
    def get_restaurants(self):
        """Ver lista de restaurantes — tarea más frecuente."""
        with self.client.get("/catalog/restaurants",
                             headers=self._base_headers(),
                             name="/catalog/restaurants",
                             catch_response=True) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"Status: {resp.status_code}")

    @task(4)
    def get_products(self):
        """Ver productos de un restaurante."""
        if not self.restaurant_id:
            return
        with self.client.get(
            f"/catalog/restaurants/{self.restaurant_id}/products",
            headers=self._base_headers(),
            name="/catalog/restaurants/:id/products",
            catch_response=True
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"Status: {resp.status_code}")

    @task(1)
    def create_order(self):
        """Crear un pedido — tarea menos frecuente."""
        if not self.token or not self.restaurant_id or not self.products:
            return

        product = random.choice(self.products)
        payload = {
            "restaurantId": self.restaurant_id,
            "items": [{
                "productId": product.get("id"),
                "quantity": random.randint(1, 3),
                "price": float(product.get("price", 10))
            }],
            "deliveryAddress": f"Calle Locust {random.randint(1, 999)}"
        }

        with self.client.post(
            "/orders",
            json=payload,
            headers=self._auth_headers(),
            name="/orders",
            catch_response=True
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    resp.success()
                else:
                    resp.failure(f"Order falló: {data.get('message')}")
            else:
                resp.failure(f"Status: {resp.status_code}")

    @task(2)
    def check_my_orders(self):
        """Consultar mis pedidos — frecuencia media."""
        if not self.token or not self.user_id:
            return
        with self.client.get(
            f"/orders/user/{self.user_id}",
            headers=self._auth_headers(),
            name="/orders/user/:id",
            catch_response=True
        ) as resp:
            if resp.status_code in (200, 404):
                resp.success()
            else:
                resp.failure(f"Status: {resp.status_code}")


# ── Hooks de eventos ─────────────────────────────────────────────────────────

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("\n" + "="*50)
    print(" DeliverEats Load Test — INICIANDO")
    print(f" Host: {environment.host}")
    print("="*50 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    stats = environment.stats
    total = stats.total
    print("\n" + "="*50)
    print(" DeliverEats Load Test — COMPLETADO")
    print(f" Requests totales : {total.num_requests}")
    print(f" Fallos           : {total.num_failures}")
    print(f" RPS promedio     : {total.current_rps:.2f}")
    print(f" Latencia p50     : {total.get_response_time_percentile(0.50):.0f}ms")
    print(f" Latencia p95     : {total.get_response_time_percentile(0.95):.0f}ms")
    print(f" Latencia p99     : {total.get_response_time_percentile(0.99):.0f}ms")
    print("="*50 + "\n")
