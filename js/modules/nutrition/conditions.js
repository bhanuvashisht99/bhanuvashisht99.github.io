/**
 * conditions.js — evidence-aligned dietary adjustments for common conditions.
 *
 * IMPORTANT: this is general nutrition guidance, not medical advice. Every
 * surface that uses this module must show DISCLAIMER to the user.
 *
 * Each condition returns a normalised shape so targets.js and plan-generator.js
 * can merge several conditions predictably:
 *
 *   {
 *     proteinFloorGPerKg,   // raise protein floor
 *     fiberBonusG,          // add to fiber target
 *     addedSugarCapG,       // tighten added-sugar cap
 *     sodiumCapMg,          // tighten sodium cap
 *     maxMealGl,            // per-meal glycemic-load ceiling (plan-generator)
 *     preferLowGi,          // bias carb choices to GI < 55
 *     microFloors: {},      // raise specific micronutrient targets
 *     emphasise: [],        // nutrients to foreground in the UI
 *     notes: [],            // short user-facing guidance strings
 *   }
 *
 * Pure. No DOM, no async.
 */

export const DISCLAIMER =
  'This is general nutrition guidance, not medical advice. If you have a ' +
  'diagnosed condition, review any plan with your doctor or a registered ' +
  'dietitian before following it.';

export const SUPPORTED_CONDITIONS = [
  'pcos',
  'hypothyroid',
  'hyperthyroid',
  't2_diabetes',
  'prediabetes',
  'hypertension',
];

export const CONDITION_LABELS = {
  pcos: 'PCOS',
  hypothyroid: 'Hypothyroidism',
  hyperthyroid: 'Hyperthyroidism',
  t2_diabetes: 'Type 2 diabetes',
  prediabetes: 'Prediabetes',
  hypertension: 'High blood pressure',
};

function emptyModifier() {
  return {
    proteinFloorGPerKg: 0,
    fiberBonusG: 0,
    addedSugarCapG: Infinity,
    sodiumCapMg: Infinity,
    maxMealGl: Infinity,
    preferLowGi: false,
    microFloors: {},
    emphasise: [],
    notes: [],
  };
}

const RULES = {
  pcos() {
    const m = emptyModifier();
    m.proteinFloorGPerKg = 1.6;
    m.fiberBonusG = 5;
    m.addedSugarCapG = 25;
    m.preferLowGi = true;
    m.maxMealGl = 20;
    m.emphasise = ['fiber', 'protein', 'magnesium', 'vitamin_d'];
    m.notes = [
      'A lower glycemic-load pattern with adequate protein and fibre is commonly recommended for PCOS.',
      'Spread carbohydrates across meals rather than concentrating them.',
      'Ask your clinician whether inositol or vitamin D supplementation is appropriate for you.',
    ];
    return m;
  },

  hypothyroid() {
    const m = emptyModifier();
    m.microFloors = { iodine: 150, selenium: 55, zinc: 11, iron: 18 };
    m.emphasise = ['iodine', 'selenium', 'zinc', 'iron'];
    m.notes = [
      'Aim for adequate iodine and selenium; iodised salt, dairy, eggs, fish and Brazil nuts help.',
      'If you take levothyroxine, take it on an empty stomach and keep calcium, iron and soy about 4 hours apart from it.',
      'Cooked cruciferous vegetables in normal amounts are fine — no need to avoid them.',
    ];
    return m;
  },

  hyperthyroid() {
    const m = emptyModifier();
    m.microFloors = { calcium: 1200, vitamin_d: 20 };
    m.emphasise = ['calcium', 'vitamin_d'];
    m.notes = [
      'Prioritise adequate calcium and vitamin D for bone health.',
      'Follow your endocrinologist’s guidance, including any advice on iodine intake.',
    ];
    return m;
  },

  t2_diabetes() {
    const m = emptyModifier();
    m.fiberBonusG = 8;
    m.addedSugarCapG = 20;
    m.preferLowGi = true;
    m.maxMealGl = 15;
    m.emphasise = ['fiber', 'magnesium', 'potassium'];
    m.notes = [
      'Keep the glycemic load of each meal modest and spread carbohydrates evenly through the day.',
      'Pair carbohydrates with protein, fat or fibre to blunt the glucose response.',
      'Coordinate carbohydrate targets with your medication, CGM and care team.',
    ];
    return m;
  },

  prediabetes() {
    const m = emptyModifier();
    m.fiberBonusG = 6;
    m.addedSugarCapG = 25;
    m.preferLowGi = true;
    m.maxMealGl = 18;
    m.emphasise = ['fiber'];
    m.notes = [
      'A lower glycemic-load pattern plus regular activity can help prevent progression to type 2 diabetes.',
    ];
    return m;
  },

  hypertension() {
    const m = emptyModifier();
    m.sodiumCapMg = 1800;
    m.microFloors = { potassium: 3500, magnesium: 400, calcium: 1000 };
    m.emphasise = ['potassium', 'magnesium', 'calcium', 'fiber'];
    m.notes = [
      'A DASH-style pattern — plenty of vegetables, fruit, legumes and low-fat dairy — supports healthy blood pressure.',
      'Keep added salt low; most sodium comes from processed and restaurant food.',
    ];
    return m;
  },
};

/**
 * Merge the modifiers for a set of conditions into one object.
 * Tightest constraint wins (min for caps, max for floors/bonuses).
 *
 * @param {string[]} conditions
 * @returns {ReturnType<typeof emptyModifier> & {disclaimer:string, active:string[]}}
 */
export function combinedModifier(conditions = []) {
  const active = conditions.filter((c) => RULES[c]);
  const merged = emptyModifier();

  for (const c of active) {
    const m = RULES[c]();
    merged.proteinFloorGPerKg = Math.max(merged.proteinFloorGPerKg, m.proteinFloorGPerKg);
    merged.fiberBonusG = Math.max(merged.fiberBonusG, m.fiberBonusG);
    merged.addedSugarCapG = Math.min(merged.addedSugarCapG, m.addedSugarCapG);
    merged.sodiumCapMg = Math.min(merged.sodiumCapMg, m.sodiumCapMg);
    merged.maxMealGl = Math.min(merged.maxMealGl, m.maxMealGl);
    merged.preferLowGi = merged.preferLowGi || m.preferLowGi;
    for (const [k, v] of Object.entries(m.microFloors)) {
      merged.microFloors[k] = Math.max(merged.microFloors[k] ?? 0, v);
    }
    for (const n of m.emphasise) {
      if (!merged.emphasise.includes(n)) merged.emphasise.push(n);
    }
    merged.notes.push(...m.notes);
  }

  return { ...merged, active, disclaimer: DISCLAIMER };
}
