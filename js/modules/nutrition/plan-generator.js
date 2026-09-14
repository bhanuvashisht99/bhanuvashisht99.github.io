/**
 * plan-generator.js — build a deterministic, editable 7-day plan that hits the
 * user's calorie and protein targets, respects their food filters, and keeps
 * per-meal glycemic load under any condition ceiling.
 *
 * Deterministic: same (seed, targets, foods, prefs) always yields the same plan,
 * so "regenerate" is reproducible and locked meals/days survive a rebuild.
 *
 * Pure. Depends on food-model.js.
 */

import { scaleFood, sumNutrition, glycemicLoad } from './food-model.js';
import { analyseGaps } from './nutrient-gap.js';
import { remedyFoods } from './food-filter.js';
import { MICRONUTRIENTS, ESSENTIAL_NUTRIENTS } from './rda.js';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** mulberry32 — tiny deterministic PRNG. */
function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Meal skeleton from meals/day + snack count. */
export function mealSkeleton(mealsPerDay = 3, snacks = 1) {
  const mains = Math.max(1, Math.min(4, mealsPerDay));
  const names = ['breakfast', 'lunch', 'dinner', 'second_dinner'].slice(0, mains);
  const weights = {
    1: [1],
    2: [0.45, 0.55],
    3: [0.3, 0.4, 0.3],
    4: [0.25, 0.32, 0.28, 0.15],
  }[mains];

  const meals = names.map((key, i) => ({ key, title: titleCase(key), weight: weights[i], kind: 'main' }));
  for (let s = 0; s < Math.max(0, Math.min(3, snacks)); s++) {
    meals.push({ key: `snack${s + 1}`, title: `Snack ${s + 1}`, weight: 0.1, kind: 'snack' });
  }
  // Normalise weights to sum to 1.
  const total = meals.reduce((sum, m) => sum + m.weight, 0);
  meals.forEach((m) => (m.weight = m.weight / total));
  return meals;
}

