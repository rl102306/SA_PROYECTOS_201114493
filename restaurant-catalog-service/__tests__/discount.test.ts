/**
 * Tests de lógica de negocio: cálculo matemático de descuentos
 * Cubre: Coupon (PERCENTAGE / FIXED) y Promotion (PERCENTAGE / FIXED / FREE_DELIVERY)
 */

import { Coupon, CouponProps } from '../src/domain/entities/Coupon';
import { Promotion, PromotionProps } from '../src/domain/entities/Promotion';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const RESTAURANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const ORDER_ID      = 'bbbbbbbb-0000-0000-0000-000000000002';

function validCoupon(overrides: Partial<CouponProps> = {}): Coupon {
  return new Coupon({
    restaurantId:   RESTAURANT_ID,
    code:           'DESC20',
    type:           'PERCENTAGE',
    discountValue:  20,
    minOrderAmount: 0,
    usesCount:      0,
    isApproved:     true,
    isActive:       true,
    expiresAt:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 días
    ...overrides
  });
}

function activePctPromotion(discountValue: number): Promotion {
  return new Promotion({
    restaurantId:  RESTAURANT_ID,
    title:         'Oferta del día',
    type:          'PERCENTAGE',
    discountValue,
    isActive:      true,
    startsAt:      new Date(Date.now() - 1000),
    endsAt:        new Date(Date.now() + 3600 * 1000)
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// COUPON — PERCENTAGE
// ─────────────────────────────────────────────────────────────────────────────
describe('Coupon – descuento porcentual', () => {
  test('calcula el 20 % de Q 100.00 correctamente', () => {
    const coupon = validCoupon({ discountValue: 20 });
    expect(coupon.calculateDiscount(100)).toBe(20);
  });

  test('calcula el 15 % de Q 200.00 con redondeo a 2 decimales', () => {
    const coupon = validCoupon({ discountValue: 15 });
    expect(coupon.calculateDiscount(200)).toBe(30);
  });

  test('redondea correctamente: 33.33 % de Q 10.00 → Q 3.33', () => {
    const coupon = validCoupon({ discountValue: 33.33 });
    expect(coupon.calculateDiscount(10)).toBe(3.33);
  });

  test('descuento no supera el monto total del pedido con porcentaje 100 %', () => {
    const coupon = validCoupon({ discountValue: 100 });
    expect(coupon.calculateDiscount(50)).toBe(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COUPON — FIXED
// ─────────────────────────────────────────────────────────────────────────────
describe('Coupon – descuento fijo', () => {
  test('descuento fijo Q 25.00 sobre pedido de Q 100.00', () => {
    const coupon = validCoupon({ type: 'FIXED', discountValue: 25 });
    expect(coupon.calculateDiscount(100)).toBe(25);
  });

  test('descuento fijo mayor al pedido → limita al monto del pedido', () => {
    const coupon = validCoupon({ type: 'FIXED', discountValue: 200 });
    expect(coupon.calculateDiscount(50)).toBe(50);
  });

  test('descuento fijo igual al pedido → resultado Q 0.00 neto', () => {
    const coupon = validCoupon({ type: 'FIXED', discountValue: 75 });
    expect(coupon.calculateDiscount(75)).toBe(75);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COUPON — validate()
// ─────────────────────────────────────────────────────────────────────────────
describe('Coupon – validate()', () => {
  test('cupón válido devuelve valid=true con descuento correcto', () => {
    const coupon = validCoupon({ discountValue: 10, type: 'PERCENTAGE' });
    const result = coupon.validate(200);
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(20);
    expect(result.message).toBe('Cupón válido');
  });

  test('cupón no aprobado rechazado', () => {
    const coupon = validCoupon({ isApproved: false });
    const result = coupon.validate(100);
    expect(result.valid).toBe(false);
    expect(result.discountAmount).toBe(0);
    expect(result.message).toContain('no ha sido aprobado');
  });

  test('cupón inactivo rechazado', () => {
    const coupon = validCoupon({ isActive: false });
    const result = coupon.validate(100);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('inactivo');
  });

  test('cupón expirado rechazado', () => {
    const coupon = validCoupon({
      expiresAt: new Date(Date.now() - 1000) // ayer
    });
    const result = coupon.validate(100);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('expirado');
  });

  test('usos agotados → rechazado', () => {
    const coupon = validCoupon({ maxUses: 5, usesCount: 5 });
    const result = coupon.validate(100);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('límite de usos');
  });

  test('monto del pedido menor al mínimo → rechazado con mensaje correcto', () => {
    const coupon = validCoupon({ minOrderAmount: 150 });
    const result = coupon.validate(80);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Q150.00');
  });

  test('approve() activa la aprobación', () => {
    const coupon = validCoupon({ isApproved: false });
    coupon.approve();
    expect(coupon.isApproved).toBe(true);
  });

  test('incrementUsage() aumenta el contador', () => {
    const coupon = validCoupon({ usesCount: 3 });
    coupon.incrementUsage();
    expect(coupon.usesCount).toBe(4);
  });

  test('código se normaliza a mayúsculas en constructor', () => {
    const coupon = validCoupon({ code: 'verano50' });
    expect(coupon.code).toBe('VERANO50');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROMOTION — PERCENTAGE
// ─────────────────────────────────────────────────────────────────────────────
describe('Promotion – descuento porcentual', () => {
  test('calcula el 10 % de Q 150.00', () => {
    const promo = activePctPromotion(10);
    expect(promo.calculateDiscount(150)).toBe(15);
  });

  test('calcula el 50 % de Q 80.00', () => {
    const promo = activePctPromotion(50);
    expect(promo.calculateDiscount(80)).toBe(40);
  });

  test('promoción inactiva devuelve descuento 0', () => {
    const promo = new Promotion({
      restaurantId: RESTAURANT_ID,
      title: 'Inactiva',
      type: 'PERCENTAGE',
      discountValue: 20,
      isActive: false,
      startsAt: new Date(Date.now() - 1000),
      endsAt:   new Date(Date.now() + 3600 * 1000)
    });
    expect(promo.calculateDiscount(100)).toBe(0);
  });

  test('promoción fuera de rango de fechas (ya terminó) devuelve 0', () => {
    const promo = new Promotion({
      restaurantId: RESTAURANT_ID,
      title:        'Pasada',
      type:         'PERCENTAGE',
      discountValue: 30,
      isActive:     true,
      startsAt:     new Date(Date.now() - 7200 * 1000),
      endsAt:       new Date(Date.now() - 3600 * 1000) // terminó hace 1 h
    });
    expect(promo.calculateDiscount(200)).toBe(0);
    expect(promo.isCurrentlyActive()).toBe(false);
  });

  test('promoción que aún no comienza devuelve 0', () => {
    const promo = new Promotion({
      restaurantId: RESTAURANT_ID,
      title:        'Futura',
      type:         'PERCENTAGE',
      discountValue: 15,
      isActive:     true,
      startsAt:     new Date(Date.now() + 3600 * 1000), // empieza en 1 h
      endsAt:       new Date(Date.now() + 7200 * 1000)
    });
    expect(promo.calculateDiscount(100)).toBe(0);
    expect(promo.isCurrentlyActive()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROMOTION — FIXED
// ─────────────────────────────────────────────────────────────────────────────
describe('Promotion – descuento fijo', () => {
  test('descuento fijo Q 30 sobre pedido de Q 120', () => {
    const promo = new Promotion({
      restaurantId: RESTAURANT_ID,
      title:        'Promo Fija',
      type:         'FIXED',
      discountValue: 30,
      isActive:     true,
      startsAt:     new Date(Date.now() - 1000),
      endsAt:       new Date(Date.now() + 3600 * 1000)
    });
    expect(promo.calculateDiscount(120)).toBe(30);
  });

  test('descuento fijo mayor al pedido → limita al monto del pedido', () => {
    const promo = new Promotion({
      restaurantId: RESTAURANT_ID,
      title:        'Promo Fija Grande',
      type:         'FIXED',
      discountValue: 500,
      isActive:     true,
      startsAt:     new Date(Date.now() - 1000),
      endsAt:       new Date(Date.now() + 3600 * 1000)
    });
    expect(promo.calculateDiscount(50)).toBe(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROMOTION — FREE_DELIVERY
// ─────────────────────────────────────────────────────────────────────────────
describe('Promotion – envío gratis (FREE_DELIVERY)', () => {
  test('FREE_DELIVERY calcula descuento monetario en 0 (se maneja por separado)', () => {
    const promo = new Promotion({
      restaurantId: RESTAURANT_ID,
      title:        'Envío Gratis',
      type:         'FREE_DELIVERY',
      discountValue: 0,
      isActive:     true,
      startsAt:     new Date(Date.now() - 1000),
      endsAt:       new Date(Date.now() + 3600 * 1000)
    });
    expect(promo.calculateDiscount(100)).toBe(0);
    expect(promo.isCurrentlyActive()).toBe(true);
  });
});
