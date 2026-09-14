/**
 * targets.js — turn a calorie target + profile into daily nutrition targets:
 * protein / fat / carbs (grams), fibre, and a micronutrient target snapshot.
 *
 * Pure. Depends on rda.js and conditions.js.
 */

import { micronutrientReferenceSet, substanceCaps } from './rda.js';
import { combinedModifier } from './conditions.js';

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

// Base protein by goal, g per kg bodyweight.
const PROTEIN_G_PER_KG = {
  lose_weight: 2.0,
  recomp: 1.9,
  gain_muscle: 2.0,
  maintain: 1.6,
  health: 1.4,
};
const PROTEIN_CAP_G_PER_KG = 2.4;
const FAT_FLOOR_G_PER_KG = 0.8;
const FAT_DEFAULT_FRACTION = 0.28; // of calories, when above the floor

/**
 * @param {object} args
 * @param {number} args.calories - daily calorie target
 * @param {number} args.weightKg
 * @param {number} args.bodyFatPct
 * @param {string} args.goal
 * @param {number} args.age
 * @param {'male'|'female'|'other'} args.sex
 * @param {boolean} [args.menstruating]
 * @param {boolean} [args.pregnant]
 * @param {string[]} [args.conditions]
 * @returns {{
 *   calories:number, protein:number, carbs:number, fat:number, fiber:number,
 *   micronutrients:Record<string,number>, caps:{sodium:number,added_sugar:number,saturated_fat:number},
 *   mealRules:{maxMealGl:number, preferLowGi:boolean},
 *   emphasise:string[], notes:string[], disclaimer:string
 * }}
 */
export function computeTargets({
  calories,
  weightKg,
  bodyFatPct,
  goal = 'maintain',
  age,
  sex,
  menstruating,
  pregnant,
  conditions = [],
}) {
  const kcal = Math.max(0, Number(calories) || 0);
  const w = Number(weightKg);
  if (!(w > 0)) throw new Error('computeTargets requires positive weightKg');

  const mod = combinedModifier(conditions);

  // --- Protein ---
  const baseProteinPerKg = PROTEIN_G_PER_KG[goal] ?? PROTEIN_G_PER_KG.maintain;
  const proteinPerKg = Math.min(
    PROTEIN_CAP_G_PER_KG,
    Math.max(baseProteinPerKg, mod.proteinFloorGPerKg),
  );
  // For higher body-fat individuals, protein tracks lean mass better; use a
  // 0.75 lean-mass proxy so targets stay realistic.
  const proteinBasisKg =
    bodyFatPct && Number(bodyFatPct) > 30 ? w * 0.75 : w;
  let protein = Math.round(proteinPerKg * proteinBasisKg);

  // --- Fat ---
  // When a per-meal glycemic-load ceiling constrains carbohydrate (PCOS, T2D),
  // those calories have to come from fat and protein instead, so allow a higher
  // fat fraction (up to ~40% of energy) rather than the default ~28%.
  const glCapped = Number.isFinite(mod.maxMealGl) && mod.maxMealGl <= 20;
  const fatFraction = glCapped ? 0.38 : FAT_DEFAULT_FRACTION;
  const fatFloorG = FAT_FLOOR_G_PER_KG * w;
  const fatFromFraction = (kcal * fatFraction) / KCAL_PER_G.fat;
  let fat = Math.round(Math.max(fatFloorG, fatFromFraction));

  // --- Carbs = whatever calories remain ---
  const proteinKcal = protein * KCAL_PER_G.protein;
  const fatKcal = fat * KCAL_PER_G.fat;
  let carbs = Math.round(Math.max(0, (kcal - proteinKcal - fatKcal) / KCAL_PER_G.carbs));

  // If protein + fat already exceed the budget (very low calorie targets),
  // trim fat toward its floor, then protein, so the macros still sum sanely.
  if (proteinKcal + fatKcal > kcal && kcal > 0) {
    const overBy = proteinKcal + fatKcal - kcal;
    const fatTrimG = Math.min(fat - Math.round(fatFloorG), Math.ceil(overBy / KCAL_PER_G.fat));
    fat -= Math.max(0, fatTrimG);
    const stillOver = protein * KCAL_PER_G.protein + fat * KCAL_PER_G.fat - kcal;
    if (stillOver > 0) protein -= Math.ceil(stillOver / KCAL_PER_G.protein);
    carbs = 0;
  }

  // --- Fibre: 14 g per 1000 kcal, sex-based minimum, plus condition bonus ---
  const fiberMin = sex === 'male' ? 30 : 25;
  const fiber = Math.round(Math.max(fiberMin, (kcal / 1000) * 14) + mod.fiberBonusG);

  // --- Micronutrients: reference set with condition floors applied ---
  const micronutrients = micronutrientReferenceSet({ age, sex, menstruating, pregnant });
  for (const [k, v] of Object.entries(mod.microFloors)) {
    micronutrients[k] = Math.max(micronutrients[k] ?? 0, v);
  }

  // --- Caps: energy-scaled, tightened by conditions ---
  const baseCaps = substanceCaps(kcal);
  const caps = {
    sodium: Math.min(baseCaps.sodium, mod.sodiumCapMg),
    added_sugar: Math.min(baseCaps.added_sugar, mod.addedSugarCapG),
    saturated_fat: baseCaps.saturated_fat,
  };

  return {
    calories: Math.round(kcal),
    protein,
    carbs,
    fat,
    fiber,
    micronutrients,
    caps,
    mealRules: { maxMealGl: mod.maxMealGl, preferLowGi: mod.preferLowGi },
    emphasise: mod.emphasise,
    notes: mod.notes,
    disclaimer: mod.disclaimer,
  };
}
