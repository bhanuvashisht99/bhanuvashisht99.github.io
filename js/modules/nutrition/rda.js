/**
 * rda.js — Dietary reference intake tables.
 *
 * Pure data + lookup. Values are US DRI (RDA or AI) for the micronutrients the
 * plan tracks, plus upper-limit "caps" for substances we want to keep low.
 *
 * Sources: NIH Office of Dietary Supplements fact sheets, 2019/2020 DRI updates,
 * WHO/AHA added-sugar guidance. These are population references, not a
 * prescription — see conditions.js for adjustments and the disclaimer.
 *
 * All functions are pure. No DOM, no async.
 */

export const MICRONUTRIENTS = [
  'iron',
  'calcium',
  'magnesium',
  'potassium',
  'zinc',
  'iodine',
  'selenium',
  'folate',
  'vitamin_b12',
  'vitamin_d',
  'vitamin_a',
  'vitamin_c',
];

// Units, for display.
export const MICRONUTRIENT_UNITS = {
  iron: 'mg',
  calcium: 'mg',
  magnesium: 'mg',
  potassium: 'mg',
  zinc: 'mg',
  iodine: 'mcg',
  selenium: 'mcg',
  folate: 'mcg',
  vitamin_b12: 'mcg',
  vitamin_d: 'mcg',
  vitamin_a: 'mcg',
  vitamin_c: 'mg',
};

export const MICRONUTRIENT_LABELS = {
  iron: 'Iron',
  calcium: 'Calcium',
  magnesium: 'Magnesium',
  potassium: 'Potassium',
  zinc: 'Zinc',
  iodine: 'Iodine',
  selenium: 'Selenium',
  folate: 'Folate',
  vitamin_b12: 'Vitamin B12',
  vitamin_d: 'Vitamin D',
  vitamin_a: 'Vitamin A',
  vitamin_c: 'Vitamin C',
};

/**
 * Nutrients treated as essential by the gap engine: a large shortfall on any of
 * these blocks saving a plan until it is addressed.
 *
 * Vitamin D is deliberately NOT here: it is very hard to meet from food alone and
 * is normally obtained from sunlight or a supplement, so a food-plan shortfall is
 * surfaced as advice, never as a blocker (see nutrient-gap.js).
 */
export const ESSENTIAL_NUTRIENTS = [
  'protein',
  'fiber',
  'iron',
  'calcium',
  'vitamin_b12',
  'folate',
  'potassium',
  'iodine',
];

/** Nutrients we report on but never hard-block, with a tailored note. */
export const ADVISORY_NUTRIENTS = {
  vitamin_d:
    'Vitamin D is hard to get from food. Most people rely on sunlight or a daily ' +
    'supplement (10–25 µg / 400–1000 IU is typical) — worth discussing with your clinician.',
};

// Age bands used for lookups. `min` is inclusive.
const BANDS = [
  { key: 'teen', min: 14, max: 18 },
  { key: 'adult', min: 19, max: 50 },
  { key: 'older', min: 51, max: 70 },
  { key: 'senior', min: 71, max: 200 },
];

function bandFor(age) {
  const n = Number(age);
  if (!Number.isFinite(n)) return 'adult';
  const found = BANDS.find((b) => n >= b.min && n <= b.max);
  return found ? found.key : 'adult';
}

// [male, female] by band. mcg unless noted. "menstruating" handled below.
const TABLE = {
  iron: {
    teen: [11, 15],
    adult: [8, 18],
    older: [8, 8],
    senior: [8, 8],
  },
  calcium: {
    teen: [1300, 1300],
    adult: [1000, 1000],
    older: [1000, 1200],
    senior: [1200, 1200],
  },
  magnesium: {
    teen: [410, 360],
    adult: [400, 310],
    older: [420, 320],
    senior: [420, 320],
  },
  potassium: {
    teen: [3000, 2300],
    adult: [3400, 2600],
    older: [3400, 2600],
    senior: [3400, 2600],
  },
  zinc: {
    teen: [11, 9],
    adult: [11, 8],
    older: [11, 8],
    senior: [11, 8],
  },
  iodine: {
    teen: [150, 150],
    adult: [150, 150],
    older: [150, 150],
    senior: [150, 150],
  },
  selenium: {
    teen: [55, 55],
    adult: [55, 55],
    older: [55, 55],
    senior: [55, 55],
  },
  folate: {
    teen: [400, 400],
    adult: [400, 400],
    older: [400, 400],
    senior: [400, 400],
  },
  vitamin_b12: {
    teen: [2.4, 2.4],
    adult: [2.4, 2.4],
    older: [2.4, 2.4],
    senior: [2.4, 2.4],
  },
  vitamin_d: {
    teen: [15, 15],
    adult: [15, 15],
    older: [15, 15],
    senior: [20, 20],
  },
  vitamin_a: {
    teen: [900, 700],
    adult: [900, 700],
    older: [900, 700],
    senior: [900, 700],
  },
  vitamin_c: {
    teen: [75, 65],
    adult: [90, 75],
    older: [90, 75],
    senior: [90, 75],
  },
};

/**
 * Reference intake for a single micronutrient.
 *
 * @param {string} nutrient - key from MICRONUTRIENTS
 * @param {object} opts
 * @param {number} opts.age
 * @param {'male'|'female'|'other'} opts.sex
 * @param {boolean} [opts.menstruating] - defaults true for female under 51
 * @param {boolean} [opts.pregnant]
 * @returns {number} amount in the nutrient's unit
 */
export function referenceIntake(nutrient, { age, sex, menstruating, pregnant } = {}) {
  const row = TABLE[nutrient];
  if (!row) throw new Error(`Unknown micronutrient: ${nutrient}`);

  const band = bandFor(age);
  // 'other' sex uses the higher of the two references so we never under-target.
  const [male, female] = row[band];
  let value = sex === 'male' ? male : sex === 'female' ? female : Math.max(male, female);

  const isMenstruating =
    sex === 'female' && (menstruating ?? Number(age) < 51);

  if (nutrient === 'iron') {
    if (pregnant) value = 27;
    else if (sex === 'female' && !isMenstruating) value = 8;
  }
  if (nutrient === 'folate' && pregnant) value = 600;
  if (nutrient === 'vitamin_b12' && pregnant) value = 2.6;

  return value;
}

/**
 * Full micronutrient reference snapshot: { iron: 18, calcium: 1000, ... }.
 * This is what we persist on the profile at onboarding.
 */
export function micronutrientReferenceSet(opts = {}) {
  const out = {};
  for (const n of MICRONUTRIENTS) out[n] = referenceIntake(n, opts);
  return out;
}

/**
 * Upper-limit caps. Some are absolute, some scale with energy intake.
 *
 * @param {number} calories - daily calorie target
 * @returns {{sodium:number, added_sugar:number, saturated_fat:number}}
 */
export function substanceCaps(calories) {
  const kcal = Number(calories) || 2000;
  return {
    // CDRR (chronic disease risk reduction) intake.
    sodium: 2300, // mg
    // < 10% of energy, 9 kcal/g is fat but sugar is 4 kcal/g.
    added_sugar: Math.round((kcal * 0.10) / 4), // g
    // < 10% of energy.
    saturated_fat: Math.round((kcal * 0.10) / 9), // g
  };
}
