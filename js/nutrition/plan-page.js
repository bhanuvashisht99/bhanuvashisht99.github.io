/**
 * plan-page.js — controller for nutrition-plan.html.
 *
 * Loads the user's targets + food list, generates an editable 7-day plan, runs
 * the nutrient-gap engine on every edit, and blocks "save" while a critical
 * (essential-nutrient) shortfall is unresolved.
 */

import {
  getCurrentUser,
  getNutritionProfile,
  getFoodPreferences,
  getSeedFoods,
  saveMealPlan,
} from '/js/modules/supabase-client.js';
import { el } from '/js/nutrition/options.js';
import { computeTargets } from '/js/modules/nutrition/targets.js';
import { normalizeFood, scaleFood, sumNutrition } from '/js/modules/nutrition/food-model.js';
import { filterFoods } from '/js/modules/nutrition/food-filter.js';
import { generatePlan } from '/js/modules/nutrition/plan-generator.js';
import { analyseGaps } from '/js/modules/nutrition/nutrient-gap.js';
import { MICRONUTRIENT_LABELS } from '/js/modules/nutrition/rda.js';
import { roundPortion } from '/js/modules/nutrition/format.js';
import {
  defaultMode, toDisplayValue, toGrams, unitLabel, stepFor,
} from '/js/modules/nutrition/portion.js';

const $ = (id) => document.getElementById(id);
const AMOUNT_MODE_KEY = 'ydw.nutrition.amountMode';

function loadAmountMode() {
  try {
    const v = localStorage.getItem(AMOUNT_MODE_KEY);
    return v === 'grams' || v === 'household' ? v : 'household';
  } catch (_) {
    return 'household';
  }
}

const store = {
  user: null,
  profile: null,
  targets: null,
  allFoods: [], // normalised
  eligibleFoods: [], // filtered to the user
  plan: null,
  acknowledged: new Set(),
  dirty: false,
  allCuisines: false,
  amountMode: loadAmountMode(), // 'household' | 'grams' — global default
};

/* ------------------------- init ------------------------- */

async function init() {
  const { user } = await getCurrentUser();
  if (!user) { window.location.href = '/auth.html'; return; }
  store.user = user;

  const [{ profile, onboarded }, { preferences }, { foods }] = await Promise.all([
    getNutritionProfile(user.id),
    getFoodPreferences(user.id),
    getSeedFoods(),
  ]);

  if (!onboarded) { window.location.href = '/nutrition-onboarding.html'; return; }

  store.profile = profile;
  store.allFoods = (foods || []).map(normalizeFood);

  store.targets = computeTargets({
    calories: profile.daily_calories,
    weightKg: profile.weight,
    bodyFatPct: profile.body_fat_pct,
    goal: profile.goal,
    age: profile.age,
    sex: profile.gender,
    menstruating: profile.gender === 'female' ? profile.age < 51 : undefined,
    conditions: profile.medical_conditions || [],
  });

  buildEligibleFoods(preferences);

  store.plan = generateFresh();
  store.dirty = true;

  $('loading').hidden = true;
  $('plan-app').hidden = false;
  $('save-bar').hidden = false;
  wireControls();
  render();
}

function buildEligibleFoods(preferences) {
  const never = (preferences || []).filter((p) => p.stance === 'never' || p.stance === 'dislike').map((p) => p.food_id);
  store.loved = new Set((preferences || []).filter((p) => p.stance === 'love' || p.stance === 'like').map((p) => p.food_id));
  store.eligibleFoods = filterFoods(store.allFoods, {
    dietPattern: store.profile.diet_pattern || (store.profile.dietary_preferences || [])[0] || 'omnivore',
    allergies: store.profile.allergies || [],
    intolerances: store.profile.intolerances || [],
    dislikedFoodIds: never,
    regions: store.profile.region_preferences || [],
    allRegions: store.allCuisines,
  });
}

function generateFresh() {
  const variety = Number($('variety')?.value || 4);
  return generatePlan({
    targets: store.targets,
    foods: preferLoved(store.eligibleFoods),
    prefs: {
      seed: `${store.user.id}:${Date.now()}:${variety}`,
      mealsPerDay: store.profile.meals_per_day || 3,
      snacks: 1,
    },
  });
}

/** Put the user's "loved" foods first so the generator reaches for them. */
function preferLoved(foods) {
  if (!store.loved || !store.loved.size) return foods;
  return [...foods].sort((a, b) => (store.loved.has(b.id) ? 1 : 0) - (store.loved.has(a.id) ? 1 : 0));
}

