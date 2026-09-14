/**
 * onboarding-page.js — controller for nutrition-onboarding.html.
 *
 * A multi-step questionnaire that ends by computing the user's energy + nutrient
 * targets (energy.js / targets.js) and persisting them, then sends the user to
 * the plan page.
 */

import {
  getCurrentUser,
  getNutritionProfile,
  saveNutritionProfile,
  replaceFoodPreferences,
  getSeedFoods,
} from '/js/modules/supabase-client.js';
import {
  el, mount, REGIONS, DIET_PATTERNS, ALLERGENS, MODALITIES, INTENSITIES,
  JOB_ACTIVITY, GOALS, GOAL_RATES, CONDITIONS,
} from '/js/nutrition/options.js';
import { energySummary } from '/js/modules/nutrition/energy.js';
import { computeTargets } from '/js/modules/nutrition/targets.js';
import { combinedModifier } from '/js/modules/nutrition/conditions.js';
import { normalizeFood } from '/js/modules/nutrition/food-model.js';
import { filterFoods } from '/js/modules/nutrition/food-filter.js';
import { lbToKg, kgToLb, inToCm, cmToIn } from '/js/modules/nutrition/format.js';

const $ = (id) => document.getElementById(id);

const answers = {
  units: 'metric',
  age: 30, sex: '', heightCm: null, weightKg: null, bodyFatPct: null,
  goal: '', goalRate: 'moderate',
  sessionsPerWeek: 3, avgMinutes: 45, modalities: [], intensity: 'moderate', jobActivity: 'light',
  conditions: [], conditionNotes: '',
  dietPattern: 'omnivore', allergies: [], intolerances: '',
  regions: [],
  foodStances: {}, // foodId -> 'love' | 'like' | 'never'
  mealsPerDay: 3, snacks: 1,
};

let user = null;
let seedFoods = [];
let stepIndex = 0;

const steps = [
  {
    id: 'basics',
    title: 'The basics',
    lead: 'We use these to estimate your metabolic rate.',
    render: renderBasics,
    validate: () => {
      if (!(answers.age >= 14 && answers.age <= 100)) return 'Enter an age between 14 and 100.';
      if (!answers.sex) return 'Choose the option that best matches your physiology.';
      if (!(answers.heightCm > 80 && answers.heightCm < 250)) return 'Enter a realistic height.';
      if (!(answers.weightKg > 25 && answers.weightKg < 400)) return 'Enter a realistic weight.';
      return null;
    },
  },
  {
    id: 'goal',
    title: 'Your goal',
    lead: 'This sets whether we run a deficit, a surplus or maintenance.',
    render: renderGoal,
    validate: () => (answers.goal ? null : 'Pick a goal.'),
  },
  {
    id: 'training',
    title: 'How you train',
    lead: 'Used to estimate the calories you burn in sessions — added on top of daily living.',
    render: renderTraining,
    validate: () => {
      if (!(answers.sessionsPerWeek >= 0 && answers.sessionsPerWeek <= 21)) return 'Sessions per week looks off.';
      if (answers.sessionsPerWeek > 0 && !answers.modalities.length) return 'Pick at least one type of training.';
      return null;
    },
  },
  {
    id: 'conditions',
    title: 'Health considerations',
    lead: 'Optional. If you pick any, we adjust targets with general, evidence-aligned guidance.',
    render: renderConditions,
    validate: () => null,
  },
  {
    id: 'diet',
    title: 'How you eat',
    lead: 'Anything you cannot or will not eat.',
    render: renderDiet,
    validate: () => null,
  },
  {
    id: 'cuisines',
    title: 'Which cuisines do you actually cook and eat?',
    lead: 'We use this to keep the food list focused. You can always switch it on the plan.',
    render: renderCuisines,
    validate: () => (answers.regions.length ? null : 'Pick at least one.'),
  },
  {
    id: 'foods',
    title: 'Foods you love — and foods that are a hard no',
    lead: 'Tap once for “love”, twice for “never”. Everything left untouched is fair game.',
    render: renderFoods,
    validate: () => null,
  },
  {
    id: 'practical',
    title: 'Day-to-day',
    lead: 'How your eating is structured.',
    render: renderPractical,
    validate: () => null,
  },
  {
    id: 'review',
    title: 'Your targets',
    lead: 'Computed from everything above. You can rebuild the plan any time.',
    render: renderReview,
    validate: () => null,
    isFinal: true,
  },
];

/* ------------------------- steps ------------------------- */

