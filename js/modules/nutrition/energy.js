/**
 * energy.js — energy expenditure and calorie-target maths.
 *
 * Pipeline: BMR -> resting/lifestyle expenditure (no workouts) -> add average
 * daily training burn (MET based) -> TDEE -> apply goal adjustment -> clamp to a
 * safe floor.
 *
 * Pure functions. All masses in kg, heights in cm, ages in years.
 */

// Lifestyle multipliers applied to BMR. Deliberately conservative: structured
// workouts are added separately so we do not double-count them.
export const JOB_ACTIVITY_FACTORS = {
  sedentary: 1.2, // desk job, little walking
  light: 1.3, // on feet part of the day
  moderate: 1.4, // lots of walking / light manual work
  active: 1.5, // manual labour
  very_active: 1.6, // heavy manual labour
};

// Metabolic equivalents per training modality (approx, moderate effort).
export const MODALITY_METS = {
  strength: 5.0,
  calisthenics: 4.0,
  hiit: 8.0,
  cardio: 7.0,
  sport: 7.0,
  yoga_mobility: 3.0,
};

// Intensity scales the MET value.
export const INTENSITY_SCALE = {
  easy: 0.85,
  moderate: 1.0,
  hard: 1.15,
};

// Goal -> calorie delta as a fraction of TDEE, by rate.
export const GOAL_ADJUSTMENTS = {
  lose_weight: { easy: -0.12, moderate: -0.20, aggressive: -0.28 },
  recomp: { easy: -0.05, moderate: -0.08, aggressive: -0.12 },
  maintain: { easy: 0, moderate: 0, aggressive: 0 },
  health: { easy: 0, moderate: 0, aggressive: 0 },
  gain_muscle: { easy: 0.06, moderate: 0.10, aggressive: 0.15 },
};

const KCAL_FLOOR = { male: 1500, female: 1200, other: 1400 };

/**
 * Mifflin–St Jeor basal metabolic rate.
 * @returns {number} kcal/day
 */
export function bmrMifflin({ weightKg, heightCm, age, sex }) {
  const w = Number(weightKg);
  const h = Number(heightCm);
  const a = Number(age);
  if (!(w > 0) || !(h > 0) || !(a > 0)) {
    throw new Error('bmrMifflin requires positive weightKg, heightCm, age');
  }
  const base = 10 * w + 6.25 * h - 5 * a;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78; // midpoint for 'other' / unspecified
}

/**
 * Katch–McArdle BMR, used when body-fat % is known (more accurate for lean or
 * heavy individuals).
 * @returns {number} kcal/day
 */
export function bmrKatchMcArdle({ weightKg, bodyFatPct }) {
  const w = Number(weightKg);
  const bf = Number(bodyFatPct);
  if (!(w > 0) || !(bf > 0) || bf >= 75) {
    throw new Error('bmrKatchMcArdle requires weightKg and 0 < bodyFatPct < 75');
  }
  const leanMass = w * (1 - bf / 100);
  return 370 + 21.6 * leanMass;
}

/**
 * Pick the best BMR estimate available.
 */
export function estimateBmr(profile) {
  if (profile.bodyFatPct && Number(profile.bodyFatPct) > 0) {
    return bmrKatchMcArdle(profile);
  }
  return bmrMifflin(profile);
}

/**
 * Average daily calories burned by structured training.
 *
 * kcal for one session ≈ MET * 3.5 * weightKg / 200 * minutes
 * (the standard ACSM approximation).
 *
 * @returns {{perWeek:number, perDay:number}}
 */
export function trainingBurn({
  weightKg,
  sessionsPerWeek,
  avgMinutes,
  modalities = [],
  intensity = 'moderate',
}) {
  const w = Number(weightKg);
  const sessions = Number(sessionsPerWeek) || 0;
  const minutes = Number(avgMinutes) || 0;
  if (!(w > 0) || sessions <= 0 || minutes <= 0) {
    return { perWeek: 0, perDay: 0 };
  }

  const mods = modalities.length ? modalities : ['strength'];
  const avgMet =
    mods.reduce((sum, m) => sum + (MODALITY_METS[m] ?? 5.0), 0) / mods.length;
  const scaledMet = avgMet * (INTENSITY_SCALE[intensity] ?? 1.0);

  const perSession = (scaledMet * 3.5 * w) / 200 * minutes;
  const perWeek = perSession * sessions;
  return { perWeek: Math.round(perWeek), perDay: Math.round(perWeek / 7) };
}

/**
 * Total daily energy expenditure.
 *
 * @param {object} profile - { weightKg, heightCm, age, sex, bodyFatPct?,
 *   jobActivity, sessionsPerWeek, avgMinutes, modalities, intensity }
 * @returns {{bmr, restingExpenditure, trainingKcalDay, trainingKcalWeek, tdee}}
 */
export function computeTdee(profile) {
  const bmr = estimateBmr(profile);
  const jobFactor = JOB_ACTIVITY_FACTORS[profile.jobActivity] ?? JOB_ACTIVITY_FACTORS.sedentary;
  const restingExpenditure = bmr * jobFactor;

  const burn = trainingBurn(profile);
  const tdee = restingExpenditure + burn.perDay;

  return {
    bmr: Math.round(bmr),
    restingExpenditure: Math.round(restingExpenditure),
    trainingKcalDay: burn.perDay,
    trainingKcalWeek: burn.perWeek,
    tdee: Math.round(tdee),
  };
}

/**
 * Apply the goal adjustment to a TDEE and clamp to a safe floor.
 *
 * @returns {{calories:number, delta:number, clamped:boolean, floor:number}}
 */
export function calorieTarget({ tdee, bmr, goal = 'maintain', goalRate = 'moderate', sex }) {
  const byGoal = GOAL_ADJUSTMENTS[goal] ?? GOAL_ADJUSTMENTS.maintain;
  const fraction = byGoal[goalRate] ?? byGoal.moderate ?? 0;
  const raw = Math.round(tdee * (1 + fraction));

  const bmrFloor = Math.round((bmr ?? 0) * 1.1);
  const absoluteFloor = KCAL_FLOOR[sex] ?? KCAL_FLOOR.other;
  const floor = Math.max(bmrFloor, absoluteFloor);

  const clamped = raw < floor;
  return {
    calories: clamped ? floor : raw,
    delta: (clamped ? floor : raw) - tdee,
    clamped,
    floor,
  };
}

/**
 * One-call convenience: profile in, full energy summary out.
 */
export function energySummary(profile) {
  const t = computeTdee(profile);
  const target = calorieTarget({
    tdee: t.tdee,
    bmr: t.bmr,
    goal: profile.goal,
    goalRate: profile.goalRate,
    sex: profile.sex,
  });
  return { ...t, ...target };
}
