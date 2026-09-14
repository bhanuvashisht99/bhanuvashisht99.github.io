import { describe, test, expect } from 'vitest';
import { combinedModifier, DISCLAIMER, SUPPORTED_CONDITIONS } from '../conditions.js';

describe('combinedModifier', () => {
  test('no conditions -> neutral modifier, still carries the disclaimer', () => {
    const m = combinedModifier([]);
    expect(m.proteinFloorGPerKg).toBe(0);
    expect(m.fiberBonusG).toBe(0);
    expect(m.addedSugarCapG).toBe(Infinity);
    expect(m.maxMealGl).toBe(Infinity);
    expect(m.active).toEqual([]);
    expect(m.disclaimer).toBe(DISCLAIMER);
  });

  test('unknown conditions are ignored', () => {
    const m = combinedModifier(['made_up_thing']);
    expect(m.active).toEqual([]);
  });

  test('PCOS raises protein + fibre and caps added sugar', () => {
    const m = combinedModifier(['pcos']);
    expect(m.proteinFloorGPerKg).toBe(1.6);
    expect(m.fiberBonusG).toBe(5);
    expect(m.addedSugarCapG).toBe(25);
    expect(m.preferLowGi).toBe(true);
    expect(m.notes.length).toBeGreaterThan(0);
  });

  test('hypothyroid sets iodine and selenium floors and a levothyroxine note', () => {
    const m = combinedModifier(['hypothyroid']);
    expect(m.microFloors.iodine).toBe(150);
    expect(m.microFloors.selenium).toBe(55);
    expect(m.notes.join(' ')).toMatch(/levothyroxine/i);
  });

  test('type 2 diabetes gives the tightest per-meal glycemic-load ceiling', () => {
    const m = combinedModifier(['t2_diabetes', 'prediabetes']);
    expect(m.maxMealGl).toBe(15); // min(15, 18)
    expect(m.fiberBonusG).toBe(8); // max(8, 6)
  });

  test('combining conditions takes the tightest cap and loosest floor', () => {
    const m = combinedModifier(['pcos', 't2_diabetes', 'hypertension']);
    expect(m.addedSugarCapG).toBe(20); // min(25, 20)
    expect(m.sodiumCapMg).toBe(1800); // from hypertension
    expect(m.microFloors.potassium).toBe(3500);
    // emphasise list is de-duplicated
    expect(new Set(m.emphasise).size).toBe(m.emphasise.length);
  });

  test('every supported condition produces at least one note', () => {
    for (const c of SUPPORTED_CONDITIONS) {
      expect(combinedModifier([c]).notes.length).toBeGreaterThan(0);
    }
  });
});