function numberField(label, key, { min, max, step = 1, hint, suffix } = {}) {
  const input = el('input', {
    type: 'number', min, max, step,
    value: answers[key] ?? '',
    oninput: (e) => (answers[key] = e.target.value === '' ? null : Number(e.target.value)),
  });
  return el('label', { class: 'n-field' },
    el('span', { class: 'label' }, label),
    hint ? el('span', { class: 'hint' }, hint) : null,
    suffix ? el('span', { class: 'n-row' }, input, el('span', { style: 'flex:0 0 auto;align-self:center' }, suffix)) : input,
  );
}

function chipGroup(list, selectedKeyOrArray, onToggle, extraClass = '') {
  const isMulti = Array.isArray(selectedKeyOrArray);
  return el('div', { class: 'n-chips' },
    ...list.map((opt) => {
      const active = isMulti ? selectedKeyOrArray.includes(opt.key) : selectedKeyOrArray === opt.key;
      const chip = el('button', {
        type: 'button', class: `n-chip ${extraClass}`, 'aria-pressed': active ? 'true' : 'false',
      }, opt.label);
      chip.addEventListener('click', () => {
        onToggle(opt.key, chip);
      });
      return chip;
    }),
  );
}

function renderBasics(root) {
  const unitToggle = chipGroup(
    [{ key: 'metric', label: 'Metric (kg, cm)' }, { key: 'imperial', label: 'Imperial (lb, ft/in)' }],
    answers.units,
    (key) => { answers.units = key; rerender(); },
  );

  root.append(
    el('div', { class: 'n-field' }, el('span', { class: 'label' }, 'Units'), unitToggle),
    numberField('Age', 'age', { min: 14, max: 100 }),
    el('div', { class: 'n-field' },
      el('span', { class: 'label' }, 'Physiology (for metabolic maths)'),
      chipGroup(
        [{ key: 'male', label: 'Male' }, { key: 'female', label: 'Female' }, { key: 'other', label: 'Prefer not to say' }],
        answers.sex,
        (key) => { answers.sex = key; rerender(); },
      )),
    answers.units === 'metric'
      ? el('div', { class: 'n-row' },
          numberField('Height (cm)', 'heightCm', { min: 80, max: 250 }),
          numberField('Weight (kg)', 'weightKg', { min: 25, max: 400, step: 0.1 }))
      : imperialBodyFields(),
    numberField('Body fat % (optional)', 'bodyFatPct', { min: 3, max: 70, step: 0.1, hint: 'If you know it, we use a more accurate BMR formula.' }),
  );
}

function imperialBodyFields() {
  const ft = Math.floor(cmToIn(answers.heightCm || 0) / 12) || '';
  const inch = answers.heightCm ? Math.round(cmToIn(answers.heightCm) - (ft || 0) * 12) : '';
  const lb = answers.weightKg ? Math.round(kgToLb(answers.weightKg)) : '';

  const ftIn = el('input', { type: 'number', min: 3, max: 8, value: ft, placeholder: 'ft' });
  const inIn = el('input', { type: 'number', min: 0, max: 11, value: inch, placeholder: 'in' });
  const setH = () => {
    const f = Number(ftIn.value) || 0;
    const i = Number(inIn.value) || 0;
    answers.heightCm = f || i ? Math.round(inToCm(f * 12 + i)) : null;
  };
  ftIn.addEventListener('input', setH);
  inIn.addEventListener('input', setH);

  const lbIn = el('input', {
    type: 'number', min: 55, max: 880, value: lb, placeholder: 'lb',
    oninput: (e) => (answers.weightKg = e.target.value ? Math.round(lbToKg(Number(e.target.value)) * 10) / 10 : null),
  });

  return el('div', {},
    el('label', { class: 'n-field' }, el('span', { class: 'label' }, 'Height'),
      el('div', { class: 'n-row' }, ftIn, inIn)),
    el('label', { class: 'n-field' }, el('span', { class: 'label' }, 'Weight (lb)'), lbIn),
  );
}

function renderGoal(root) {
  root.append(
    el('div', { class: 'n-field' }, el('span', { class: 'label' }, 'Primary goal'),
      chipGroup(GOALS, answers.goal, (key) => { answers.goal = key; rerender(); })),
    el('div', { class: 'n-field' }, el('span', { class: 'label' }, 'How fast?'),
      el('span', { class: 'hint' }, 'Aggressive is capped by a safety floor so it never gets unhealthy.'),
      chipGroup(GOAL_RATES, answers.goalRate, (key) => { answers.goalRate = key; rerender(); })),
  );
}

