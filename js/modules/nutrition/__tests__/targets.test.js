import { describe, test, expect } from 'vitest';
import { computeTargets } from '../targets.js';
import { MICRONUTRIENTS } from '../rda.js';

const base = { calories: 2400, weightKg: 70, goal: 'maintain', age: 30, sex: 'male' };

describe('computeTargets', () => {
  test('macros roughly reconstruct the calorie budget', () => {
    const t = computeTargets(base);
    const kcal = t.protein * 4 + t.carbs * 4 + t.fat * 9;
    expect(Math.abs(kcal - 2400)).toBeLessThan(60);
  });

  test('protein tracks goal: cut and gain are higher than maintain', () => {
    const maintain = computeTargets({ ...base, goal: 'maintain' }).protein;
    const cut = computeTargets({ ...base, goal: 'lose_weight' }).protein;
    const gain = computeTargets({ ...base, goal: 'gain_muscle' }).protein;
    expect(cut).toBeGreaterThan(maintain);
    expect(gain).toBeGreaterThan(maintain);
  });

  test('protein never exceeds 2.4 g/kg', () => {
    const t = computeTargets({ ...base, goal: 'gain_muscle', conditions: ['pcos'] });
    expect(t.protein).toBeLessThanOrEqual(Math.round(2.4 * 70));
  });

  test('fat respects the 0.8 g/kg floor even on a low calorie target', () => {
    const t = computeTargets({ ...base, calories: 1400 });
    expect(t.fat).toBeGreaterThanOrEqual(Math.round(0.8 * 70) - 10);
  });

  test('fibre: ~14g per 1000 kcal, above the male minimum', () => {
    const t = computeTargets(base);
    expect(t.fiber).toBeGreaterThanOrEqual(30);
    expect(t.fiber).toBeGreaterThanOrEqual(Math.round(2.4 * 14));
  });

  test('condition bonuses raise the fibre target', () => {
    const plain = computeTargets(base).fiber;
    const withT2d = computeTargets({ ...base, conditions: ['t2_diabetes'] }).fiber;
    expect(withT2d - plain).toBe(8);
  });

  test('micronutrient snapshot covers every tracked nutrient', () => {
    const t = computeTargets({ ...base, sex: 'female' });
    for (const n of MICRONUTRIENTS) expect(t.micronutrients[n]).toBeGreaterThan(0);
  });

  test('hypothyroid raises the iodine + selenium targets', () => {
    const plain = computeTargets(base);
    const thyroid = computeTargets({ ...base, conditions: ['hypothyroid'] });
    expect(thyroid.micronutrients.iodine).toBeGreaterThanOrEqual(plain.micronutrients.iodine);
    expect(thyroid.micronutrients.selenium).toBeGreaterThanOrEqual(55);
  });

  test('hypertension tightens the sodium cap below the default', () => {
    const plain = computeTargets(base);
    const htn = computeTargets({ ...base, conditions: ['hypertension'] });
    expect(htn.caps.sodium).toBeLessThan(plain.caps.sodium);
    expect(htn.caps.sodium).toBe(1800);
  });

  test('meal rules flow through from conditions', () => {
    const t = computeTargets({ ...base, conditions: ['t2_diabetes'] });
    expect(t.mealRules.preferLowGi).toBe(true);
    expect(t.mealRules.maxMealGl).toBe(15);
  });

  test('throws without a weight', () => {
    expect(() => computeTargets({ ...base, weightKg: 0 })).toThrow();
  });
});
