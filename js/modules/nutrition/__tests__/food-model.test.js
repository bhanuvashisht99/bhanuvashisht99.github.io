import { describe, test, expect } from 'vitest';
import {
  normalizeFood,
  scaleFood,
  sumNutrition,
  glycemicLoad,
} from '../food-model.js';
import { RAW_FOODS } from './fixtures.js';

const rawChicken = RAW_FOODS.find((f) => f.id === 'chicken');
const rawPaneer = RAW_FOODS.find((f) => f.id === 'paneer');

describe('normalizeFood', () => {
  test('keeps per-100g rows unchanged and maps fats -> fat', () => {
    const f = normalizeFood(rawChicken);
    expect(f.calories).toBe(165);
    expect(f.fat).toBe(3.6);
    expect(f.protein).toBe(31);
    expect(f.role).toBe('protein');
  });

  test('rescales rows whose serving is not 100', () => {
    const f = normalizeFood({ ...rawChicken, serving_amount: 200, calories: 330, protein: 62 });
    expect(f.calories).toBe(165);
    expect(f.protein).toBe(31);
  });

  test('defaults regions to universal', () => {
    const f = normalizeFood({ ...rawChicken, regions: [] });
    expect(f.regions).toEqual(['universal']);
  });

  test('carries micronutrients into the nutrients map', () => {
    const f = normalizeFood(rawPaneer);
    expect(f.nutrients.calcium).toBe(480);
    expect(f.nutrients.iodine).toBe(40);
  });
});

describe('scaleFood', () => {
  test('scales linearly with grams', () => {
    const f = normalizeFood(rawChicken);
    const c = scaleFood(f, 150);
    expect(c.calories).toBeCloseTo(247.5, 1);
    expect(c.protein).toBeCloseTo(46.5, 1);
    expect(c.iron).toBeCloseTo(1.5, 2);
  });

  test('zero grams contributes nothing', () => {
    const c = scaleFood(normalizeFood(rawChicken), 0);
    expect(c.calories).toBe(0);
    expect(c.calcium).toBe(0);
  });
});

describe('sumNutrition', () => {
  test('adds contributions and ignores nullish entries', () => {
    const f = normalizeFood(rawChicken);
    const total = sumNutrition(scaleFood(f, 100), null, scaleFood(f, 100));
    expect(total.protein).toBeCloseTo(62, 5);
  });
});

describe('glycemicLoad', () => {
  test('zero-GI foods have zero load', () => {
    expect(glycemicLoad(normalizeFood(rawChicken), 200)).toBe(0);
  });

  test('rice: GL uses GI * available carbs / 100', () => {
    const rice = normalizeFood(RAW_FOODS.find((f) => f.id === 'brown-rice'));
    // 150g -> carbs 35.25, fiber 2.7; available ~32.55; GL = 68 * 32.55 / 100 ≈ 22.1
    expect(glycemicLoad(rice, 150)).toBeGreaterThan(18);
    expect(glycemicLoad(rice, 150)).toBeLessThan(26);
  });
});
