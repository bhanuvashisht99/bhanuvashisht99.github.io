/**
 * format.js — unit conversion + display helpers for the nutrition UI.
 * Pure. Canonical storage is always metric (kg, cm); imperial is display only.
 */

export const LB_PER_KG = 2.2046226218;
export const IN_PER_CM = 0.3937007874;

export const kgToLb = (kg) => Number(kg) * LB_PER_KG;
export const lbToKg = (lb) => Number(lb) / LB_PER_KG;
export const cmToIn = (cm) => Number(cm) * IN_PER_CM;
export const inToCm = (inch) => Number(inch) / IN_PER_CM;

/** cm -> { feet, inches } for display. */
export function cmToFeetInches(cm) {
  const totalIn = cmToIn(cm);
  const feet = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn - feet * 12);
  if (inches === 12) return { feet: feet + 1, inches: 0 };
  return { feet, inches };
}

export function feetInchesToCm(feet, inches) {
  return inToCm(Number(feet) * 12 + Number(inches));
}

export const round = (n, dp = 0) => {
  const f = 10 ** dp;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
};

/** Round a portion in grams to something a kitchen scale can hit. */
export function roundPortion(grams) {
  const g = Number(grams) || 0;
  if (g <= 0) return 0;
  if (g < 20) return round(g, 0);
  if (g < 100) return Math.round(g / 5) * 5;
  return Math.round(g / 10) * 10;
}

export const formatKcal = (n) => `${round(n)} kcal`;
export const formatGrams = (n, dp = 0) => `${round(n, dp)} g`;

/** e.g. 0.46 -> "46%". */
export const formatPct = (ratio) => `${Math.round(Number(ratio) * 100)}%`;

/**
 * Display weight/height for the chosen unit system.
 * @returns {{weight:string, height:string}}
 */
export function displayMeasures({ weightKg, heightCm, units }) {
  if (units === 'imperial') {
    const { feet, inches } = cmToFeetInches(heightCm);
    return {
      weight: `${round(kgToLb(weightKg), 1)} lb`,
      height: `${feet}′${inches}″`,
    };
  }
  return {
    weight: `${round(weightKg, 1)} kg`,
    height: `${round(heightCm)} cm`,
  };
}
