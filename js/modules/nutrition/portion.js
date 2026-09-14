/**
 * portion.js — convert between grams (the canonical store) and human units:
 * "2 eggs", "1 medium banana", "1½ cups", "2 tbsp", "250 ml".
 *
 * A normalised food (food-model.js) may carry:
 *   household = { label, grams, kind }   kind ∈ 'count' | 'measure' | 'liquid'
 *
 * Pure. No DOM, no async.
 */

const VULGAR = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' };
// Abbreviations that never pluralise.
const NO_PLURAL = new Set(['tsp', 'tbsp', 'ml', 'g', 'oz']);

/** 1.5 -> "1½", 0.25 -> "¼", 2 -> "2", 0.333 -> "0.33". */
export function toFraction(n) {
  const v = Number(n) || 0;
  if (v === 0) return '0';
  const whole = Math.floor(v);
  const frac = Math.round((v - whole) * 100) / 100;
  if (VULGAR[frac] !== undefined) {
    const f = VULGAR[frac];
    if (whole === 0) return f || '0';
    return f ? `${whole}${f}` : `${whole}`;
  }
  // Not a clean quarter — one decimal is enough for a meal plan.
  return String(Math.round(v * 10) / 10);
}

function pluralise(label, n) {
  if (n === 1 || NO_PLURAL.has(label)) return label;
  if (label.endsWith('s')) return label;
  // "medium banana" -> "medium bananas"
  return `${label}s`;
}

/** grams per one household unit (step size). Falls back to a sane default. */
export function unitGrams(food) {
  return food?.household?.grams > 0 ? food.household.grams : null;
}

/** How the amount input should step, in units of the current display mode. */
export function stepFor(food, mode) {
  if (mode === 'grams') return food?.household ? 1 : 5;
  const kind = food?.household?.kind;
  if (kind === 'count') return 0.5;
  if (kind === 'liquid') return 1; // ml handled separately; glass steps by ½ below
  return 0.25; // 'measure'
}

/**
 * The default display mode for a food given the user's global preference.
 * @param {object} food
 * @param {'auto'|'household'|'grams'} pref
 * @returns {'household'|'grams'}
 */
export function defaultMode(food, pref = 'auto') {
  if (pref === 'grams') return 'grams';
  if (!food?.household) return 'grams';
  return 'household';
}

/**
 * Convert grams to the number shown in the amount input for a mode.
 * @returns {number}
 */
export function toDisplayValue(food, grams, mode) {
  const g = Math.max(0, Number(grams) || 0);
  if (mode === 'grams' || !food?.household) return Math.round(g);
  if (food.household.kind === 'liquid') return Math.round(g / 10) * 10; // ml, 10-ml steps
  const per = unitGrams(food) || 1;
  const raw = g / per;
  // snap to the nearest step so the input shows clean values
  const step = stepFor(food, 'household');
  return Math.round(raw / step) * step;
}

/** Convert an amount-input value (in `mode`) back to grams. */
export function toGrams(food, value, mode) {
  const v = Math.max(0, Number(value) || 0);
  if (mode === 'grams' || !food?.household) return Math.round(v);
  if (food.household.kind === 'liquid') return Math.round(v); // 1 ml ≈ 1 g
  return Math.round(v * (unitGrams(food) || 1));
}

/** The unit label to show next to the input, pluralised for the value. */
export function unitLabel(food, value, mode) {
  if (mode === 'grams' || !food?.household) return 'g';
  if (food.household.kind === 'liquid') return 'ml';
  return pluralise(food.household.label, Number(value) || 0);
}

/**
 * A friendly one-line description of a portion, e.g.
 *   "2 eggs", "1 medium banana", "1½ cups", "2 tbsp", "250 ml", "45 g".
 * `mode` 'household' | 'grams'.
 */
export function describePortion(food, grams, mode = 'household') {
  const g = Math.max(0, Number(grams) || 0);
  if (mode === 'grams' || !food?.household) return `${Math.round(g)} g`;

  if (food.household.kind === 'liquid') {
    const ml = Math.round(g / 10) * 10;
    return `${ml} ml`;
  }
  const per = unitGrams(food) || 1;
  const step = stepFor(food, 'household');
  const units = Math.max(step, Math.round((g / per) / step) * step);
  return `${toFraction(units)} ${pluralise(food.household.label, units)}`;
}