function renderTraining(root) {
  const estBox = el('div', { class: 'n-card', style: 'margin-top:1rem' });
  const updateEst = () => {
    if (!answers.weightKg) { estBox.textContent = 'Add your weight on the first step to see an estimate.'; return; }
    const s = energySummary(answers);
    estBox.replaceChildren(
      el('div', { class: 'n-grid cols-auto' },
        stat('Resting + daily life', s.restingExpenditure, 'kcal/day'),
        stat('Training burn', s.trainingKcalDay, 'kcal/day'),
        stat('Total (TDEE)', s.tdee, 'kcal/day')),
    );
  };

  root.append(
    numberField('Training sessions per week', 'sessionsPerWeek', { min: 0, max: 21 }),
    numberField('Typical session length (minutes)', 'avgMinutes', { min: 0, max: 240 }),
    el('div', { class: 'n-field' }, el('span', { class: 'label' }, 'Types of training (pick all that apply)'),
      chipGroup(MODALITIES, answers.modalities, (key, chip) => {
        toggleArray(answers.modalities, key);
        chip.setAttribute('aria-pressed', answers.modalities.includes(key));
        updateEst();
      })),
    el('div', { class: 'n-field' }, el('span', { class: 'label' }, 'Usual effort level'),
      chipGroup(INTENSITIES, answers.intensity, (key) => { answers.intensity = key; rerender(); })),
    el('div', { class: 'n-field' }, el('span', { class: 'label' }, 'Activity outside training'),
      chipGroup(JOB_ACTIVITY, answers.jobActivity, (key) => { answers.jobActivity = key; rerender(); })),
    estBox,
  );
  updateEst();
  for (const input of root.querySelectorAll('input')) input.addEventListener('input', updateEst);
}

function renderConditions(root) {
  root.append(
    chipGroup(CONDITIONS, answers.conditions, (key, chip) => {
      toggleArray(answers.conditions, key);
      chip.setAttribute('aria-pressed', answers.conditions.includes(key));
      renderConditionNotes();
    }),
    el('label', { class: 'n-field', style: 'margin-top:1rem' },
      el('span', { class: 'label' }, 'Anything else we should know? (optional)'),
      (() => {
        const ta = el('textarea', { rows: 3, style: 'width:100%;padding:.65rem;border:1px solid var(--n-border);border-radius:9px;font:inherit' });
        ta.value = answers.conditionNotes;
        ta.addEventListener('input', (e) => (answers.conditionNotes = e.target.value));
        return ta;
      })()),
    el('div', { id: 'cond-notes' }),
  );
  renderConditionNotes();

  function renderConditionNotes() {
    const box = root.querySelector('#cond-notes');
    if (!answers.conditions.length) { box.replaceChildren(); return; }
    const mod = combinedModifier(answers.conditions);
    box.replaceChildren(
      el('div', { class: 'n-disclaimer' },
        el('strong', {}, 'How this changes your plan: '),
        el('ul', { style: 'margin:.4rem 0 0;padding-left:1.1rem' }, ...mod.notes.map((n) => el('li', {}, n))),
      ),
    );
  }
}

function renderDiet(root) {
  root.append(
    el('label', { class: 'n-field' }, el('span', { class: 'label' }, 'Eating pattern'),
      (() => {
        const sel = el('select', { onchange: (e) => (answers.dietPattern = e.target.value) });
        for (const d of DIET_PATTERNS) sel.append(el('option', { value: d.key, selected: answers.dietPattern === d.key }, d.label));
        return sel;
      })()),
    el('div', { class: 'n-field' }, el('span', { class: 'label' }, 'Allergies (we exclude these entirely)'),
      chipGroup(ALLERGENS, answers.allergies, (key, chip) => {
        toggleArray(answers.allergies, key);
        chip.setAttribute('aria-pressed', answers.allergies.includes(key));
      }, 'never')),
    el('label', { class: 'n-field' }, el('span', { class: 'label' }, 'Other foods to avoid (comma separated, optional)'),
      (() => {
        const i = el('input', { type: 'text', value: answers.intolerances, placeholder: 'e.g. mushrooms, coriander' });
        i.addEventListener('input', (e) => (answers.intolerances = e.target.value));
        return i;
      })()),
  );
}

function renderCuisines(root) {
  root.append(
    chipGroup(REGIONS, answers.regions, (key, chip) => {
      toggleArray(answers.regions, key);
      chip.setAttribute('aria-pressed', answers.regions.includes(key));
    }),
  );
}

