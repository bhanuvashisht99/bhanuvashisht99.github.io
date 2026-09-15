/**
 * recipe-model.js — turn a DB recipe (joined to its ingredient foods) into a
 * plan-generator-compatible item list, scaled to a target calorie budget.
 *
 * Pure. Depends only on the normalised food shape from food-model.js.
 */

/**
 * Normalise a recipe row — as returned by supabase-client's `searchRecipes()`,
 * with `recipe_ingredients[].foods` joined — into the shape the plan generator
 * and recipe UI consume.
 *
 * Ingredients whose food isn't in `foodsById` are dropped rather than failing
 * the whole recipe (a food can be renamed/removed independently of the recipe
 * seed); a recipe left with zero ingredients can no longer be scaled
 * meaningfully and is rejected (returns null).
 *
 * @param {object} row - raw recipe row with `recipe_ingredients[]`
 * @param {Map<string, object>} foodsById - normalised foods (food-model.js), keyed by id
 * @returns {object|null}
 */
export function normalizeRecipe(row, foodsById) {
  if (!row) return null;
  const servings = Number(row.servings) > 0 ? Number(row.servings) : 1;
  const rawIngredients = row.recipe_ingredients ?? [];

  const ingredients = [];
  for (const ri of rawIngredients) {
    const foodId = ri.foods?.id ?? ri.food_id;
    const food = foodId ? foodsById.get(foodId) : null;
    if (!food || !(Number(ri.amount) > 0)) continue;
    ingredients.push({ food, foodId: food.id, gramsPerServing: Number(ri.amount) / servings });
  }
  if (!ingredients.length) return null;

  const caloriesPerServing =
    Number(row.calories) > 0
      ? Number(row.calories)
      : ingredients.reduce((sum, ing) => sum + (ing.food.calories * ing.gramsPerServing) / 100, 0);
  if (!(caloriesPerServing > 0)) return null;

  return {
    id: row.id,
    name: row.name,
    cuisine: row.cuisine ?? null,
    mealTypes: row.meal_types ?? [],
    dietaryTags: row.dietary_tags ?? [],
    allergens: row.allergens ?? [],
    servings,
    caloriesPerServing,
    ingredients,
  };
}

/**
 * True when every ingredient food in `recipe` is in `eligibleIds` — used to gate
 * a recipe on the user's diet/allergy/dislike filters without re-deriving that
 * logic here, since `eligibleFoods` has already run through `filterFoods()`.
 * @param {object} recipe
 * @param {Set<string>} eligibleIds
 */
export function recipeIsEligible(recipe, eligibleIds) {
  return !!recipe?.ingredients?.length && recipe.ingredients.every((ing) => eligibleIds.has(ing.foodId));
}

/**
 * Scale a recipe's ingredients to land on `kcalTarget`, as long as the required
 * scale stays within [minScale, maxScale] of one whole serving. Returns null
 * (rather than a wildly over/under-scaled plate) when the target is too far
 * from a sane multiple of the recipe's own serving size — the caller falls
 * back to building that meal from raw foods instead.
 *
 * @param {object} recipe - from normalizeRecipe()
 * @param {number} kcalTarget
 * @returns {{items: Array<{food:object, foodId:string, grams:number}>, scale:number}|null}
 */
export function scaleRecipeToTarget(recipe, kcalTarget, { minScale = 0.6, maxScale = 1.85 } = {}) {
  if (!(kcalTarget > 0) || !recipe?.ingredients?.length) return null;
  const scale = kcalTarget / recipe.caloriesPerServing;
  if (scale < minScale || scale > maxScale) return null;

  const items = recipe.ingredients.map((ing) => ({
    food: ing.food,
    foodId: ing.foodId,
    grams: Math.max(1, Math.round(ing.gramsPerServing * scale)),
  }));
  return { items, scale };
}

/** Recipe meal-type key ('breakfast'/'lunch'/'dinner'/'snack') for a plan slot. */
export function mealTypeForSlot(slotKey) {
  if (slotKey === 'second_dinner') return 'dinner';
  if (slotKey.startsWith('snack')) return 'snack';
  return slotKey; // breakfast | lunch | dinner
}
