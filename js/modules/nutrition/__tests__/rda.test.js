import { describe, test, expect } from 'vitest';
import {
  referenceIntake,
  micronutrientReferenceSet,
  substanceCaps,
  MICRONUTRIENTS,
} from '../rda.js';

describe('referenceIntake', () => {
  test('iron: menstruating women need much more than men', () => {
    expect(referenceIntake('iron', { age: 30, sex: 'female' })).toBe(18);
    expect(referenceIntake('iron', { age: 30, sex: 'male' })).toBe(8);
  });

  test('iron: post-menopausal women drop to 8mg', () => {
    expect(referenceIntake('iron', { age: 60, sex: 'female' })).toBe(8);
    expect(referenceIntake('iron', { age: 40, sex: 'female', menstruating: false })).toBe(8);
  });

  test('iron: pregnancy overrides to 27mg', () => {
    expect(referenceIntake('iron', { age: 30, sex: 'female', pregnant: true })).toBe(27);
  });

  test('calcium rises for older adults', () => {
    expect(referenceIntake('calcium', { age: 30, sex: 'female' })).toBe(1000);
    expect(referenceIntake('calcium', { age: 65, sex: 'female' })).toBe(1200);
  });

  test('vitamin D rises at 71+', () => {
    expect(referenceIntake('vitamin_d', { age: 40, sex: 'male' })).toBe(15);
    expect(referenceIntake('vitamin_d', { age: 75, sex: 'male' })).toBe(20);
  });

  test("sex 'other' takes the higher reference so we never under-target", () => {
    expect(referenceIntake('iron', { age: 30, sex: 'other' })).toBe(18);
    expect(referenceIntake('magnesium', { age: 30, sex: 'other' })).toBe(400);
  });

  test('folate bumps to 600 in pregnancy', () => {
    expect(referenceIntake('folate', { age: 30, sex: 'female', pregnant: true })).toBe(600);
  });

  test('throws on an unknown nutrient', () => {
    expect(() => referenceIntake('unobtanium', { age: 30, sex: 'male' })).toThrow();
  });
});

describe('micronutrientReferenceSet', () => {
  test('covers every tracked micronutrient with a positive number', () => {
    const set = micronutrientReferenceSet({ age: 30, sex: 'female' });
    for (const n of MICRONUTRIENTS) {
      expect(set[n]).toBeGreaterThan(0);
    }
  });
});

describe('substanceCaps', () => {
  test('added sugar and saturated fat scale with calories', () => {
    const lo = substanceCaps(1600);
    const hi = substanceCaps(2800);
    expect(hi.added_sugar).toBeGreaterThan(lo.added_sugar);
    expect(hi.saturated_fat).toBeGreaterThan(lo.saturated_fat);
    expect(lo.sodium).toBe(2300);
  });

  test('2000 kcal -> 50g added sugar cap (10% of energy / 4)', () => {
    expect(substanceCaps(2000).added_sugar).toBe(50);
  });

  test('falls back to 2000 kcal when called with nothing', () => {
    expect(substanceCaps().added_sugar).toBe(50);
  });
});