function renderFoods(root) {
  const eligible = filterFoods(seedFoods.map(normalizeFood), {
    dietPattern: answers.dietPattern,
    allergies: answers.allergies,
    intolerances: splitList(answers.intolerances),
    regions: answers.regions,
  });

  const byCat = {};
  for (const f of eligible) (byCat[f.category] ||= []).push(f);

  const wrap = el('div', {});
  for (const [cat, list] of Object.entries(byCat)) {
    wrap.append(el('h2', { class: 'n-h2' }, catLabel(cat)));
    wrap.append(el('div', { class: 'n-chips' }, ...list.map((f) => {
      const stance = answers.foodStances[f.id];
      const chip = el('button', {
        type: 'button',
        class: `n-chip ${stance === 'love' ? 'love' : stance === 'never' ? 'never' : ''}`,
        'aria-pressed': stance ? 'true' : 'false',
      }, f.name);
      chip.addEventListener('click', () => {
        const next = stance === undefined ? 'love' : stance === 'love' ? 'never' : undefined;
        if (next) answers.foodStances[f.id] = next; else delete answers.foodStances[f.id];
        rerender();
      });
      return chip;
    })));
  }
  if (!eligible.length) wrap.append(el('p', { class: 'n-lead' }, 'No foods match those filters yet — you can loosen them on the plan page.'));
  root.append(wrap);
}

function renderPractical(root) {
  root.append(
    numberField('Main meals per day', 'mealsPerDay', { min: 1, max: 4 }),
    numberField('Snacks per day', 'snacks', { min: 0, max: 3 }),
  );
}

function renderReview(root) {
  const result = computeAll();
  const t = result.targets;
  mount(root,
    el('div', { class: 'n-grid cols-auto' },
      stat('Calories', t.calories, 'kcal/day'),
      stat('Protein', t.protein, 'g/day'),
      stat('Carbs', t.carbs, 'g/day'),
      stat('Fat', t.fat, 'g/day'),
      stat('Fibre', t.fiber, 'g/day')),
    result.energy.clamped
      ? el('p', { class: 'n-gap low', style: 'margin-top:1rem' },
          `We raised your target to a safe minimum of ${t.calories} kcal — a steeper deficit isn't advisable.`)
      : null,
    t.notes.length
      ? el('div', { class: 'n-disclaimer' }, el('strong', {}, 'Applied for your conditions: '),
          el('ul', { style: 'margin:.4rem 0 0;padding-left:1.1rem' }, ...t.notes.map((n) => el('li', {}, n))))
      : null,
    el('p', { class: 'n-disclaimer' }, t.disclaimer),
  );
}

/* ------------------------- helpers ------------------------- */

