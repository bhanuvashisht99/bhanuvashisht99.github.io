/**
 * food-model.js — canonical in-memory food shape + nutrition arithmetic.
 *
 * The DB (foods table) uses `fats` and stores nutrition "per serving". Internally
 * we work with a normalised food whose numbers are ALWAYS per 100 g/ml, plus a
 * `nutrients` map keyed the same way as rda.js.
 *
 * Pure. No DOM, no async.
 */

import { MICRONUTRIENTS } from './rda.js';

export const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat', 'fiber'];
export const TRACKED_KEYS = [
  ...MACRO_KEYS,
  'sugar',
  'added_sugar',
  'sodium',
  'saturated_fat',
  ...MICRONUTRIENTS,
];

/** Category buckets the plan generator slots foods into. */
export const CATEGORY_ROLE = {
  protein: 'protein',
  legumes: 'protein',
  dairy: 'protein',
  grain: 'carb',
  fruit: 'carb',
  vegetable: 'veg',
  nuts: 'fat',
  oils: 'fat',
  processed: 'extra',
};

/**
 * Map a raw DB row (or seed JSON entry) to the canonical shape, per 100 units.
 */
export function normalizeFood(row) {
  const serving = Number(row.serving_amount) || 100;
  const factor = serving === 100 ? 1 : 100 / serving;
  const per100 = (v) => (v == null ? 0 : Number(v) * factor);

  const nutrients = {};
  for (const key of MICRONUTRIENTS) nutrients[key] = per100(row[key]);

  // Household ("countable") unit, e.g. { label: 'egg', grams: 50, kind: 'count' }.
  // Accepts either the DB columns or the compact seed's `household` object.
  let household = null;
  if (row.household && row.household.grams > 0) {
    household = {
      label: String(row.household.label || 'serving'),
      grams: Number(row.household.grams),
      kind: row.household.kind || 'measure',
    };
  } else if (row.household_grams > 0 && row.household_unit) {
    household = {
      label: String(row.household_unit),
      grams: Number(row.household_grams),
      kind: row.household_kind || 'measure',
    };
  }

  return {
    id: row.id ?? null,
    name: row.name ?? 'Unknown food',
    category: row.category ?? 'processed',
    role: CATEGORY_ROLE[row.category] ?? 'extra',
    regions: Array.isArray(row.regions) && row.regions.length ? row.regions : ['universal'],
    dietaryTags: row.dietary_tags ?? [],
    allergens: row.allergens ?? [],
    glycemicIndex: row.glycemic_index == null ? null : Number(row.glycemic_index),
    unit: row.serving_unit === 'ml' || row.is_liquid || household?.kind === 'liquid' ? 'ml' : 'g',
    household,
    // all per 100 g/ml
    calories: per100(row.calories),
    protein: per100(row.protein),
    carbs: per100(row.carbs),
    fat: per100(row.fats ?? row.fat),
    fiber: per100(row.fiber),
    sugar: per100(row.sugar),
    added_sugar: per100(row.added_sugar),
    sodium: per100(row.sodium),
    saturated_fat: per100(row.saturated_fat),
    nutrients,
  };
}

/**
 * Nutrition contribution of `grams` of a normalised food.
 * @returns {Record<string, number>} keyed by TRACKED_KEYS
 */
export function scaleFood(food, grams) {
  const f = (Number(grams) || 0) / 100;
  const out = {};
  for (const k of MACRO_KEYS) out[k] = (food[k] ?? 0) * f;
  out.sugar = (food.sugar ?? 0) * f;
  out.added_sugar = (food.added_sugar ?? 0) * f;
  out.sodium = (food.sodium ?? 0) * f;
  out.saturated_fat = (food.saturated_fat ?? 0) * f;
  for (const k of MICRONUTRIENTS) out[k] = (food.nutrients[k] ?? 0) * f;
  return out;
}

/** Sum any number of nutrition contribution objects. */
export function sumNutrition(...contribs) {
  const total = Object.fromEntries(TRACKED_KEYS.map((k) => [k, 0]));
  for (const c of contribs) {
    if (!c) continue;
    for (const k of TRACKED_KEYS) total[k] += c[k] ?? 0;
  }
  return total;
}

/** Glycemic load of `grams` of a food (GI * available carbs / 100). */
export function glycemicLoad(food, grams) {
  if (!food || food.glycemicIndex == null) return 0;
  const carbs = (food.carbs ?? 0) * ((Number(grams) || 0) / 100);
  const availableCarbs = Math.max(0, carbs - (food.fiber ?? 0) * ((Number(grams) || 0) / 100));
  return (food.glycemicIndex * availableCarbs) / 100;
}
