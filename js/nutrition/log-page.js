/**
 * log-page.js — controller for nutrition-log.html.
 *
 * A day-at-a-time food diary: log what was actually eaten, see it against the
 * day's targets, and (when a saved plan covers that date) one-tap copy a
 * planned meal in as "eaten". Independent of the weekly plan — editing the log
 * never changes the plan, and vice versa.
 */

import {
  getCurrentUser,
  getNutritionProfile,
  getFoodPreferences,
  getSeedFoods,
  getActiveMealPlan,
  getFoodLogDay,
  saveFoodLogDay,
} from '/js/modules/supabase-client.js';
import { el } from '/js/nutrition/options.js';
import { computeTargets } from '/js/modules/nutrition/targets.js';
import { normalizeFood, scaleFood, sumNutrition } from '/js/modules/nutrition/food-model.js';
import { filterFoods } from '/js/modules/nutrition/food-filter.js';
import { defaultMode, toDisplayValue, toGrams, unitLabel, stepFor } from '/js/modules/nutrition/portion.js';

const $ = (id) => document.getElementById(id);
const AMOUNT_MODE_KEY = 'ydw.nutrition.amountMode'; // shared with the plan page
const GLASS_ML = 250;
const MAX_GLASSES = 12;

const MEAL_TYPES = [
  { key: 'breakfast', title: 'Breakfast' },
  { key: 'lunch', title: 'Lunch' },
  { key: 'dinner', title: 'Dinner' },
  { key: 'snack1', title: 'Snack' },
  { key: 'snack2', title: 'Another snack' },
];

const store = {
  user: null,
  profile: null,
  targets: null,
  allFoods: [],
  eligibleFoods: [],
  date: todayStr(),
  entries: { breakfast: [], lunch: [], dinner: [], snack1: [], snack2: [] }, // {foodId, food, grams, unitMode?}
  waterGlasses: 0,
  planByDate: new Map(), // dateStr -> { mealType: [{foodId, food, grams}] }
  dirty: false,
  amountMode: loadAmountMode(),
};

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function loadAmountMode() {
  try {
    const v = localStorage.getItem(AMOUNT_MODE_KEY);
    return v === 'grams' || v === 'household' ? v : 'household';
  } catch (_) {
    return 'household';
  }
}

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

  const never = (preferences || []).filter((p) => p.stance === 'never' || p.stance === 'dislike').map((p) => p.food_id);
  store.eligibleFoods = filterFoods(store.allFoods, {
    dietPattern: profile.diet_pattern || (profile.dietary_preferences || [])[0] || 'omnivore',
    allergies: profile.allergies || [],
    intolerances: profile.intolerances || [],
    dislikedFoodIds: never,
    regions: profile.region_preferences || [],
    allRegions: true, // logging is retrospective — never block what you actually ate
  });

  await loadActivePlanIndex();
  await loadDay(store.date);

  $('loading').hidden = true;
  $('log-app').hidden = false;
  $('save-bar').hidden = false;
  wireControls();
  render();
}

async function loadActivePlanIndex() {
  const { plan } = await getActiveMealPlan(store.user.id);
  if (!plan) return;
  const byId = new Map(store.allFoods.map((f) => [f.id, f]));
  for (const meal of plan.meal_plan_meals || []) {
    const dayMap = store.planByDate.get(meal.date) || {};
    dayMap[meal.meal_type] = (meal.meal_plan_custom_foods || [])
      .map((cf) => {
        const food = byId.get(cf.food_id);
        return food ? { foodId: cf.food_id, food, grams: Number(cf.amount) } : null;
      })
      .filter(Boolean);
    store.planByDate.set(meal.date, dayMap);
  }
}

async function loadDay(dateStr) {
  const { log, items } = await getFoodLogDay(store.user.id, dateStr);
  const byId = new Map(store.allFoods.map((f) => [f.id, f]));

  const entries = { breakfast: [], lunch: [], dinner: [], snack1: [], snack2: [] };
  for (const row of items) {
    const food = byId.get(row.food_id);
    if (!food || !entries[row.meal_type]) continue;
    entries[row.meal_type].push({ foodId: row.food_id, food, grams: Number(row.amount) });
  }

  store.date = dateStr;
  store.entries = entries;
  store.waterGlasses = log ? Math.round((log.water_intake || 0) / GLASS_ML) : 0;
  store.dirty = false;
}

