import { describe, test, expect } from 'vitest';
import { normalizeRecipe, recipeIsEligible, scaleRecipeToTarget, mealTypeForSlot } from '../recipe-model.js';
import { normalizeFood } from '../food-model.js';
import { RAW_FOODS } from './fixtures.js';

const FOODS = RAW_FOODS.map(normalizeFood);
const foodsById = new Map(FOODS.map((f) => [f.id, f]));

const CHICKEN_RICE_ROW = {
  id: 'recipe-1',
  name: 'Chicken & Rice',
  cuisine: 'universal',
  meal_types: ['lunch', 'dinner'],
  dietary_tags: ['gluten_free', 'dairy_free'],
  allergens: [],
  servings: 2,
  calories: 380, // per serving, as stored on the recipe row
  recipe_ingredients: [
    { amount: 300, unit: 'g', foods: { id: 'chicken', name: 'Chicken Breast', category: 'protein' } },
    { amount: 400, unit: 'g', foods: { id: 'brown-rice', name: 'Brown Rice (cooked)', category: 'grain' } },
    { amount: 200, unit: 'g', foods: { id: 'broccoli', name: 'Broccoli', category: 'vegetable' } },
  ],
};

describe('normalizeRecipe', () => {
  test('divides ingredient amounts down to per-serving grams', () => {
    const recipe = normalizeRecipe(CHICKEN_RICE_ROW, foodsById);
    const chicken = recipe.ingredients.find((i) => i.foodId === 'chicken');
    expect(chicken.gramsPerServing).toBe(150); // 300g / 2 servings
  });

  test('drops ingredients whose food is missing from foodsById', () => {
    const row = {
      ...CHICKEN_RICE_ROW,
      recipe_ingredients: [
        ...CHICKEN_RICE_ROW.recipe_ingredients,
        { amount: 50, unit: 'g', foods: { id: 'not-a-real-food', name: 'Ghost Ingredient' } },
      ],
    };
    const recipe = normalizeRecipe(row, foodsById);
    expect(recipe.ingredients.some((i) => i.foodId === 'not-a-real-food')).toBe(false);
    expect(recipe.ingredients.length).toBe(3);
  });

  test('returns null when every ingredient food is missing', () => {
    const row = {
      ...CHICKEN_RICE_ROW,
      recipe_ingredients: [{ amount: 50, unit: 'g', foods: { id: 'ghost', name: 'Ghost' } }],
    };
    expect(normalizeRecipe(row, foodsById)).toBeNull();
  });

  test('falls back to computing calories from ingredients when the row has none', () => {
    const row = { ...CHICKEN_RICE_ROW, calories: null };
    const recipe = normalizeRecipe(row, foodsById);
    expect(recipe.caloriesPerServing).toBeGreaterThan(0);
  });

  test('returns null for a null row', () => {
    expect(normalizeRecipe(null, foodsById)).toBeNull();
  });
});

describe('recipeIsEligible', () => {
  test('true when every ingredient food is in the eligible set', () => {
    const recipe = normalizeRecipe(CHICKEN_RICE_ROW, foodsById);
    const eligibleIds = new Set(['chicken', 'brown-rice', 'broccoli', 'spinach']);
    expect(recipeIsEligible(recipe, eligibleIds)).toBe(true);
  });

  test('false when one ingredient food was filtered out (e.g. an allergen)', () => {
    const recipe = normalizeRecipe(CHICKEN_RICE_ROW, foodsById);
    const eligibleIds = new Set(['chicken', 'brown-rice']); // broccoli missing
    expect(recipeIsEligible(recipe, eligibleIds)).toBe(false);
  });
});

describe('scaleRecipeToTarget', () => {
  test('scales every ingredient by the same factor to hit the target calories', () => {
    const recipe = normalizeRecipe(CHICKEN_RICE_ROW, foodsById);
    const { items, scale } = scaleRecipeToTarget(recipe, 380); // exactly one serving
    expect(scale).toBeCloseTo(1, 5);
    const chicken = items.find((i) => i.foodId === 'chicken');
    expect(chicken.grams).toBe(150);
  });

  test('returns null when the target is far below a sane fraction of a serving', () => {
    const recipe = normalizeRecipe(CHICKEN_RICE_ROW, foodsById);
    expect(scaleRecipeToTarget(recipe, 50)).toBeNull(); // scale ~0.13, below default minScale
  });

  test('returns null when the target is far above a sane multiple of a serving', () => {
    const recipe = normalizeRecipe(CHICKEN_RICE_ROW, foodsById);
    expect(scaleRecipeToTarget(recipe, 5000)).toBeNull(); // scale ~13, above default maxScale
  });

  test('respects a custom scale window', () => {
    const recipe = normalizeRecipe(CHICKEN_RICE_ROW, foodsById);
    expect(scaleRecipeToTarget(recipe, 760, { minScale: 0.5, maxScale: 3 })).not.toBeNull();
  });

  test('returns null for a zero or negative target', () => {
    const recipe = normalizeRecipe(CHICKEN_RICE_ROW, foodsById);
    expect(scaleRecipeToTarget(recipe, 0)).toBeNull();
  });
});

describe('mealTypeForSlot', () => {
  test('maps second_dinner to dinner', () => {
    expect(mealTypeForSlot('second_dinner')).toBe('dinner');
  });
  test('maps any snackN slot to snack', () => {
    expect(mealTypeForSlot('snack1')).toBe('snack');
    expect(mealTypeForSlot('snack2')).toBe('snack');
  });
  test('passes breakfast/lunch/dinner through unchanged', () => {
    expect(mealTypeForSlot('breakfast')).toBe('breakfast');
    expect(mealTypeForSlot('lunch')).toBe('lunch');
    expect(mealTypeForSlot('dinner')).toBe('dinner');
  });
});
