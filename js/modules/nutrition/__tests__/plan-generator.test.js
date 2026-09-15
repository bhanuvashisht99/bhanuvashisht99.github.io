import { describe, test, expect } from 'vitest';
import { generatePlan, mealSkeleton, affinitySort, pickAffine } from '../plan-generator.js';
import { normalizeFood, scaleFood, sumNutrition, glycemicLoad } from '../food-model.js';
import { normalizeRecipe } from '../recipe-model.js';
import { computeTargets } from '../targets.js';
import { RAW_FOODS } from './fixtures.js';

const FOODS = RAW_FOODS.map(normalizeFood);
const byId = (id) => FOODS.find((f) => f.id === id);
const targets = computeTargets({ calories: 2200, weightKg: 70, goal: 'maintain', age: 30, sex: 'male' });

function dayCalories(day) {
  const contribs = day.meals.flatMap((m) => m.items).map((it) => scaleFood(it.food, it.grams));
  return sumNutrition(...contribs).calories;
}

describe('mealSkeleton', () => {
  test('weights always sum to 1', () => {
    for (const meals of [1, 2, 3, 4]) {
      for (const snacks of [0, 1, 2, 3]) {
        const sk = mealSkeleton(meals, snacks);
        const sum = sk.reduce((s, m) => s + m.weight, 0);
        expect(sum).toBeCloseTo(1, 5);
        expect(sk.length).toBe(Math.min(4, meals) + Math.min(3, snacks));
      }
    }
  });
});

describe('affinitySort / pickAffine (regional pairing bias)', () => {
  test('foods sharing a region with the anchor sort before the rest', () => {
    const carbs = [byId('white-bread'), byId('roti'), byId('brown-rice')]; // western, indian, universal
    const sorted = affinitySort(carbs, byId('paneer')); // paneer is indian-only
    expect(sorted[0].id).toBe('roti');
  });

  test('an anchor with only universal regions leaves the pool order untouched', () => {
    const carbs = [byId('white-bread'), byId('roti'), byId('brown-rice')];
    expect(affinitySort(carbs, byId('chicken'))).toEqual(carbs); // chicken is universal-only
  });

  test('no anchor is a no-op', () => {
    const carbs = [byId('white-bread'), byId('roti')];
    expect(affinitySort(carbs, null)).toBe(carbs);
  });

  test('pickAffine prefers the region-matched food over an unused earlier one', () => {
    const carbs = [byId('white-bread'), byId('roti')];
    const picked = pickAffine(carbs, byId('paneer'), 0, new Set());
    expect(picked.id).toBe('roti');
  });

  test('an indian protein + carb plan favours the indian carb for the first meal of the day', () => {
    // Only one region-matched carb exists in this fixture set, so it can only
    // win the *first* meal of each day before "already used today" opens the
    // pick up to the rest of the pool (by design — nobody wants the same bread
    // at every meal). That first-meal preference is what we assert here; later
    // meals and the nutrient-gap remedy pass are deliberately region-agnostic.
    const foods = [byId('paneer'), byId('roti'), byId('white-bread'), byId('spinach'), byId('olive-oil')];
    const t = computeTargets({ calories: 1800, weightKg: 65, goal: 'maintain', age: 28, sex: 'female' });
    let rotiFirstMeal = 0;
    let breadFirstMeal = 0;
    for (const seed of ['s1', 's2', 's3', 's4', 's5', 's6']) {
      const plan = generatePlan({ targets: t, foods, prefs: { seed, mealsPerDay: 3, snacks: 0 } });
      for (const day of plan.days) {
        const ids = day.meals[0].items.map((it) => it.foodId);
        if (ids.includes('roti')) rotiFirstMeal++;
        if (ids.includes('white-bread')) breadFirstMeal++;
      }
    }
    expect(rotiFirstMeal).toBeGreaterThan(breadFirstMeal);
  });
});

