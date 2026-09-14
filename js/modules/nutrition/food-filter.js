/**
 * food-filter.js — narrow a candidate food list to what a given user can and
 * will eat, and rank foods by how efficiently they deliver a nutrient.
 *
 * Works on normalised foods (see food-model.js). Pure. No DOM, no async.
 */

import { MICRONUTRIENTS } from './rda.js';

// Dietary pattern -> allergen/tag rules.
const DIET_FORBIDS_ALLERGENS = {
  vegan: ['dairy', 'eggs', 'fish', 'shellfish'],
  vegetarian: ['fish', 'shellfish'],
  eggetarian: ['fish', 'shellfish'],
  pescatarian: [],
  omnivore: [],
};
// Categories a diet excludes outright.
const DIET_FORBIDS_CATEGORY = {
  vegan: [],
  vegetarian: ['protein'], // animal-flesh proteins; dairy/legumes still ok
  eggetarian: ['protein'],
  pescatarian: [],
  omnivore: [],
};
// Explicit non-vegetarian flesh detector: category 'protein' without a
// vegetarian/vegan dietary tag and without being dairy/legume.
function isAnimalFlesh(food) {
  if (food.category !== 'protein') return false;
  return !food.dietaryTags.includes('vegetarian') && !food.dietaryTags.includes('vegan');
}

/**
 * @param {object[]} foods - normalised foods
 * @param {object} prefs
 * @param {string} prefs.dietPattern - 'omnivore'|'vegetarian'|'vegan'|'pescatarian'|'eggetarian'
 * @param {string[]} prefs.allergies - allergen keys to exclude
 * @param {string[]} prefs.intolerances - allergen keys to exclude
 * @param {string[]} prefs.dislikedFoodIds - food ids the user rejected
 * @param {string[]} prefs.regions - preferred region keys; [] = no region filter
 * @param {boolean} [prefs.allRegions] - ignore region filter
 * @param {object} [prefs.mealRules] - { preferLowGi, maxMealGl } (soft, not a hard filter here)
 * @returns {object[]} filtered foods
 */
export function filterFoods(foods, prefs = {}) {
  const {
    dietPattern = 'omnivore',
    allergies = [],
    intolerances = [],
    dislikedFoodIds = [],
    regions = [],
    allRegions = false,
  } = prefs;

  const banned = new Set([
    ...allergies,
    ...intolerances,
    ...(DIET_FORBIDS_ALLERGENS[dietPattern] ?? []),
  ]);
  const bannedCategories = new Set(DIET_FORBIDS_CATEGORY[dietPattern] ?? []);
  const disliked = new Set(dislikedFoodIds);
  const regionSet = new Set(regions);

  return foods.filter((food) => {
    if (disliked.has(food.id)) return false;
    if (food.allergens.some((a) => banned.has(a))) return false;

    if (dietPattern === 'vegan' && !food.dietaryTags.includes('vegan')) {
      // vegan requires an explicit tag OR a plainly plant category
      if (!['vegetable', 'fruit', 'grain', 'legumes', 'nuts', 'oils'].includes(food.category)) {
        return false;
      }
    }
    if (bannedCategories.has(food.role) && isAnimalFlesh(food)) return false;
    if ((dietPattern === 'vegetarian' || dietPattern === 'eggetarian') && isAnimalFlesh(food)) {
      return false;
    }
    if (dietPattern === 'pescatarian' && isAnimalFlesh(food)) {
      const isSeafood =
        food.allergens.includes('fish') || food.allergens.includes('shellfish');
      if (!isSeafood) return false;
    }

    if (!allRegions && regionSet.size > 0) {
      if (food.regions.includes('universal')) return true;
      if (!food.regions.some((r) => regionSet.has(r))) return false;
    }
    return true;
  });
}

/**
 * Amount of `nutrient` per 100 kcal of a food — the density the gap engine
 * uses to pick efficient remedies.
 */
export function nutrientDensity(food, nutrient) {
  const perGram =
    nutrient === 'protein' || nutrient === 'fiber'
      ? food[nutrient] ?? 0
      : food.nutrients?.[nutrient] ?? food[nutrient] ?? 0;
  const kcal = food.calories || 0;
  if (kcal <= 0) return perGram > 0 ? Infinity : 0;
  return (perGram / kcal) * 100;
}

/**
 * Best foods to close a shortfall in `nutrient`, most efficient first.
 *
 * @param {object[]} foods - already filtered to what the user will eat
 * @param {string} nutrient - 'iron' | 'protein' | 'fiber' | micronutrient key
 * @param {object} [opts]
 * @param {number} [opts.limit=5]
 * @param {boolean} [opts.preferLowGi=false]
 * @returns {object[]}
 */
export function remedyFoods(foods, nutrient, { limit = 5, preferLowGi = false } = {}) {
  const scored = foods
    .map((food) => {
      let score = nutrientDensity(food, nutrient);
      if (!Number.isFinite(score) || score <= 0) return null;
      if (preferLowGi && food.glycemicIndex != null && food.glycemicIndex >= 55) {
        score *= 0.6;
      }
      return { food, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  // Keep the list varied: at most 2 foods per category.
  const perCat = {};
  const picked = [];
  for (const { food } of scored) {
    perCat[food.category] = (perCat[food.category] ?? 0) + 1;
    if (perCat[food.category] > 2) continue;
    picked.push(food);
    if (picked.length >= limit) break;
  }
  return picked;
}

export { MICRONUTRIENTS };
