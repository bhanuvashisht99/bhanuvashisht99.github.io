import { describe, test, expect } from 'vitest';
import { filterFoods, nutrientDensity, remedyFoods } from '../food-filter.js';
import { normalizeFood } from '../food-model.js';
import { RAW_FOODS } from './fixtures.js';

const FOODS = RAW_FOODS.map(normalizeFood);
const ids = (list) => list.map((f) => f.id).sort();

describe('filterFoods', () => {
  test('omnivore with no prefs keeps everything', () => {
    expect(filterFoods(FOODS, { dietPattern: 'omnivore' }).length).toBe(FOODS.length);
  });

  test('excludes disliked foods', () => {
    const out = filterFoods(FOODS, { dislikedFoodIds: ['paneer', 'banana'] });
    expect(out.find((f) => f.id === 'paneer')).toBeUndefined();
    expect(out.find((f) => f.id === 'banana')).toBeUndefined();
  });

  test('nut allergy removes almonds', () => {
    const out = filterFoods(FOODS, { allergies: ['nuts'] });
    expect(out.find((f) => f.id === 'almonds')).toBeUndefined();
  });

  test('dairy allergy removes paneer and yogurt', () => {
    const out = filterFoods(FOODS, { allergies: ['dairy'] });
    expect(ids(out)).not.toContain('paneer');
    expect(ids(out)).not.toContain('greek-yogurt');
  });

  test('vegetarian removes chicken and salmon but keeps paneer, lentils', () => {
    const out = filterFoods(FOODS, { dietPattern: 'vegetarian' });
    expect(ids(out)).not.toContain('chicken');
    expect(ids(out)).not.toContain('salmon');
    expect(ids(out)).toContain('paneer');
    expect(ids(out)).toContain('lentils');
  });

  test('vegan removes all animal foods', () => {
    const out = filterFoods(FOODS, { dietPattern: 'vegan' });
    for (const id of ['chicken', 'salmon', 'paneer', 'greek-yogurt']) {
      expect(ids(out)).not.toContain(id);
    }
    expect(ids(out)).toContain('lentils');
  });

  test('pescatarian keeps fish, drops chicken', () => {
    const out = filterFoods(FOODS, { dietPattern: 'pescatarian' });
    expect(ids(out)).toContain('salmon');
    expect(ids(out)).not.toContain('chicken');
  });

  test('region filter keeps universal + matching region only', () => {
    const out = filterFoods(FOODS, { regions: ['indian'] });
    expect(ids(out)).toContain('lentils'); // indian
    expect(ids(out)).toContain('paneer'); // indian
    expect(ids(out)).toContain('chicken'); // universal
    expect(ids(out)).not.toContain('white-bread'); // western only
  });

  test('allRegions overrides the region filter', () => {
    const out = filterFoods(FOODS, { regions: ['indian'], allRegions: true });
    expect(ids(out)).toContain('white-bread');
  });
});

describe('nutrientDensity', () => {
  test('spinach is far more iron-dense per calorie than chicken', () => {
    const spinach = FOODS.find((f) => f.id === 'spinach');
    const chicken = FOODS.find((f) => f.id === 'chicken');
    expect(nutrientDensity(spinach, 'iron')).toBeGreaterThan(nutrientDensity(chicken, 'iron'));
  });

  test('protein density works off the macro field', () => {
    const chicken = FOODS.find((f) => f.id === 'chicken');
    // 31g / 165 kcal * 100 ≈ 18.8
    expect(nutrientDensity(chicken, 'protein')).toBeGreaterThan(15);
  });
});

describe('remedyFoods', () => {
  test('iron remedies are ordered by density and limited', () => {
    const out = remedyFoods(FOODS, 'iron', { limit: 3 });
    expect(out.length).toBe(3);
    expect(out[0].id).toBe('spinach'); // most iron-dense in the fixture set
  });

  test('calcium remedies surface dairy / greens', () => {
    const out = remedyFoods(FOODS, 'calcium', { limit: 3 });
    const names = out.map((f) => f.id);
    expect(names.some((n) => ['paneer', 'greek-yogurt', 'almonds', 'spinach'].includes(n))).toBe(true);
  });

  test('caps foods per category to keep the list varied', () => {
    const out = remedyFoods(FOODS, 'protein', { limit: 6 });
    const perCat = {};
    for (const f of out) perCat[f.category] = (perCat[f.category] ?? 0) + 1;
    for (const c of Object.values(perCat)) expect(c).toBeLessThanOrEqual(2);
  });
});