/* ------------------------- rendering ------------------------- */

function render() {
  renderTotals();
  const analysis = renderGaps();
  renderWeek();
  renderSaveBar(analysis);
  $('plan-disclaimer').textContent =
    store.targets.disclaimer +
    ((store.profile.medical_conditions || []).length
      ? ' Your conditions shaped these targets — confirm the plan with your clinician or dietitian.'
      : '');
}

function planDailyTotals() {
  const dayCount = store.plan.days.length || 1;
  const contribs = store.plan.days
    .flatMap((d) => d.meals)
    .flatMap((m) => m.items)
    .filter((it) => it.food && it.grams > 0)
    .map((it) => scaleFood(it.food, it.grams));
  const week = sumNutrition(...contribs);
  const avg = {};
  for (const [k, v] of Object.entries(week)) avg[k] = v / dayCount;
  return avg;
}

function renderTotals() {
  const avg = planDailyTotals();
  const t = store.targets;
  const rows = [
    ['Calories', avg.calories, t.calories, 'kcal'],
    ['Protein', avg.protein, t.protein, 'g'],
    ['Carbs', avg.carbs, t.carbs, 'g'],
    ['Fat', avg.fat, t.fat, 'g'],
    ['Fibre', avg.fiber, t.fiber, 'g'],
  ];
  $('week-totals').replaceChildren(
    ...rows.map(([k, got, target, u]) => {
      const ratio = target ? got / target : 1;
      return el('div', { class: 'n-stat' },
        el('div', { class: 'k' }, `${k} · avg/day`),
        el('div', { class: 'v' }, `${Math.round(got)}`),
        el('div', { class: 'u' }, `of ${Math.round(target)} ${u} (${Math.round(ratio * 100)}%)`),
      );
    }),
  );
}

function renderGaps() {
  const analysis = analyseGaps(store.plan, store.targets, preferLoved(store.eligibleFoods), {
    acknowledgedNutrients: [...store.acknowledged],
  });
  const box = $('gaps');
  if (!analysis.gaps.length) {
    box.replaceChildren(el('p', { class: 'n-gap low', style: 'background:var(--n-ok-bg);border-color:#c7ddce' }, 'Every target is covered. Nice.'));
    return analysis;
  }
  box.replaceChildren(...analysis.gaps.map((g) => renderGap(g)));
  return analysis;
}

function renderGap(g) {
  const label = MICRONUTRIENT_LABELS[g.nutrient] || g.label;
  const remedies = el('div', { class: 'g-remedies' },
    ...(g.remedyFoods || []).map((r) =>
      el('button', {
        type: 'button', class: 'n-chip',
        onclick: () => addRemedy(g, r.id),
      }, `+ ${r.name}`)),
  );

  const children = [
    el('div', { class: 'g-title' }, `${label} — ${g.severity === 'excess' ? 'over the ceiling' : `${Math.round(g.ratio * 100)}% of target`}`),
    el('div', { class: 'g-msg' }, g.message),
  ];
  if (g.severity !== 'excess') children.push(remedies);
  if (g.severity === 'critical') {
    children.push(el('button', {
      type: 'button', class: 'n-btn sm ghost', style: 'margin-top:.6rem',
      onclick: () => { store.acknowledged.add(g.nutrient); render(); },
    }, 'I understand — let me save anyway'));
  }
  return el('div', { class: `n-gap ${g.severity}` }, ...children);
}

function addRemedy(gap, foodId) {
  const food = store.allFoods.find((f) => f.id === foodId);
  if (!food) return;
  const day = store.plan.days[gap.leanestDay ?? 0];
  const meal = day.meals.find((m) => m.kind === 'snack') || day.meals[0];
  const existing = meal.items.find((it) => it.foodId === foodId);
  const bump = food.category === 'nuts' || food.category === 'oils' ? 15 : 60;
  if (existing) existing.grams = roundPortion(existing.grams + bump);
  else meal.items.push({ food, foodId, grams: bump });
  markDirty();
  render();
}

function renderWeek() {
  $('week').replaceChildren(...store.plan.days.map((day, di) => renderDay(day, di)));
}

