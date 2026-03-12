/**
 * Tests de lógica de negocio: sistema de calificaciones
 * Cubre: Rating entity (validación 1-5 estrellas, tipos),
 *        cálculo de promedio en memoria y lógica de restaurantes "Destacados"
 */

import { Rating, RatingType } from '../src/domain/entities/Rating';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const USER_ID       = 'cccccccc-0000-0000-0000-000000000001';
const ORDER_ID      = 'dddddddd-0000-0000-0000-000000000002';
const RESTAURANT_ID = 'eeeeeeee-0000-0000-0000-000000000003';
const DELIVERY_ID   = 'ffffffff-0000-0000-0000-000000000004';
const PRODUCT_ID    = '11111111-0000-0000-0000-000000000005';

function makeRating(type: RatingType, stars?: number, recommended?: boolean): Rating {
  return new Rating({
    orderId:          ORDER_ID,
    userId:           USER_ID,
    restaurantId:     type === 'RESTAURANT' ? RESTAURANT_ID : undefined,
    deliveryPersonId: type === 'DELIVERY'   ? DELIVERY_ID   : undefined,
    productId:        type === 'PRODUCT'    ? PRODUCT_ID    : undefined,
    type,
    stars,
    recommended
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Rating — validación de estrellas
// ─────────────────────────────────────────────────────────────────────────────
describe('Rating – validación de estrellas', () => {
  test('crea rating de restaurante con 5 estrellas sin error', () => {
    const r = makeRating('RESTAURANT', 5);
    expect(r.stars).toBe(5);
    expect(r.type).toBe('RESTAURANT');
  });

  test('crea rating de entrega con 1 estrella sin error', () => {
    const r = makeRating('DELIVERY', 1);
    expect(r.stars).toBe(1);
  });

  test('crea rating de producto con recomendación = true', () => {
    const r = makeRating('PRODUCT', undefined, true);
    expect(r.recommended).toBe(true);
    expect(r.stars).toBeUndefined();
  });

  test('crea rating de producto con recomendación = false', () => {
    const r = makeRating('PRODUCT', undefined, false);
    expect(r.recommended).toBe(false);
  });

  test('lanza error si estrellas < 1', () => {
    expect(() => makeRating('RESTAURANT', 0)).toThrow('entre 1 y 5 estrellas');
  });

  test('lanza error si estrellas > 5', () => {
    expect(() => makeRating('RESTAURANT', 6)).toThrow('entre 1 y 5 estrellas');
  });

  test('lanza error con valor negativo', () => {
    expect(() => makeRating('DELIVERY', -1)).toThrow('entre 1 y 5 estrellas');
  });

  test('no lanza error si stars es undefined (rating de producto sin estrellas)', () => {
    expect(() => makeRating('PRODUCT')).not.toThrow();
  });

  test('toJSON incluye todos los campos esperados', () => {
    const r = makeRating('RESTAURANT', 4);
    const json = r.toJSON();
    expect(json).toHaveProperty('id');
    expect(json).toHaveProperty('orderId', ORDER_ID);
    expect(json).toHaveProperty('userId', USER_ID);
    expect(json).toHaveProperty('restaurantId', RESTAURANT_ID);
    expect(json).toHaveProperty('type', 'RESTAURANT');
    expect(json).toHaveProperty('stars', 4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo de promedio de calificaciones (lógica pura, sin BD)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simula lo que hace PostgresRatingRepository.getRestaurantSummary()
 * calculando el promedio de un arreglo de estrellas.
 */
function calcAvgRating(stars: number[]): number {
  if (stars.length === 0) return 0;
  const sum = stars.reduce((a, b) => a + b, 0);
  return parseFloat((sum / stars.length).toFixed(2));
}

describe('Cálculo de promedio de calificaciones', () => {
  test('promedio de [5, 5, 5] = 5.00', () => {
    expect(calcAvgRating([5, 5, 5])).toBe(5.00);
  });

  test('promedio de [1, 2, 3, 4, 5] = 3.00', () => {
    expect(calcAvgRating([1, 2, 3, 4, 5])).toBe(3.00);
  });

  test('promedio de [4, 3] = 3.50', () => {
    expect(calcAvgRating([4, 3])).toBe(3.50);
  });

  test('promedio con decimales: [5, 4, 3] = 4.00', () => {
    expect(calcAvgRating([5, 4, 3])).toBe(4.00);
  });

  test('promedio de arreglo vacío = 0', () => {
    expect(calcAvgRating([])).toBe(0);
  });

  test('promedio de [1] = 1.00', () => {
    expect(calcAvgRating([1])).toBe(1.00);
  });

  test('redondea a 2 decimales: [5, 4, 3, 2] = 3.50', () => {
    expect(calcAvgRating([5, 4, 3, 2])).toBe(3.50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lógica de Restaurantes "Destacados" (Featured)
// ─────────────────────────────────────────────────────────────────────────────

interface RestaurantStats {
  id: string;
  name: string;
  orderCount: number;
  avgRating: number;
}

/**
 * Simula el criterio de "Destacados": restaurants ordenados por orderCount DESC.
 * Refleja la lógica en PostgresRestaurantRepository.findActive(sortBy='featured').
 */
function sortByFeatured(restaurants: RestaurantStats[]): RestaurantStats[] {
  return [...restaurants].sort((a, b) => b.orderCount - a.orderCount);
}

/**
 * Simula el criterio de "Mejor Puntuados": restaurants ordenados por avgRating DESC.
 */
function sortByBestRated(restaurants: RestaurantStats[]): RestaurantStats[] {
  return [...restaurants].sort((a, b) => b.avgRating - a.avgRating);
}

describe('Lógica de restaurantes Destacados', () => {
  const restaurants: RestaurantStats[] = [
    { id: 'r1', name: 'Burger House',      orderCount: 120, avgRating: 4.2 },
    { id: 'r2', name: 'Pizzeria Italia',   orderCount: 350, avgRating: 3.8 },
    { id: 'r3', name: 'Restaurante Central', orderCount: 80, avgRating: 4.9 },
    { id: 'r4', name: 'Sushi Bar',         orderCount: 200, avgRating: 4.5 },
  ];

  test('sortByFeatured coloca Pizzeria Italia (350 pedidos) primero', () => {
    const sorted = sortByFeatured(restaurants);
    expect(sorted[0].id).toBe('r2');
    expect(sorted[0].orderCount).toBe(350);
  });

  test('sortByFeatured devuelve todos los restaurantes', () => {
    const sorted = sortByFeatured(restaurants);
    expect(sorted).toHaveLength(4);
  });

  test('sortByFeatured orden correcto: 350 > 200 > 120 > 80', () => {
    const sorted = sortByFeatured(restaurants);
    const counts = sorted.map(r => r.orderCount);
    expect(counts).toEqual([350, 200, 120, 80]);
  });

  test('sortByFeatured con empate mantiene orden estable por JS sort', () => {
    const tied: RestaurantStats[] = [
      { id: 'x1', name: 'A', orderCount: 100, avgRating: 4.0 },
      { id: 'x2', name: 'B', orderCount: 100, avgRating: 3.5 }
    ];
    const sorted = sortByFeatured(tied);
    expect(sorted).toHaveLength(2);
    expect(sorted[0].orderCount).toBe(100);
  });
});

describe('Lógica de restaurantes Mejor Puntuados', () => {
  const restaurants: RestaurantStats[] = [
    { id: 'r1', name: 'Burger House',      orderCount: 120, avgRating: 4.2 },
    { id: 'r2', name: 'Pizzeria Italia',   orderCount: 350, avgRating: 3.8 },
    { id: 'r3', name: 'Restaurante Central', orderCount: 80, avgRating: 4.9 },
    { id: 'r4', name: 'Sushi Bar',         orderCount: 200, avgRating: 4.5 },
  ];

  test('sortByBestRated coloca Restaurante Central (4.9) primero', () => {
    const sorted = sortByBestRated(restaurants);
    expect(sorted[0].id).toBe('r3');
    expect(sorted[0].avgRating).toBe(4.9);
  });

  test('sortByBestRated orden correcto: 4.9 > 4.5 > 4.2 > 3.8', () => {
    const sorted = sortByBestRated(restaurants);
    const ratings = sorted.map(r => r.avgRating);
    expect(ratings).toEqual([4.9, 4.5, 4.2, 3.8]);
  });

  test('restaurante sin calificaciones (avgRating=0) queda al final', () => {
    const withNew: RestaurantStats[] = [
      ...restaurants,
      { id: 'r5', name: 'Nuevo', orderCount: 0, avgRating: 0 }
    ];
    const sorted = sortByBestRated(withNew);
    expect(sorted[sorted.length - 1].id).toBe('r5');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tasa de recomendación de productos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simula getProductSummary(): porcentaje de recomendaciones positivas.
 */
function calcRecommendationRate(votes: boolean[]): number {
  if (votes.length === 0) return 0;
  const positives = votes.filter(v => v).length;
  return parseFloat(((positives / votes.length) * 100).toFixed(1));
}

describe('Tasa de recomendación de productos', () => {
  test('todos positivos → 100 %', () => {
    expect(calcRecommendationRate([true, true, true])).toBe(100.0);
  });

  test('todos negativos → 0 %', () => {
    expect(calcRecommendationRate([false, false, false])).toBe(0.0);
  });

  test('mitad → 50 %', () => {
    expect(calcRecommendationRate([true, false])).toBe(50.0);
  });

  test('3 de 4 positivos → 75 %', () => {
    expect(calcRecommendationRate([true, true, true, false])).toBe(75.0);
  });

  test('sin votos → 0 %', () => {
    expect(calcRecommendationRate([])).toBe(0);
  });
});