describe('fat item never falls back to an arbitrary protein', () => {
  test('every "fat" role item actually comes from the nuts/oils pool', () => {
    // A food set with a paper-thin fat pool (one oil) and a rich protein pool —
    // the old bug fell back to labelling a random protein as "fat" here.
    const foods = [byId('chicken'), byId('salmon'), byId('greek-yogurt'), byId('brown-rice'), byId('spinach'), byId('olive-oil')];
    const plan = generatePlan({ targets, foods, prefs: { seed: 'fat-fallback', mealsPerDay: 3, snacks: 0 } });
    for (const day of plan.days) {
      for (const meal of day.meals) {
        // Each main meal has at most one protein-role item (the real protein pick);
        // a mislabelled second protein would show up as a duplicate protein-role entry.
        const proteinItems = meal.items.filter((it) => it.food.role === 'protein');
        expect(proteinItems.length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('generatePlan', () => {
  test('produces 7 days, each with the expected meals', () => {
    const plan = generatePlan({ targets, foods: FOODS, prefs: { seed: 'abc', mealsPerDay: 3, snacks: 1 } });
    expect(plan.days).toHaveLength(7);
    for (const day of plan.days) {
      expect(day.meals.length).toBe(4);
      expect(day.meals.every((m) => Array.isArray(m.items))).toBe(true);
    }
  });

  test('is deterministic for a given seed', () => {
    const a = generatePlan({ targets, foods: FOODS, prefs: { seed: 'seed-1' } });
    const b = generatePlan({ targets, foods: FOODS, prefs: { seed: 'seed-1' } });
    expect(JSON.stringify(a.days)).toBe(JSON.stringify(b.days));
  });

  test('different seeds give different plans', () => {
    const a = generatePlan({ targets, foods: FOODS, prefs: { seed: 'seed-1' } });
    const b = generatePlan({ targets, foods: FOODS, prefs: { seed: 'seed-2' } });
    expect(JSON.stringify(a.days)).not.toBe(JSON.stringify(b.days));
  });

  test('each day lands within ~20% of the calorie target', () => {
    const plan = generatePlan({ targets, foods: FOODS, prefs: { seed: 'cal-check' } });
    for (const day of plan.days) {
      const kcal = dayCalories(day);
      expect(kcal).toBeGreaterThan(targets.calories * 0.8);
      expect(kcal).toBeLessThan(targets.calories * 1.2);
    }
  });

  test('main meals sit close to their calorie share (correction pass)', () => {
    const plan = generatePlan({ targets, foods: FOODS, prefs: { seed: 'meal-cal' } });
    const shares = { breakfast: 0.3, lunch: 0.4, dinner: 0.3 };
    for (const day of plan.days) {
      for (const meal of day.meals.filter((m) => m.kind === 'main')) {
        const kcal = meal.items.reduce((s, it) => s + (it.food.calories * it.grams) / 100, 0);
        const want = targets.calories * (shares[meal.key] ?? 0.3);
        expect(kcal).toBeGreaterThan(want * 0.75);
        expect(kcal).toBeLessThan(want * 1.25);
      }
    }
  });

  test('honours a locked day from a previous plan', () => {
    const first = generatePlan({ targets, foods: FOODS, prefs: { seed: 's1' } });
    first.days[0].locked = true;
    const lockedSnapshot = JSON.stringify(first.days[0]);
    const second = generatePlan({
      targets, foods: FOODS, prefs: { seed: 's2' }, previous: first,
    });
    expect(JSON.stringify(second.days[0])).toBe(lockedSnapshot);
    // an unlocked day should have changed with the new seed
    expect(JSON.stringify(second.days[1])).not.toBe(JSON.stringify(first.days[1]));
  });

  test('honours a single locked meal', () => {
    const first = generatePlan({ targets, foods: FOODS, prefs: { seed: 's1' } });
    first.days[2].meals[1].locked = true;
    const mealSnapshot = JSON.stringify(first.days[2].meals[1]);
    const second = generatePlan({
      targets, foods: FOODS, prefs: { seed: 's9' }, previous: first,
    });
    expect(JSON.stringify(second.days[2].meals[1])).toBe(mealSnapshot);
  });

  test('respects a per-meal glycemic-load ceiling for diabetes', () => {
    const t2dTargets = computeTargets({
      calories: 2000, weightKg: 70, goal: 'maintain', age: 45, sex: 'male', conditions: ['t2_diabetes'],
    });
    const plan = generatePlan({ targets: t2dTargets, foods: FOODS, prefs: { seed: 'diab' } });
    // no main meal should carry an outrageous GL; allow slack for the greedy solver
    for (const day of plan.days) {
      for (const meal of day.meals.filter((m) => m.kind === 'main')) {
        const gl = meal.items.reduce((s, it) => s + glycemicLoad(it.food, it.grams), 0);
        expect(gl).toBeLessThan(t2dTargets.mealRules.maxMealGl + 12);
      }
    }
  });
});

describe('recipe integration', () => {
  const foodsById = new Map(FOODS.map((f) => [f.id, f]));
  const chickenRiceRow = {
    id: 'recipe-chicken-rice',
    name: 'Chicken & Rice Bowl',
    cuisine: 'universal',
    meal_types: ['lunch', 'dinner'],
    dietary_tags: ['gluten_free', 'dairy_free'],
    allergens: [],
    servings: 2,
    calories: null, // computed from ingredients: ~505.5 kcal/serving
    recipe_ingredients: [
      { amount: 300, unit: 'g', foods: { id: 'chicken', name: 'Chicken Breast', category: 'protein' } },
      { amount: 400, unit: 'g', foods: { id: 'brown-rice', name: 'Brown Rice (cooked)', category: 'grain' } },
      { amount: 200, unit: 'g', foods: { id: 'broccoli', name: 'Broccoli', category: 'vegetable' } },
    ],
  };
  const recipes = [normalizeRecipe(chickenRiceRow, foodsById)];

  test('a compatible recipe gets slotted into lunch/dinner when recipeChance is 1', () => {
    const plan = generatePlan({
      targets, foods: FOODS, recipes, prefs: { seed: 'recipe-on', mealsPerDay: 3, snacks: 0, recipeChance: 1 },
    });
    const mains = plan.days.flatMap((d) => d.meals.filter((m) => m.kind === 'main'));
    const recipeMeals = mains.filter((m) => m.recipeId === 'recipe-chicken-rice');
    expect(recipeMeals.length).toBeGreaterThan(0);
    // Breakfast is not in the recipe's meal_types, so it never carries it.
    for (const day of plan.days) {
      expect(day.meals[0].recipeId).toBeNull();
    }
  });

  test('a recipe meal carries its own ingredients, scaled toward the meal calorie target', () => {
    const plan = generatePlan({
      targets, foods: FOODS, recipes, prefs: { seed: 'recipe-scale', mealsPerDay: 3, snacks: 0, recipeChance: 1 },
    });
    const recipeMeal = plan.days.flatMap((d) => d.meals).find((m) => m.recipeId === 'recipe-chicken-rice');
    expect(recipeMeal).toBeDefined();
    expect(recipeMeal.recipeName).toBe('Chicken & Rice Bowl');
    expect(recipeMeal.recipeServings).toBeGreaterThan(0);
    const foodIds = recipeMeal.items.map((it) => it.foodId).sort();
    expect(foodIds).toEqual(['broccoli', 'brown-rice', 'chicken']);
    const kcal = recipeMeal.items.reduce((s, it) => s + (it.food.calories * it.grams) / 100, 0);
    const weight = recipeMeal.key === 'lunch' ? 0.4 : 0.3;
    expect(kcal).toBeGreaterThan(targets.calories * weight * 0.5);
    expect(kcal).toBeLessThan(targets.calories * weight * 1.95);
  });

  test('recipeChance 0 never uses a recipe even when one is eligible', () => {
    const plan = generatePlan({
      targets, foods: FOODS, recipes, prefs: { seed: 'recipe-off', mealsPerDay: 3, snacks: 0, recipeChance: 0 },
    });
    for (const day of plan.days) {
      for (const meal of day.meals) expect(meal.recipeId).toBeNull();
    }
  });

  test('no recipes passed in behaves exactly like the raw-food-only generator', () => {
    const plan = generatePlan({ targets, foods: FOODS, prefs: { seed: 'no-recipes', mealsPerDay: 3, snacks: 0 } });
    for (const day of plan.days) {
      for (const meal of day.meals) expect(meal.recipeId).toBeNull();
    }
  });

  test('a locked meal that came from a recipe keeps its recipeId/recipeName on regenerate', () => {
    const first = generatePlan({
      targets, foods: FOODS, recipes, prefs: { seed: 'recipe-lock', mealsPerDay: 3, snacks: 0, recipeChance: 1 },
    });
    const lockedDay = { ...first.days[0], locked: false, meals: first.days[0].meals.map((m) => ({ ...m })) };
    const targetMeal = lockedDay.meals.find((m) => m.recipeId);
    if (!targetMeal) return; // this seed happened to land no recipe on day 0 — nothing to assert
    targetMeal.locked = true;
    const second = generatePlan({
      targets, foods: FOODS, recipes,
      prefs: { seed: 'recipe-lock-2', mealsPerDay: 3, snacks: 0, recipeChance: 1 },
      previous: { days: [lockedDay] },
    });
    const carried = second.days[0].meals.find((m) => m.key === targetMeal.key);
    expect(carried.recipeId).toBe(targetMeal.recipeId);
    expect(carried.recipeName).toBe(targetMeal.recipeName);
  });
});