function renderDay(day, di) {
  const contribs = day.meals.flatMap((m) => m.items).filter((it) => it.food && it.grams > 0).map((it) => scaleFood(it.food, it.grams));
  const totals = sumNutrition(...contribs);

  const header = el('header', {},
    el('span', { class: 'd-name' }, dayName(di)),
    el('span', {},
      el('label', { class: 'n-muted', style: 'margin-right:.5rem' },
        (() => {
          const c = el('input', { type: 'checkbox' });
          c.checked = !!day.locked;
          c.addEventListener('change', () => { day.locked = c.checked; markDirty(); });
          return c;
        })(), ' lock'),
      el('button', { class: 'n-btn sm ghost', onclick: () => regenerateDay(di) }, 'Shuffle')),
  );

  const meals = day.meals.map((meal) => renderMeal(day, meal, di));
  const foot = el('div', { class: 'n-muted', style: 'margin-top:.5rem;border-top:1px solid var(--n-border);padding-top:.4rem' },
    `${Math.round(totals.calories)} kcal · P ${Math.round(totals.protein)} · C ${Math.round(totals.carbs)} · F ${Math.round(totals.fat)} · fibre ${Math.round(totals.fiber)}`);

  return el('div', { class: 'n-card n-day' }, header, ...meals, foot);
}

function renderMeal(day, meal, di) {
  const contribs = meal.items.filter((it) => it.food && it.grams > 0).map((it) => scaleFood(it.food, it.grams));
  const mt = sumNutrition(...contribs);

  const head = el('div', { class: 'm-head' },
    el('span', {}, meal.title || meal.key),
    el('span', {}, `${Math.round(mt.calories)} kcal`),
  );

  const items = meal.items.map((item) => renderItem(day, meal, item));

  const adder = buildFoodSearch((food) => {
    meal.items.push({ food, foodId: food.id, grams: food.category === 'oils' || food.category === 'nuts' ? 15 : 80 });
    markDirty();
    render();
  });

  return el('div', { class: 'n-meal' }, head, ...items, adder);
}

/**
 * One editable food row. Shows the amount in household units ("2 eggs", "1½
 * cups", "250 ml") by default, grams when the user asked for grams, and lets the
 * user flip just this row by tapping the unit label.
 */
function renderItem(day, meal, item) {
  const food = item.food || null;
  const rowMode = item.unitMode || defaultMode(food, store.amountMode);
  const value = toDisplayValue(food, item.grams, rowMode);
  const step = stepFor(food, rowMode);

  const nameCell = el('span', { class: 'i-name' }, food ? food.name : '—');

  const input = el('input', {
    type: 'number', min: 0, max: 5000, step,
    value: String(value),
    'aria-label': `${food?.name || 'item'} amount`,
  });
  input.addEventListener('change', () => {
    const v = Math.max(0, Number(input.value) || 0);
    item.grams = toGrams(food, v, rowMode);
    markDirty();
    render();
  });

  const canToggle = Boolean(food?.household);
  const unitBtn = el('button', {
    type: 'button',
    class: canToggle ? 'i-unit' : 'i-unit static',
    title: canToggle ? 'Switch this row between portions and grams' : '',
    ...(canToggle
      ? {
          onclick: () => {
            item.unitMode = rowMode === 'grams' ? 'household' : 'grams';
            markDirty();
            render();
          },
        }
      : {}),
  }, unitLabel(food, value, rowMode));

  const del = el('button', {
    type: 'button', class: 'i-del', title: 'Remove',
    onclick: () => {
      meal.items = meal.items.filter((x) => x !== item);
      const target = day.meals.find((m) => m === meal);
      if (target) target.items = meal.items;
      markDirty();
      render();
    },
  }, '×');

  const gramsHint = canToggle && rowMode !== 'grams'
    ? el('span', { class: 'i-hint n-muted' }, `${Math.round(item.grams)} g`)
    : null;

  return el('div', { class: 'n-item' }, nameCell, input, unitBtn, gramsHint, del);
}

function buildFoodSearch(onPick) {
  const wrap = el('div', { class: 'n-inline-search' });
  const input = el('input', { type: 'text', placeholder: '+ add a food', style: 'width:100%;margin-top:.35rem;padding:.35rem .5rem;border:1px solid var(--n-border);border-radius:6px;font:inherit' });
  const results = el('div', { class: 'results', hidden: true });
  wrap.append(input, results);

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { results.hidden = true; return; }
    const pool = store.allCuisines ? store.allFoods : store.eligibleFoods;
    const hits = pool.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8);
    results.replaceChildren(...hits.map((f) =>
      el('button', { type: 'button', onclick: () => { onPick(f); input.value = ''; results.hidden = true; } },
        `${f.name} — ${Math.round(f.calories)} kcal/100${f.unit}`)));
    results.hidden = hits.length === 0;
  });
  input.addEventListener('blur', () => setTimeout(() => (results.hidden = true), 150));
  return wrap;
}

