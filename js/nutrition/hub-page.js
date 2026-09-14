/**
 * hub-page.js — controller for nutrition.html.
 * Shows the right state (guest / new / onboarded) and, when onboarded, a
 * read-only dashboard of targets, the active plan and micronutrient coverage.
 */

import {
  getCurrentUser,
  signOut,
  getProfile,
  getNutritionProfile,
  getActiveMealPlan,
  getSeedFoods,
} from '/js/modules/supabase-client.js';
import { el } from '/js/nutrition/options.js';
import { normalizeFood } from '/js/modules/nutrition/food-model.js';
import { analyseGaps } from '/js/modules/nutrition/nutrient-gap.js';
import {
  MICRONUTRIENT_LABELS,
  MICRONUTRIENT_UNITS,
  MICRONUTRIENTS,
} from '/js/modules/nutrition/rda.js';

const $ = (id) => document.getElementById(id);
const show = (id) => ($(id).hidden = false);
const hide = (id) => ($(id).hidden = true);

function firstName(profile, user) {
  const n = profile?.name || user?.user_metadata?.name || user?.email || 'there';
  return String(n).split(/[ @]/)[0];
}

async function init() {
  const { user } = await getCurrentUser();
  hide('loading');

  if (!user) {
    show('state-guest');
    return;
  }

  $('logout').hidden = false;
  $('logout').addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut();
    window.location.reload();
  });

  const [{ profile }, { profile: nutritionProfile, onboarded }] = await Promise.all([
    getProfile(user.id),
    getNutritionProfile(user.id),
  ]);

  if (!onboarded) {
    $('new-name').textContent = firstName(profile, user);
    show('state-new');
    return;
  }

  await renderDashboard(user, nutritionProfile);
  show('state-ready');
}

async function renderDashboard(user, p) {
  $('ready-name').textContent = firstName(p, user);
  $('ready-summary').textContent =
    `Target: ${p.daily_calories} kcal/day · ${p.target_protein} g protein · ` +
    `${p.target_carbs} g carbs · ${p.target_fats} g fat · ${p.target_fiber || '—'} g fibre. ` +
    (p.est_training_kcal_day
      ? `Includes about ${p.est_training_kcal_day} kcal/day from training.`
      : '');

  const tiles = [
    ['Calories', p.daily_calories, 'kcal / day'],
    ['Protein', p.target_protein, 'g / day'],
    ['Carbs', p.target_carbs, 'g / day'],
    ['Fat', p.target_fats, 'g / day'],
    ['Fibre', p.target_fiber ?? '—', 'g / day'],
    ['Training burn', p.est_training_kcal_day ?? 0, 'kcal / day'],
  ];
  $('target-tiles').replaceChildren(
    ...tiles.map(([k, v, u]) =>
      el('div', { class: 'n-stat' }, el('div', { class: 'k' }, k), el('div', { class: 'v' }, String(v)), el('div', { class: 'u' }, u)),
    ),
  );

  const disclaimer =
    'This is general nutrition guidance, not medical advice.' +
    (Array.isArray(p.medical_conditions) && p.medical_conditions.length
      ? ' Your recorded conditions influence these targets — please confirm the plan with your clinician or dietitian.'
      : '');
  $('ready-disclaimer').textContent = disclaimer;

  // Plan + micro coverage
  const [{ plan, gaps }, { foods }] = await Promise.all([
    getActiveMealPlan(user.id),
    getSeedFoods(),
  ]);

  if (!plan) {
    $('plan-summary').replaceChildren(
      el('p', { class: 'n-lead' }, 'No active plan yet. '),
      el('a', { class: 'n-btn', href: '/nutrition-plan.html' }, 'Generate this week'),
    );
    $('micro-panel').textContent = 'Generate a plan to see nutrient coverage.';
    return;
  }

  const mealCount = (plan.meal_plan_meals || []).length;
  const open = (gaps || []).filter((g) => g.status === 'open');
  const crit = open.filter((g) => g.severity === 'critical');
  $('plan-summary').replaceChildren(
    el('p', {}, `${plan.name} — ${mealCount} meals across 7 days.`),
    crit.length
      ? el('p', { class: 'n-gap critical', style: 'margin-top:.5rem' },
          `${crit.length} essential nutrient${crit.length > 1 ? 's are' : ' is'} still short: ${crit.map((g) => g.nutrient).join(', ')}.`)
      : open.length
        ? el('p', { class: 'n-muted', style: 'margin-top:.5rem' }, `${open.length} minor nutrient note${open.length > 1 ? 's' : ''}.`)
        : el('p', { class: 'n-muted', style: 'margin-top:.5rem' }, 'All nutrient targets covered.'),
  );

  renderMicroPanel(p, plan, foods);
}

function renderMicroPanel(p, plan, rawFoods) {
  const foods = (rawFoods || []).map(normalizeFood);
  const byId = new Map(foods.map((f) => [f.id, f]));

  // Rebuild a plan shape the gap engine understands from persisted rows.
  const days = groupMealsByDay(plan, byId);
  const targets = {
    calories: p.daily_calories,
    protein: p.target_protein,
    fiber: p.target_fiber,
    micronutrients: p.micronutrient_targets || {},
    caps: {},
    mealRules: {},
  };
  const { gaps } = analyseGaps({ days }, targets, foods);
  const gapByNutrient = new Map(gaps.map((g) => [g.nutrient, g]));

  const rows = MICRONUTRIENTS.map((n) => {
    const target = targets.micronutrients[n];
    const g = gapByNutrient.get(n);
    const ratio = g ? g.ratio : 1; // not in gaps => >= 0.8
    const pct = Math.min(150, Math.round(ratio * 100));
    const cls = g?.severity === 'critical' ? 'crit' : g?.severity === 'low' ? 'low' : '';
    return el('div', { class: `n-nutrient ${cls}` },
      el('div', { class: 'top' },
        el('span', {}, `${MICRONUTRIENT_LABELS[n]}`),
        el('span', { class: 'n-muted' }, target ? `${pct}% of ${Math.round(target)} ${MICRONUTRIENT_UNITS[n]}` : '—')),
      el('div', { class: 'track' }, el('div', { class: 'fill', style: `width:${Math.min(100, pct)}%` })),
    );
  });
  $('micro-panel').replaceChildren(...rows);
}

function groupMealsByDay(plan, byId) {
  const map = new Map();
  for (const m of plan.meal_plan_meals || []) {
    if (!map.has(m.date)) map.set(m.date, []);
    const items = (m.meal_plan_custom_foods || [])
      .map((cf) => {
        const food = byId.get(cf.food_id);
        return food ? { food, foodId: cf.food_id, grams: Number(cf.amount) } : null;
      })
      .filter(Boolean);
    map.get(m.date).push({ key: m.meal_type, title: m.title, items });
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, meals], i) => ({ label: date, index: i, meals }));
}

init().catch((err) => {
  console.error(err);
  hide('loading');
  document.getElementById('main').append(
    el('p', { class: 'n-gap critical' }, 'Something went wrong loading your nutrition data. Please refresh.'),
  );
});
