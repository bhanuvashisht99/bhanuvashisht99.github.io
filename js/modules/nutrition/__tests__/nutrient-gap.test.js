import { describe, test, expect } from 'vitest';
import { analyseGaps, planDailyAverage, leanestDayIndex } from '../nutrient-gap.js';
import { normalizeFood } from '../food-model.js';
import { computeTargets } from '../targets.js';
import { RAW_FOODS } from './fixtures.js';

const FOODS = RAW_FOODS.map(normalizeFood);
const byId = (id) => FOODS.find((f) => f.id === id);

/** Build a trivial 7-day plan where every day is the same single meal. */
function planFrom(items) {
  return {
    seed: 1,
    days: Array.from({ length: 7 }, (_, i) => ({
      label: `D${i}`,
      index: i,
      locked: false,
      meals: [{ key: 'meal', title: 'Meal', kind: 'main', locked: false, items: items.map((x) => ({ ...x })) }],
    })),
  };
}

const targets = computeTargets({ calories: 2200, weightKg: 70, goal: 'maintain', age: 30, sex: 'female' });

describe('planDailyAverage', () => {
  test('averages the week by the number of days', () => {
    const plan = planFrom([{ food: byId('chicken'), foodId: 'chicken', grams: 100 }]);
    const avg = planDailyAverage(plan);
    expect(avg.calories).toBeCloseTo(165, 1);
    expect(avg.protein).toBeCloseTo(31, 1);
  });
});

describe('analyseGaps', () => {
  test('a chicken + rice only plan flags iron and calcium as critical for a woman', () => {
    const plan = planFrom([
      { food: byId('chicken'), foodId: 'chicken', grams: 200 },
      { food: byId('brown-rice'), foodId: 'brown-rice', grams: 200 },
    ]);
    const { gaps, blocking } = analyseGaps(plan, targets, FOODS);
    const names = gaps.map((g) => g.nutrient);
    expect(names).toContain('iron');
    expect(names).toContain('calcium');
    expect(blocking).toBe(true);
    const iron = gaps.find((g) => g.nutrient === 'iron');
    expect(iron.severity).toBe('critical');
    expect(iron.remedyFoods.length).toBeGreaterThan(0);
    expect(iron.leanestDay).toBeGreaterThanOrEqual(0);
  });

  test('acknowledging a critical nutrient downgrades it and unblocks', () => {
    const plan = planFrom([{ food: byId('chicken'), foodId: 'chicken', grams: 150 }]);
    const first = analyseGaps(plan, targets, FOODS);
    expect(first.blocking).toBe(true);
    const criticalNames = first.gaps.filter((g) => g.severity === 'critical').map((g) => g.nutrient);
    const second = analyseGaps(plan, targets, FOODS, { acknowledgedNutrients: criticalNames });
    expect(second.blocking).toBe(false);
  });

  test('a balanced plan has no blocking gaps', () => {
    const plan = planFrom([
      { food: byId('salmon'), foodId: 'salmon', grams: 150 },
      { food: byId('lentils'), foodId: 'lentils', grams: 200 },
      { food: byId('spinach'), foodId: 'spinach', grams: 150 },
      { food: byId('greek-yogurt'), foodId: 'greek-yogurt', grams: 200 },
      { food: byId('oats'), foodId: 'oats', grams: 80 },
      { food: byId('almonds'), foodId: 'almonds', grams: 30 },
      { food: byId('broccoli'), foodId: 'broccoli', grams: 150 },
      { food: byId('banana'), foodId: 'banana', grams: 120 },
    ]);
    const { blocking } = analyseGaps(plan, targets, FOODS);
    expect(blocking).toBe(false);
  });

  test('vitamin D shortfall is advisory, never blocking, with a supplement note', () => {
    const plan = planFrom([{ food: byId('chicken'), foodId: 'chicken', grams: 150 }]);
    const { gaps } = analyseGaps(plan, targets, FOODS, {
      acknowledgedNutrients: ['iron', 'calcium', 'vitamin_b12', 'folate', 'potassium', 'iodine', 'protein', 'fiber'],
    });
    const vitD = gaps.find((g) => g.nutrient === 'vitamin_d');
    expect(vitD).toBeTruthy();
    expect(vitD.severity).not.toBe('critical');
    expect(vitD.message.toLowerCase()).toMatch(/supplement|sunlight/);
  });

  test('excess sodium is reported but never blocking', () => {
    // otherwise-balanced plan, made salt-heavy with a big serve of bread
    const plan = planFrom([
      { food: byId('salmon'), foodId: 'salmon', grams: 150 },
      { food: byId('lentils'), foodId: 'lentils', grams: 200 },
      { food: byId('spinach'), foodId: 'spinach', grams: 150 },
      { food: byId('greek-yogurt'), foodId: 'greek-yogurt', grams: 200 },
      { food: byId('oats'), foodId: 'oats', grams: 80 },
      { food: byId('almonds'), foodId: 'almonds', grams: 30 },
      { food: byId('broccoli'), foodId: 'broccoli', grams: 150 },
      { food: byId('banana'), foodId: 'banana', grams: 120 },
      { food: byId('white-bread'), foodId: 'white-bread', grams: 500 },
    ]);
    const { gaps, blocking } = analyseGaps(plan, targets, FOODS);
    const sodium = gaps.find((g) => g.nutrient === 'sodium');
    expect(sodium?.severity).toBe('excess');
    expect(blocking).toBe(false);
  });
});

describe('leanestDayIndex', () => {
  test('points at the day carrying the least of a nutrient', () => {
    const plan = planFrom([{ food: byId('chicken'), foodId: 'chicken', grams: 100 }]);
    plan.days[3].meals[0].items.push({ food: byId('spinach'), foodId: 'spinach', grams: 300 });
    // day 3 now has lots of iron; the leanest should be any other day
    expect(leanestDayIndex(plan, 'iron')).not.toBe(3);
  });
});