function renderSaveBar(analysis) {
  const btn = $('save');
  if (analysis.blocking) {
    btn.disabled = true;
    $('save-status').textContent = 'Resolve the essential-nutrient warnings above before saving.';
  } else {
    btn.disabled = false;
    $('save-status').textContent = store.dirty ? 'Unsaved changes.' : 'Saved.';
  }
}

/* ------------------------- actions ------------------------- */

function markDirty() { store.dirty = true; }

function regenerateDay(di) {
  const fresh = generatePlan({
    targets: store.targets,
    foods: preferLoved(store.eligibleFoods),
    prefs: { seed: `${store.user.id}:day${di}:${Date.now()}`, mealsPerDay: store.profile.meals_per_day || 3, snacks: 1 },
  });
  if (!store.plan.days[di].locked) store.plan.days[di] = fresh.days[di];
  markDirty();
  render();
}

function wireControls() {
  $('regenerate').addEventListener('click', () => {
    const prev = store.plan;
    store.plan = generatePlan({
      targets: store.targets,
      foods: preferLoved(store.eligibleFoods),
      prefs: { seed: `${store.user.id}:${Date.now()}:${$('variety').value}`, mealsPerDay: store.profile.meals_per_day || 3, snacks: 1 },
      previous: prev,
    });
    store.acknowledged.clear();
    markDirty();
    render();
  });

  $('all-cuisines').addEventListener('change', (e) => {
    store.allCuisines = e.target.checked;
    // rebuild eligible list; keep the current plan, just widen swap options
    getFoodPreferences(store.user.id).then(({ preferences }) => {
      buildEligibleFoods(preferences);
      render();
    });
  });

  $('reset').addEventListener('click', () => {
    store.plan = generateFresh();
    store.acknowledged.clear();
    store.dirty = true;
    render();
  });

  const setAmountMode = (mode) => {
    store.amountMode = mode;
    try { localStorage.setItem(AMOUNT_MODE_KEY, mode); } catch (_) { /* ignore */ }
    // A global switch clears per-row overrides so the whole plan follows it.
    for (const d of store.plan.days) for (const m of d.meals) for (const it of m.items) delete it.unitMode;
    $('mode-household').setAttribute('aria-pressed', String(mode === 'household'));
    $('mode-grams').setAttribute('aria-pressed', String(mode === 'grams'));
    render();
  };
  $('mode-household').setAttribute('aria-pressed', String(store.amountMode === 'household'));
  $('mode-grams').setAttribute('aria-pressed', String(store.amountMode === 'grams'));
  $('mode-household').addEventListener('click', () => setAmountMode('household'));
  $('mode-grams').addEventListener('click', () => setAmountMode('grams'));

  $('save').addEventListener('click', onSave);
}

async function onSave() {
  const analysis = analyseGaps(store.plan, store.targets, store.eligibleFoods, {
    acknowledgedNutrients: [...store.acknowledged],
  });
  if (analysis.blocking) { render(); return; }

  $('save').disabled = true;
  $('save-status').textContent = 'Saving…';
  const { error } = await saveMealPlan(store.user.id, {
    targets: store.targets,
    plan: store.plan,
    gaps: analysis.gaps,
  });
  if (error) {
    $('save-status').textContent = `Save failed: ${error.message || error}`;
    $('save').disabled = false;
    return;
  }
  store.dirty = false;
  $('save-status').textContent = 'Saved as your active plan.';
  setTimeout(() => (window.location.href = '/nutrition'), 700);
}

function dayName(i) {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i] || `Day ${i + 1}`;
}

$('plan-intro') && ($('plan-intro').textContent =
  'Edit anything — portions, swaps, whole days. The panel updates live and tells you if an essential nutrient drops too low.');

init().catch((err) => {
  console.error(err);
  $('loading').hidden = true;
  document.querySelector('main').append(el('p', { class: 'n-gap critical' }, 'Failed to build a plan. Please refresh or redo the questionnaire.'));
});