function titleCase(key) {
  return key.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function poolsByRole(foods) {
  const pools = { protein: [], carb: [], veg: [], fat: [], extra: [] };
  for (const f of foods) (pools[f.role] ?? pools.extra).push(f);
  // Stable order so rotation is deterministic.
  for (const k of Object.keys(pools)) pools[k].sort((a, b) => (a.id > b.id ? 1 : -1));
  return pools;
}

/** Deterministically pick from a pool, avoiding `used` ids where possible. */
function pick(pool, rotor, used) {
  if (!pool.length) return null;
  for (let i = 0; i < pool.length; i++) {
    const f = pool[(rotor + i) % pool.length];
    if (!used.has(f.id)) return f;
  }
  return pool[rotor % pool.length];
}

/**
 * Reorder a pool so foods sharing a specific (non-"universal") region with
 * `anchor` come first. This is a soft bias, not a filter — every food stays in
 * the pool, just re-ranked — so a plate leans toward one cuisine (rice + dal +
 * a Western fruit is fine; rice + dal + a Western-only sausage is less fine)
 * without ever starving a thin region of options. Ties keep the pool's stable
 * (id-sorted) order so results stay deterministic for a given seed.
 */
function affinitySort(pool, anchor) {
  if (!anchor) return pool;
  const anchorRegions = (anchor.regions || []).filter((r) => r !== 'universal');
  if (!anchorRegions.length) return pool;
  const shared = [];
  const rest = [];
  for (const f of pool) {
    const isShared = (f.regions || []).some((r) => anchorRegions.includes(r));
    (isShared ? shared : rest).push(f);
  }
  return [...shared, ...rest];
}

/**
 * Pick from `pool`, preferring foods that share a specific region with `anchor`.
 * Note: `pick()` starts at `rotor % length` rather than always favouring index 0,
 * so a plain re-sort would not reliably bias the outcome — this narrows to the
 * region-matched subset first and only opens up to the full pool (any region)
 * once that subset is exhausted for the day, keeping the week varied without
 * losing the "one cuisine per plate" bias on any single meal.
 */
function pickAffine(pool, anchor, rotor, used) {
  const anchorRegions = anchor ? (anchor.regions || []).filter((r) => r !== 'universal') : [];
  if (!anchorRegions.length) return pick(pool, rotor, used);
  const matched = pool.filter((f) => (f.regions || []).some((r) => anchorRegions.includes(r)));
  const unusedMatched = matched.filter((f) => !used.has(f.id));
  // Prefer an unused region-matched food; once those run out for the day, open
  // up to the full pool (any region) rather than force a same-day repeat.
  if (unusedMatched.length) return pick(unusedMatched, rotor, used);
  return pick(pool, rotor, used);
}

/**
 * Solve grams for a protein food and a carb food to hit (kcalTarget, proteinTarget),
 * given fixed contributions from veg + fat already chosen. Clamped to sane bounds.
 */
function solvePortions({ proteinFood, carbFood, fixedKcal, fixedProtein, kcalTarget, proteinTarget }) {
  const pKcal = proteinFood ? proteinFood.calories / 100 : 0;
  const pPro = proteinFood ? proteinFood.protein / 100 : 0;
  const cKcal = carbFood ? carbFood.calories / 100 : 0;
  const cPro = carbFood ? carbFood.protein / 100 : 0;

  const needKcal = Math.max(0, kcalTarget - fixedKcal);
  const needPro = Math.max(0, proteinTarget - fixedProtein);

  let pGrams = 0;
  let cGrams = 0;

  const det = pPro * cKcal - pKcal * cPro;
  if (proteinFood && carbFood && Math.abs(det) > 1e-6) {
    pGrams = (needPro * cKcal - needKcal * cPro) / det;
    cGrams = (pPro * needKcal - pKcal * needPro) / det;
  } else if (proteinFood) {
    pGrams = pPro > 0 ? needPro / pPro : needKcal / (pKcal || 1);
  } else if (carbFood) {
    cGrams = needKcal / (cKcal || 1);
  }

  pGrams = clamp(pGrams, proteinFood ? 60 : 0, 300);
  cGrams = clamp(cGrams, carbFood ? 25 : 0, 260);

  // Backfill any remaining calories with the carb food (up to its cap), else protein.
  let gotKcal = fixedKcal + pGrams * pKcal + cGrams * cKcal;
  if (gotKcal < kcalTarget * 0.94) {
    const shortfall = kcalTarget - gotKcal;
    if (carbFood && cGrams < 260) {
      cGrams = clamp(cGrams + shortfall / (cKcal || 1), 0, 300);
    } else if (proteinFood) {
      pGrams = clamp(pGrams + shortfall / (pKcal || 1), 0, 360);
    }
  }
  return { pGrams: Math.round(pGrams), cGrams: Math.round(cGrams) };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Build one meal's items.
 */
function buildMeal({ meal, kcalTarget, proteinTarget, fatTarget = 0, pools, rng, dayUsed, maxMealGl }) {
  const rotor = Math.floor(rng() * 997);
  const items = [];
  const used = new Set(dayUsed);

  if (meal.kind === 'snack') {
    const wantProtein = rng() > 0.4;
    const pool = wantProtein ? pools.protein.concat(pools.fat) : pools.carb.concat(pools.fat);
    const f = pick(pool.length ? pool : pools.extra, rotor, used);
    if (f) {
      const perKcal = f.calories / 100 || 1;
      const cap = f.category === 'oils' ? 25 : f.category === 'nuts' ? 60 : 200;
      const grams = clamp(kcalTarget / perKcal, 15, cap);
      items.push({ food: f, foodId: f.id, grams: Math.round(grams) });
      used.add(f.id);
      // Pair a dense second item if one food can't cover the snack's kcal share.
      if (grams * perKcal < kcalTarget * 0.75) {
        const g2 = pick(pools.fat.concat(pools.protein), rotor + 5, used);
        if (g2) {
          const g2cap = g2.category === 'oils' ? 15 : g2.category === 'nuts' ? 40 : 150;
          const g2Grams = clamp((kcalTarget - grams * perKcal) / (g2.calories / 100 || 1), 5, g2cap);
          items.push({ food: g2, foodId: g2.id, grams: Math.round(g2Grams) });
          used.add(g2.id);
        }
      }
    }
    return finalise(items, used, dayUsed);
  }

  // Main meal: pick the protein first — it anchors the rest of the plate — then
  // bias the carb and veg toward the same cuisine so a meal doesn't end up as
  // "chicken breast + rice + kimchi". The fat item is a small addition (oil,
  // ghee, nuts); if the fat pool is genuinely empty for this user's filters we
  // leave it out rather than mislabel a second protein as "fat" (topUpCalories
  // has its own, more careful logic for adding calories back later).
  let protein = pick(pools.protein, rotor + 3, used);
  const veg = pickAffine(pools.veg, protein, rotor + 1, used);
  let carb = pickAffine(pools.carb, protein, rotor + 4, used);
  const fat = pick(pools.fat, rotor + 2, used);

  const vegGrams = veg ? 150 : 0;
  let fatGrams = fat ? (fat.category === 'oils' ? 12 : fat.category === 'nuts' ? 25 : 40) : 0;

  let fixed = sumNutrition(
    veg ? scaleFood(veg, vegGrams) : null,
    fat ? scaleFood(fat, fatGrams) : null,
  );

  let { pGrams, cGrams } = solvePortions({
    proteinFood: protein,
    carbFood: carb,
    fixedKcal: fixed.calories,
    fixedProtein: fixed.protein,
    kcalTarget,
    proteinTarget,
  });

  // Swap to the lowest-GI carb available before assembling, if a ceiling applies.
  if (Number.isFinite(maxMealGl) && carb && carb.glycemicIndex != null && carb.glycemicIndex >= 55) {
    const lowGi = [...pools.carb]
      .filter((f) => f.glycemicIndex != null)
      .sort((a, b) => a.glycemicIndex - b.glycemicIndex)[0];
    if (lowGi && lowGi.id !== carb.id) {
      carb = lowGi;
      ({ pGrams, cGrams } = solvePortions({
        proteinFood: protein,
        carbFood: carb,
        fixedKcal: fixed.calories,
        fixedProtein: fixed.protein,
        kcalTarget,
        proteinTarget,
      }));
    }
  }

  // Fruit and other high-GI "carbs" get a tighter portion cap so a meal never
  // becomes "300 g of apple". Grains/starches can go higher.
  const carbMax = carb && (carb.category === 'fruit' || (carb.glycemicIndex ?? 0) >= 60) ? 180 : 380;

  if (protein && pGrams > 0) {
    items.push({ food: protein, foodId: protein.id, grams: pGrams, minGrams: 60, maxGrams: 360, adjustable: true });
    used.add(protein.id);
  }
  if (carb && cGrams > 0) {
    items.push({ food: carb, foodId: carb.id, grams: cGrams, minGrams: 20, maxGrams: carbMax, adjustable: true });
    used.add(carb.id);
  }
  if (veg) {
    items.push({ food: veg, foodId: veg.id, grams: vegGrams, minGrams: 80 });
    used.add(veg.id);
  }
  if (fat) {
    // The fat/extra-protein item is adjustable and carries almost no glycemic
    // load, so it is what the top-up pass leans on under a GL ceiling.
    const fMax = fat.category === 'oils' ? 40 : fat.category === 'nuts' ? 80 : 260;
    items.push({ food: fat, foodId: fat.id, grams: fatGrams, minGrams: 5, maxGrams: fMax, adjustable: true, fatLever: true });
    used.add(fat.id);
  }

  // Pull the whole meal back toward its calorie target, then hold the glycemic
  // load under any ceiling (legume "proteins" carry real carbs, so the GL pass
  // may trim the protein item too), then top the calories back up using the
  // GL-neutral fat/protein lever.
  correctMealCalories(items, kcalTarget);
  enforceMealGl(items, maxMealGl);
  topUpCalories(items, kcalTarget, maxMealGl, pools, used, rng, fatTarget, protein);
  for (const it of items) {
    delete it.minGrams;
    delete it.maxGrams;
    delete it.adjustable;
    delete it.fatLever;
  }

  return finalise(items, used, dayUsed);
}

/**
 * If the meal is still well under its calorie target after the GL pass, grow (or
 * add) low-glycemic, calorie-dense items — oils, nuts, eggs, dairy, tofu — until
 * it is close or those items hit their caps. Never pushes total GL over the cap.
 */
function topUpCalories(items, kcalTarget, maxMealGl, pools, used, rng, fatTarget = 0, anchor = null) {
  if (!(kcalTarget > 0)) return;
  const mealKcal = () => items.reduce((s, it) => s + (it.food.calories * it.grams) / 100, 0);
  const mealFat = () => items.reduce((s, it) => s + (it.food.fat * it.grams) / 100, 0);
  const mealGl = () => items.reduce((s, it) => s + glycemicLoad(it.food, it.grams), 0);
  const glHeadroom = () => (Number.isFinite(maxMealGl) ? maxMealGl - mealGl() : Infinity);
  // Allow fat to run up to ~1.5x the meal's fat share filling a calorie gap; a
  // GL-capped meal (little carb room) gets more slack.
  const fatCeil = fatTarget > 0 ? fatTarget * (Number.isFinite(maxMealGl) ? 1.9 : 1.5) : Infinity;

  let guard = 0;
  while (mealKcal() < kcalTarget * 0.92 && guard++ < 16) {
    const headroom = glHeadroom();
    const fatMaxed = mealFat() >= fatCeil;
    // Lever preference, best first:
    //   0 protein / dairy   1 carb (only while GL headroom allows)   2 nuts   3 oil
    const levelRank = (it) => {
      if (it.food.role === 'protein' || it.food.category === 'dairy') return 0;
      if (it.food.role === 'carb' && headroom > 3) return 1;
      if (it.food.category === 'nuts') return 2;
      if (it.food.category === 'oils') return 3;
      return 2.5;
    };
    let lever = items
      .filter((it) => {
        if (!it.adjustable || it.grams >= (it.maxGrams ?? 400)) return false;
        const glPerGram = glycemicLoad(it.food, 100) / 100;
        if (glPerGram > 0 && headroom <= 3) return false; // no room for more carbs
        // Once fat is at its ceiling, stop growing fat-dominant items.
        if (fatMaxed && (it.food.fat ?? 0) > 20 && it.food.role !== 'carb') return false;
        return (
          it.fatLever || it.food.category === 'oils' || it.food.category === 'nuts' ||
          it.food.category === 'dairy' || it.food.role === 'protein' || it.food.role === 'carb' ||
          (it.food.glycemicIndex ?? 0) < 40
        );
      })
      .sort((a, b) => levelRank(a) - levelRank(b))[0];

    // Any carb-bearing candidate (real GL per gram > 0) must fit the remaining
    // headroom even at its small starting portion — applies to legumes just as
    // much as grains, since a "low-GI protein" like lentils still carries carbs.
    const fitsHeadroom = (f) => {
      const gpg = glycemicLoad(f, 100) / 100;
      if (gpg <= 0) return true;
      return headroom <= 3 ? gpg <= 0.01 : gpg * 20 <= headroom; // ~20g starting portion
    };

    let justCreated = false;
    if (!lever) {
      // Add a new item. With glycemic headroom, a second starch keeps the plate
      // realistic (rice + roti, oats + fruit); otherwise fall back to a
      // GL-neutral protein, then nuts, then oil.
      const rotor = Math.floor(rng() * 997);
      const secondStarch = headroom > 8 ? pickAffine(pools.carb.filter(fitsHeadroom), anchor, rotor, used) : null;
      const lowGiProtein = pickAffine(pools.protein.filter(fitsHeadroom), anchor, rotor + 1, used);
      // If fat is already at its ceiling, do not introduce more fat-dense foods —
      // accept a small calorie undershoot instead.
      const nut = fatMaxed ? null : pick(pools.fat.filter((f) => f.category === 'nuts'), rotor + 2, used);
      const anyFat = fatMaxed ? null : pick(pools.fat, rotor + 3, used);
      const candidate = secondStarch || lowGiProtein || nut || anyFat;
      if (!candidate) return; // nothing left that fits — accept the shortfall
      const isCarb = candidate.role === 'carb';
      lever = {
        food: candidate, foodId: candidate.id,
        grams: candidate.category === 'oils' ? 8 : isCarb ? 40 : 20,
        maxGrams: candidate.category === 'oils' ? 35 : candidate.category === 'nuts' ? 70 : isCarb ? 260 : 220,
        adjustable: true,
      };
      items.push(lever);
      used.add(candidate.id);
      justCreated = true;
    }
    const deficit = kcalTarget - mealKcal();
    const perGram = lever.food.calories / 100 || 1;
    let add = Math.min(
      (lever.maxGrams ?? 400) - lever.grams,
      Math.ceil(deficit / perGram),
    );
    // Respect the GL ceiling (only relevant for the rare low-GI grain lever).
    const glPerGram = glycemicLoad(lever.food, 100) / 100;
    if (glPerGram > 0 && Number.isFinite(glHeadroom())) {
      add = Math.min(add, Math.max(0, Math.floor(glHeadroom() / glPerGram)));
    }
    if (add <= 0) {
      if (justCreated) {
        // Dead on arrival (e.g. GL headroom vanished between the fitsHeadroom
        // check and here) — remove the stub rather than leave a token portion
        // sitting on the plate for no nutritional reason, and stop: the next
        // candidate would face the same exhausted headroom.
        items.pop();
        used.delete(lever.foodId);
        return;
      }
      // This lever is capped; blank its adjustable flag so we try another.
      lever.adjustable = false;
      if (!items.some((it) => it.adjustable && it.grams < (it.maxGrams ?? 400))) return;
      continue;
    }
    lever.grams += add;
  }
}

/**
 * Scale the adjustable protein + carb items so the meal lands within
 * [0.9, 1.12] x its calorie target. The fat lever is deliberately excluded —
 * it stays at its base portion here and is only grown later, by topUpCalories,
 * when protein + carb cannot reach the target on their own (e.g. under a
 * glycemic-load ceiling). Bounded by each item's min/max grams.
 */
function correctMealCalories(items, kcalTarget) {
  if (!(kcalTarget > 0)) return;
  const mealKcal = () =>
    items.reduce((s, it) => s + (it.food.calories * it.grams) / 100, 0);

  for (let pass = 0; pass < 6; pass++) {
    const total = mealKcal();
    if (total >= kcalTarget * 0.9 && total <= kcalTarget * 1.12) return;
    const adjustables = items.filter((it) => it.adjustable && !it.fatLever);
    const adjKcal = adjustables.reduce((s, it) => s + (it.food.calories * it.grams) / 100, 0);
    if (adjKcal <= 0) return;
    const fixedKcal = total - adjKcal;
    const wantAdjKcal = Math.max(0, kcalTarget - fixedKcal);
    const factor = wantAdjKcal / adjKcal;
    let changed = false;
    for (const it of adjustables) {
      const next = Math.max(it.minGrams ?? 20, Math.min(it.maxGrams ?? 400, Math.round(it.grams * factor)));
      if (next !== it.grams) {
        it.grams = next;
        changed = true;
      }
    }
    if (!changed) return;
  }
}

/**
 * Bring a meal's total glycemic load under `maxMealGl` by repeatedly trimming the
 * highest-GL item. Mutates the items array in place. No-op when the cap is
 * Infinity or already satisfied.
 */
function enforceMealGl(items, maxMealGl) {
  if (!Number.isFinite(maxMealGl)) return;
  const totalGl = () => items.reduce((s, it) => s + glycemicLoad(it.food, it.grams), 0);

  let guard = 0;
  while (totalGl() > maxMealGl && guard++ < 200) {
    let worst = null;
    let worstGl = 0;
    for (const it of items) {
      const gl = glycemicLoad(it.food, it.grams);
      if (gl > worstGl && it.grams > (it.minGrams ?? 20)) {
        worst = it;
        worstGl = gl;
      }
    }
    if (!worst) break; // everything is at its floor
    worst.grams = Math.max(worst.minGrams ?? 20, Math.round(worst.grams * 0.9) - 1);
  }
}

function finalise(items, used, dayUsed) {
  for (const id of used) dayUsed.add(id);
  return items;
}

/**
 * Generate a full plan.
 *
 * @param {object} args
 * @param {object} args.targets - from targets.computeTargets()
 * @param {object[]} args.foods - normalised + filtered foods the user will eat
 * @param {object} [args.prefs] - { mealsPerDay, snacks, seed, dietPattern, ... }
 * @param {object} [args.previous] - a prior plan; locked days/meals are copied over
 * @returns {{seed:number, days:Array, meta:object}}
 */
export function generatePlan({ targets, foods, prefs = {}, previous = null }) {
  const seed = prefs.seed != null ? hashSeed(prefs.seed) : hashSeed(String(Date.now()));
  const rng = makeRng(seed);
  const skeleton = mealSkeleton(prefs.mealsPerDay ?? 3, prefs.snacks ?? 1);
  const pools = poolsByRole(foods);
  const maxMealGl = targets.mealRules?.maxMealGl ?? Infinity;

  const prevByLabel = {};
  if (previous?.days) for (const d of previous.days) prevByLabel[d.label] = d;

  const days = DAY_LABELS.map((label, dayIdx) => {
    const prevDay = prevByLabel[label];
    if (prevDay?.locked) return structuredCloneSafe(prevDay);

    const dayUsed = new Set();
    const meals = skeleton.map((m, mealIdx) => {
      const prevMeal = prevDay?.meals?.find((x) => x.key === m.key);
      if (prevMeal?.locked) {
        for (const it of prevMeal.items ?? []) if (it.foodId) dayUsed.add(it.foodId);
        return structuredCloneSafe(prevMeal);
      }
      const items = buildMeal({
        meal: m,
        kcalTarget: targets.calories * m.weight,
        proteinTarget: targets.protein * m.weight,
        fatTarget: (targets.fat ?? 0) * m.weight,
        pools,
        rng,
        dayUsed,
        maxMealGl,
      });
      return { key: m.key, title: m.title, kind: m.kind, locked: false, items };
    });

    return { label, index: dayIdx, locked: false, meals };
  });

  let plan = { seed, days, meta: { generatedAt: new Date().toISOString(), prefs } };

  // Post-pass: quietly close small (non-critical) micronutrient shortfalls by
  // adding a dense whole food to the leanest day. Capped so it can't blow the
  // calorie budget.
  plan = autoCloseMinorGaps(plan, targets, foods);

  return plan;
}

function autoCloseMinorGaps(plan, targets, foods, maxNudges = 3) {
  let nudges = 0;
  for (let pass = 0; pass < 2 && nudges < maxNudges; pass++) {
    const { gaps } = analyseGaps(plan, targets, foods);
    const minor = gaps.filter(
      (g) =>
        g.severity === 'low' &&
        (MICRONUTRIENTS.includes(g.nutrient) || g.nutrient === 'fiber') &&
        ESSENTIAL_NUTRIENTS.includes(g.nutrient),
    );
    if (!minor.length) break;

    for (const gap of minor) {
      if (nudges >= maxNudges) break;
      const [best] = remedyFoods(foods, gap.nutrient, { limit: 1, preferLowGi: !!targets.mealRules?.preferLowGi });
      if (!best) continue;
      const day = plan.days[gap.leanestDay ?? 0];
      if (!day || day.locked) continue;
      const meal =
        day.meals.find((m) => m.kind === 'snack' && !m.locked) ||
        day.meals.find((m) => !m.locked);
      if (!meal) continue;
      const grams = best.category === 'nuts' || best.category === 'oils' ? 20 : 50;
      meal.items.push({ food: best, foodId: best.id, grams });
      // Keep any per-meal glycemic-load ceiling intact after the addition.
      if (meal.kind === 'main') enforceMealGl(meal.items, targets.mealRules?.maxMealGl ?? Infinity);
      nudges++;
    }
  }
  plan.meta.autoNudges = nudges;
  return plan;
}

function structuredCloneSafe(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

export { DAY_LABELS, affinitySort, pickAffine };
