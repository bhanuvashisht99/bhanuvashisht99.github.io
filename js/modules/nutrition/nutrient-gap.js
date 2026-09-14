/**
 * nutrient-gap.js — the "necessity engine".
 *
 * Rolls a weekly plan up to a daily average, compares it against the user's
 * targets, and reports where the plan falls short (or badly overshoots a cap).
 * Critical shortfalls on essential nutrients block saving the plan.
 *
 * Pure. Depends on food-model.js, food-filter.js, rda.js.
 */

import { scaleFood, sumNutrition, MACRO_KEYS } from './food-model.js';
import { remedyFoods } from './food-filter.js';
import {
  MICRONUTRIENTS,
  MICRONUTRIENT_UNITS,
  MICRONUTRIENT_LABELS,
  ESSENTIAL_NUTRIENTS,
  ADVISORY_NUTRIENTS,
} from './rda.js';

const CRITICAL_RATIO = 0.5;
const LOW_RATIO = 0.8;
const EXCESS_RATIO = 1.15;

const MACRO_LABELS = {
  calories: 'Calories',
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
  fiber: 'Fibre',
};
const MACRO_UNITS = {
  calories: 'kcal',
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  fiber: 'g',
};
const CAP_LABELS = {
  sodium: 'Sodium',
  added_sugar: 'Added sugar',
  saturated_fat: 'Saturated fat',
};
const CAP_UNITS = { sodium: 'mg', added_sugar: 'g', saturated_fat: 'g' };

/** Every item in the plan, flattened. */
function allItems(plan) {
  const items = [];
  for (const day of plan.days ?? []) {
    for (const meal of day.meals ?? []) {
      for (const item of meal.items ?? []) {
        if (item.food && item.grams > 0) items.push(item);
      }
    }
  }
  return items;
}

/**
 * Daily-average nutrition for the whole plan.
 * @returns {Record<string, number>}
 */
export function planDailyAverage(plan) {
  const dayCount = Math.max(1, (plan.days ?? []).length);
  const contribs = allItems(plan).map((it) => scaleFood(it.food, it.grams));
  const weekTotal = sumNutrition(...contribs);
  const avg = {};
  for (const [k, v] of Object.entries(weekTotal)) avg[k] = v / dayCount;
  return avg;
}

/** Which day has the least of `nutrient` — where a remedy should be added. */
export function leanestDayIndex(plan, nutrient) {
  let bestIdx = 0;
  let bestVal = Infinity;
  (plan.days ?? []).forEach((day, idx) => {
    const contribs = (day.meals ?? [])
      .flatMap((m) => m.items ?? [])
      .filter((it) => it.food && it.grams > 0)
      .map((it) => scaleFood(it.food, it.grams));
    const total = sumNutrition(...contribs);
    const val = MACRO_KEYS.includes(nutrient) ? total[nutrient] : total[nutrient] ?? 0;
    if (val < bestVal) {
      bestVal = val;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

function labelFor(nutrient) {
  return MACRO_LABELS[nutrient] || CAP_LABELS[nutrient] || MICRONUTRIENT_LABELS[nutrient] || nutrient;
}
function unitFor(nutrient) {
  return MACRO_UNITS[nutrient] || CAP_UNITS[nutrient] || MICRONUTRIENT_UNITS[nutrient] || '';
}

function shortfallMessage(nutrient, ratio, essential) {
  const pct = Math.round(ratio * 100);
  const label = labelFor(nutrient);
  if (ADVISORY_NUTRIENTS[nutrient]) {
    return `${label} averages ${pct}% of target from food. ${ADVISORY_NUTRIENTS[nutrient]}`;
  }
  if (essential && ratio < CRITICAL_RATIO) {
    return `${label} is essential and your week averages only ${pct}% of your target. Pick at least one option below to fix this before saving.`;
  }
  return `${label} is a little low — about ${pct}% of target. Consider adding one of these.`;
}

/**
 * @param {object} plan
 * @param {object} targets - from targets.computeTargets()
 * @param {object[]} eligibleFoods - normalised + already filtered to the user
 * @param {object} [opts]
 * @param {string[]} [opts.acknowledgedNutrients] - critical gaps the user typed to override
 * @returns {{
 *   gaps: Array<{nutrient,label,unit,intake,target,ratio,severity,message,remedyFoods,leanestDay}>,
 *   blocking: boolean,
 *   ok: string[],
 * }}
 */
export function analyseGaps(plan, targets, eligibleFoods = [], opts = {}) {
  const acknowledged = new Set(opts.acknowledgedNutrients ?? []);
  const avg = planDailyAverage(plan);
  const preferLowGi = !!targets.mealRules?.preferLowGi;

  const gaps = [];
  const ok = [];

  const check = (nutrient, target, intake, { essential = false, isCap = false } = {}) => {
    if (!target || target <= 0) return;
    const ratio = intake / target;

    if (isCap) {
      if (ratio > EXCESS_RATIO) {
        gaps.push({
          nutrient,
          label: labelFor(nutrient),
          unit: unitFor(nutrient),
          intake: Math.round(intake),
          target: Math.round(target),
          ratio,
          severity: 'excess',
          message: `${labelFor(nutrient)} averages ${Math.round(ratio * 100)}% of the recommended ceiling. Not blocking, but worth trimming.`,
          remedyFoods: [],
          leanestDay: null,
        });
      } else {
        ok.push(nutrient);
      }
      return;
    }

    if (ratio >= LOW_RATIO) {
      ok.push(nutrient);
      return;
    }

    const isCritical = essential && ratio < CRITICAL_RATIO && !acknowledged.has(nutrient);
    gaps.push({
      nutrient,
      label: labelFor(nutrient),
      unit: unitFor(nutrient),
      intake: Math.round(intake * 100) / 100,
      target: Math.round(target * 100) / 100,
      ratio,
      severity: isCritical ? 'critical' : 'low',
      message: shortfallMessage(nutrient, ratio, essential),
      remedyFoods: remedyFoods(eligibleFoods, nutrient, { limit: 5, preferLowGi }).map((f) => ({
        id: f.id,
        name: f.name,
        category: f.category,
      })),
      leanestDay: leanestDayIndex(plan, nutrient),
    });
  };

  // Macros + fibre
  check('protein', targets.protein, avg.protein, { essential: true });
  check('fiber', targets.fiber, avg.fiber, { essential: true });
  check('calories', targets.calories, avg.calories); // low only, informational

  // Micronutrients
  for (const n of MICRONUTRIENTS) {
    check(n, targets.micronutrients?.[n], avg[n] ?? 0, {
      essential: ESSENTIAL_NUTRIENTS.includes(n),
    });
  }

  // Caps
  check('sodium', targets.caps?.sodium, avg.sodium ?? 0, { isCap: true });
  check('added_sugar', targets.caps?.added_sugar, avg.added_sugar ?? 0, { isCap: true });
  check('saturated_fat', targets.caps?.saturated_fat, avg.saturated_fat ?? 0, { isCap: true });

  // Rank: critical, then low, then excess; worst ratio first within a tier.
  const tier = { critical: 0, low: 1, excess: 2 };
  gaps.sort((a, b) => tier[a.severity] - tier[b.severity] || a.ratio - b.ratio);

  return {
    gaps,
    blocking: gaps.some((g) => g.severity === 'critical'),
    ok,
  };
}