/* ------------------------- rendering ------------------------- */

function render() {
  renderDateLabel();
  renderTotals();
  renderWater();
  renderMeals();
  renderSaveBar();
}

function renderDateLabel() {
  const d = new Date(`${store.date}T00:00:00`);
  const label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  $('date-label').textContent = store.date === todayStr() ? `Today — ${label}` : label;
  $('date-today').hidden = store.date === todayStr();
}

function allEntries() {
  return MEAL_TYPES.flatMap((m) => store.entries[m.key]);
}

function dailyTotals() {
  const contribs = allEntries().map((e) => scaleFood(e.food, e.grams));
  return sumNutrition(...contribs);
}

function renderTotals() {
  const totals = dailyTotals();
  const t = store.targets;
  const rows = [
    ['Calories', totals.calories, t.calories, 'kcal'],
    ['Protein', totals.protein, t.protein, 'g'],
    ['Carbs', totals.carbs, t.carbs, 'g'],
    ['Fat', totals.fat, t.fat, 'g'],
    ['Fibre', totals.fiber, t.fiber, 'g'],
  ];
  $('day-totals').replaceChildren(
    ...rows.map(([k, got, target, u]) => {
      const ratio = target ? got / target : 0;
      return el('div', { class: 'n-stat' },
        el('div', { class: 'k' }, k),
        el('div', { class: 'v' }, `${Math.round(got)}`),
        el('div', { class: 'u' }, `of ${Math.round(target)} ${u} (${Math.round(ratio * 100)}%)`),
      );
    }),
  );
}

function renderWater() {
  const track = $('water-track');
  track.replaceChildren(
    ...Array.from({ length: MAX_GLASSES }, (_, i) => {
      const filled = i < store.waterGlasses;
      return el('button', {
        type: 'button', class: filled ? 'filled' : '', title: `${i + 1} glass${i ? 'es' : ''}`,
        onclick: () => {
          store.waterGlasses = store.waterGlasses === i + 1 ? i : i + 1;
          markDirty();
          renderWater();
          renderSaveBar();
        },
      });
    }),
  );
  $('water-label').textContent = `${store.waterGlasses * GLASS_ML} ml`;
}

function renderMeals() {
  const plannedToday = store.planByDate.get(store.date);
  $('meals').replaceChildren(
    ...MEAL_TYPES.map((m) => renderMealSection(m, plannedToday?.[m.key])),
  );
}

function renderMealSection(mealDef, planned) {
  const entries = store.entries[mealDef.key];
  const contribs = entries.map((e) => scaleFood(e.food, e.grams));
  const mealTotal = sumNutrition(...contribs);

  const hasUnloggedPlan = planned && planned.length && entries.length === 0;

  const head = el('div', { class: 'm-head', style: 'text-transform:none;font-size:.95rem;font-weight:700;color:var(--n-text)' },
    el('span', {}, mealDef.title),
    el('span', { class: 'n-muted' }, entries.length ? `${Math.round(mealTotal.calories)} kcal` : ''),
  );

  const copyBtn = hasUnloggedPlan
    ? el('button', {
        type: 'button', class: 'n-btn sm ghost', style: 'margin:.4rem 0',
        onclick: () => {
          store.entries[mealDef.key] = planned.map((p) => ({ ...p }));
          markDirty();
          render();
        },
      }, `Copy from plan (${planned.length} item${planned.length > 1 ? 's' : ''})`)
    : null;

  const rows = entries.map((entry) => renderItem(mealDef.key, entry));
  const adder = buildFoodSearch((food) => {
    store.entries[mealDef.key].push({ foodId: food.id, food, grams: food.category === 'oils' || food.category === 'nuts' ? 15 : 100 });
    markDirty();
    render();
  });

  return el('div', { class: 'n-card', style: 'margin-top:1rem' }, head, copyBtn, ...rows, adder);
}