function stat(k, v, u) {
  return el('div', { class: 'n-stat' }, el('div', { class: 'k' }, k), el('div', { class: 'v' }, String(Math.round(v))), el('div', { class: 'u' }, u));
}
function toggleArray(arr, key) {
  const i = arr.indexOf(key);
  if (i === -1) arr.push(key); else arr.splice(i, 1);
}
function splitList(s) {
  return String(s || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}
function catLabel(c) {
  return { protein: 'Proteins', legumes: 'Beans, lentils & peanuts', dairy: 'Dairy & alternatives', grain: 'Grains & starches', vegetable: 'Vegetables', fruit: 'Fruit', nuts: 'Nuts & seeds', oils: 'Fats & oils', processed: 'Other' }[c] || c;
}

function computeAll() {
  const energy = energySummary(answers);
  const targets = computeTargets({
    calories: energy.calories,
    weightKg: answers.weightKg,
    bodyFatPct: answers.bodyFatPct,
    goal: answers.goal,
    age: answers.age,
    sex: answers.sex,
    menstruating: answers.sex === 'female' ? answers.age < 51 : undefined,
    conditions: answers.conditions,
  });
  return { energy, targets };
}

function buildProfilePayload() {
  const { energy, targets } = computeAll();
  return {
    age: answers.age,
    gender: answers.sex,
    weight: answers.weightKg,
    height: answers.heightCm,
    body_fat_pct: answers.bodyFatPct,
    goal: answers.goal,
    goal_rate: answers.goalRate,
    activity_level: answers.jobActivity,
    job_activity: answers.jobActivity,
    training_sessions_per_week: answers.sessionsPerWeek,
    training_avg_minutes: answers.avgMinutes,
    training_intensity: answers.intensity,
    training_modalities: answers.modalities,
    est_training_kcal_week: energy.trainingKcalWeek,
    est_training_kcal_day: energy.trainingKcalDay,
    daily_calories: targets.calories,
    target_protein: targets.protein,
    target_carbs: targets.carbs,
    target_fats: targets.fat,
    target_fiber: targets.fiber,
    micronutrient_targets: targets.micronutrients,
    medical_conditions: answers.conditions,
    condition_notes: answers.conditionNotes || null,
    diet_pattern: answers.dietPattern,
    allergies: answers.allergies,
    intolerances: splitList(answers.intolerances),
    dietary_preferences: [answers.dietPattern],
    region_preferences: answers.regions,
    meals_per_day: answers.mealsPerDay,
    units: answers.units,
  };
}

/* ------------------------- wizard shell ------------------------- */

function rerender() {
  const step = steps[stepIndex];
  $('step-title').textContent = step.title;
  $('step-lead').textContent = step.lead;

  const container = el('div', { class: 'n-step active' });
  step.render(container, answers);
  $('steps').replaceChildren(container);

  $('progress').replaceChildren(
    ...steps.map((_, i) => el('span', { class: i < stepIndex ? 'done' : i === stepIndex ? 'current' : '' })),
  );

  $('back').style.visibility = stepIndex === 0 ? 'hidden' : 'visible';
  $('next').textContent = step.isFinal ? 'Save & build my plan' : 'Next';
  $('wizard-error').hidden = true;
}

async function onNext() {
  const step = steps[stepIndex];
  const err = step.validate(answers);
  if (err) {
    $('wizard-error').textContent = err;
    $('wizard-error').hidden = false;
    return;
  }
  if (!step.isFinal) {
    stepIndex++;
    rerender();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // finalise
  $('next').disabled = true;
  $('next').textContent = 'Saving…';
  const payload = buildProfilePayload();
  const { error } = await saveNutritionProfile(user.id, payload, user.email);
  if (error) {
    $('wizard-error').textContent = `Could not save: ${error.message || error}`;
    $('wizard-error').hidden = false;
    $('next').disabled = false;
    $('next').textContent = 'Save & build my plan';
    return;
  }

  const prefEntries = Object.entries(answers.foodStances).map(([foodId, stance]) => ({
    foodId,
    stance: stance === 'love' ? 'love' : 'never',
  }));
  await replaceFoodPreferences(user.id, prefEntries);

  window.location.href = '/nutrition-plan.html?fresh=1';
}

function onBack() {
  if (stepIndex > 0) {
    stepIndex--;
    rerender();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

async function init() {
  const { user: u } = await getCurrentUser();
  if (!u) { window.location.href = '/auth.html'; return; }
  user = u;

  const [{ profile }, { foods }] = await Promise.all([
    getNutritionProfile(u.id),
    getSeedFoods(),
  ]);
  seedFoods = foods || [];

  // Prefill from an existing profile so "redo" is not a blank slate.
  if (profile) {
    Object.assign(answers, {
      units: profile.units || 'metric',
      age: profile.age ?? answers.age,
      sex: profile.gender || '',
      heightCm: profile.height ?? null,
      weightKg: profile.weight ?? null,
      bodyFatPct: profile.body_fat_pct ?? null,
      goal: profile.goal || '',
      goalRate: profile.goal_rate || 'moderate',
      sessionsPerWeek: profile.training_sessions_per_week ?? answers.sessionsPerWeek,
      avgMinutes: profile.training_avg_minutes ?? answers.avgMinutes,
      modalities: profile.training_modalities || [],
      intensity: profile.training_intensity || 'moderate',
      jobActivity: profile.job_activity || profile.activity_level || 'light',
      conditions: profile.medical_conditions || [],
      conditionNotes: profile.condition_notes || '',
      dietPattern: profile.diet_pattern || 'omnivore',
      allergies: profile.allergies || [],
      intolerances: (profile.intolerances || []).join(', '),
      regions: profile.region_preferences || [],
      mealsPerDay: profile.meals_per_day ?? 3,
    });
  }

  $('loading').hidden = true;
  $('wizard').hidden = false;
  $('next').addEventListener('click', onNext);
  $('back').addEventListener('click', onBack);
  rerender();
}

init().catch((err) => {
  console.error(err);
  $('loading').hidden = true;
  document.querySelector('main').append(el('p', { class: 'n-gap critical' }, 'Failed to load the questionnaire. Please refresh.'));
});