function renderItem(mealType, entry) {
  const food = entry.food;
  const rowMode = entry.unitMode || defaultMode(food, store.amountMode);
  const value = toDisplayValue(food, entry.grams, rowMode);
  const step = stepFor(food, rowMode);

  const input = el('input', { type: 'number', min: 0, max: 5000, step, value: String(value), 'aria-label': `${food.name} amount` });
  input.addEventListener('change', () => {
    entry.grams = toGrams(food, Math.max(0, Number(input.value) || 0), rowMode);
    markDirty();
    render();
  });

  const canToggle = Boolean(food.household);
  const unitBtn = el('button', {
    type: 'button', class: canToggle ? 'i-unit' : 'i-unit static',
    ...(canToggle ? { onclick: () => { entry.unitMode = rowMode === 'grams' ? 'household' : 'grams'; markDirty(); render(); } } : {}),
  }, unitLabel(food, value, rowMode));

  const hint = canToggle && rowMode !== 'grams' ? el('span', { class: 'i-hint n-muted' }, `${Math.round(entry.grams)} g`) : null;

  const del = el('button', {
    type: 'button', class: 'i-del', title: 'Remove',
    onclick: () => {
      store.entries[mealType] = store.entries[mealType].filter((e) => e !== entry);
      markDirty();
      render();
    },
  }, '×');

  return el('div', { class: 'n-item' }, el('span', { class: 'i-name' }, food.name), input, unitBtn, hint, del);
}

function buildFoodSearch(onPick) {
  const wrap = el('div', { class: 'n-inline-search' });
  const input = el('input', {
    type: 'text', placeholder: '+ add a food', style: 'width:100%;margin-top:.35rem;padding:.35rem .5rem;border:1px solid var(--n-border);border-radius:6px;font:inherit',
  });
  const results = el('div', { class: 'results', hidden: true });
  wrap.append(input, results);

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { results.hidden = true; return; }
    const hits = store.allFoods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8);
    results.replaceChildren(...hits.map((f) =>
      el('button', { type: 'button', onclick: () => { onPick(f); input.value = ''; results.hidden = true; } },
        `${f.name} — ${Math.round(f.calories)} kcal/100${f.unit}`)));
    results.hidden = hits.length === 0;
  });
  input.addEventListener('blur', () => setTimeout(() => (results.hidden = true), 150));
  return wrap;
}

function renderSaveBar() {
  $('save-status').textContent = store.dirty ? 'Unsaved changes.' : 'Saved.';
}

/* ------------------------- actions ------------------------- */

function markDirty() { store.dirty = true; }

function wireControls() {
  $('date-prev').addEventListener('click', () => changeDate(-1));
  $('date-next').addEventListener('click', () => changeDate(1));
  $('date-today').addEventListener('click', () => goToDate(todayStr()));
  $('save').addEventListener('click', onSave);
}

async function changeDate(deltaDays) {
  if (store.dirty && !confirm('Discard unsaved changes to this day?')) return;
  const d = new Date(`${store.date}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  await goToDate(d.toISOString().split('T')[0]);
}

async function goToDate(dateStr) {
  $('loading').hidden = false;
  $('log-app').hidden = true;
  await loadDay(dateStr);
  $('loading').hidden = true;
  $('log-app').hidden = false;
  render();
}

async function onSave() {
  $('save').disabled = true;
  $('save-status').textContent = 'Saving…';
  const totals = dailyTotals();
  const items = MEAL_TYPES.flatMap((m) => store.entries[m.key].map((e) => ({ mealType: m.key, foodId: e.foodId, food: e.food, grams: e.grams })));
  const { error } = await saveFoodLogDay(store.user.id, store.date, {
    items,
    totals,
    targets: store.targets,
    waterIntake: store.waterGlasses * GLASS_ML,
  });
  $('save').disabled = false;
  if (error) {
    $('save-status').textContent = `Save failed: ${error.message || error}`;
    return;
  }
  store.dirty = false;
  $('save-status').textContent = 'Saved.';
}

init().catch((err) => {
  console.error(err);
  $('loading').hidden = true;
  document.querySelector('main').append(el('p', { class: 'n-gap critical' }, 'Failed to load your food log. Please refresh.'));
});
