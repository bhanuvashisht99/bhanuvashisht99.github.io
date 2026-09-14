/**
 * recipes-page.js — controller for recipes.html.
 *
 * Browses the `recipes` table (RLS: approved recipes are public), filtered to
 * what the signed-in user's diet pattern and allergies actually allow, with a
 * meal-type filter and search. Clicking a card opens a detail view with
 * ingredients (shown in the food's household unit, same as the plan) and
 * numbered method steps.
 */

import { getCurrentUser, getNutritionProfile, searchRecipes, getRecipe } from '/js/modules/supabase-client.js';
import { el } from '/js/nutrition/options.js';
import { normalizeFood } from '/js/modules/nutrition/food-model.js';
import { describePortion } from '/js/modules/nutrition/portion.js';

const $ = (id) => document.getElementById(id);

const DIET_REQUIRES_TAG = {
  vegan: ['vegan'],
  vegetarian: ['vegetarian'],
  eggetarian: ['vegetarian'],
  pescatarian: ['vegetarian', 'pescatarian'], // either is fine — veg meals or fish
};

const MEAL_FILTERS = [
  { key: '', label: 'All' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

const store = {
  user: null,
  profile: null,
  recipes: [],
  mealFilter: '',
  query: '',
};

async function init() {
  const { user } = await getCurrentUser();
  if (!user) { window.location.href = '/auth.html'; return; }
  store.user = user;

  const { profile } = await getNutritionProfile(user.id);
  store.profile = profile;

  await loadRecipes();

  $('loading').hidden = true;
  $('browse-app').hidden = false;
  renderMealFilters();
  wireSearch();
  renderGrid();

  if (window.location.hash.startsWith('#recipe=')) {
    openDetail(window.location.hash.slice('#recipe='.length));
  }
}

async function loadRecipes() {
  const dietPattern = store.profile?.diet_pattern || (store.profile?.dietary_preferences || [])[0] || 'omnivore';
  const { recipes } = await searchRecipes('', {
    dietary_tags: DIET_REQUIRES_TAG[dietPattern] ? [] : undefined, // OR-logic handled client-side below
    exclude_allergens: store.profile?.allergies || [],
  });
  const requiredAny = DIET_REQUIRES_TAG[dietPattern];
  store.recipes = requiredAny
    ? recipes.filter((r) => (r.dietary_tags || []).some((t) => requiredAny.includes(t)))
    : recipes;
}

function renderMealFilters() {
  $('meal-filter').replaceChildren(
    ...MEAL_FILTERS.map((m) =>
      el('button', {
        type: 'button', class: 'n-chip', 'aria-pressed': String(store.mealFilter === m.key),
        onclick: () => { store.mealFilter = m.key; renderMealFilters(); renderGrid(); },
      }, m.label),
    ),
  );
}

function wireSearch() {
  $('search').addEventListener('input', (e) => {
    store.query = e.target.value.trim().toLowerCase();
    renderGrid();
  });
  $('back-to-browse').addEventListener('click', () => {
    history.pushState('', document.title, window.location.pathname);
    $('detail-app').hidden = true;
    $('browse-app').hidden = false;
  });
}

function filteredRecipes() {
  return store.recipes.filter((r) => {
    if (store.mealFilter && !(r.meal_types || []).includes(store.mealFilter)) return false;
    if (store.query && !r.name.toLowerCase().includes(store.query)) return false;
    return true;
  });
}

function renderGrid() {
  const list = filteredRecipes();
  $('empty-state').hidden = list.length > 0;
  $('recipe-grid').replaceChildren(...list.map(renderCard));
}

function renderCard(r) {
  const card = el('div', { class: 'n-card', style: 'cursor:pointer' }, [
    el('div', { style: 'display:flex;justify-content:space-between;align-items:start;gap:.5rem' },
      el('h3', { style: 'margin:0;font-size:1.05rem' }, r.name),
      el('span', { class: 'n-muted', style: 'white-space:nowrap;font-size:.8rem' }, capitalise(r.cuisine))),
    el('p', { class: 'n-muted', style: 'font-size:.85rem;margin:.4rem 0 .7rem' }, r.description || ''),
    el('div', { class: 'n-row', style: 'gap:.5rem;font-size:.82rem' },
      el('span', { class: 'n-chip', style: 'pointer-events:none' }, `${Math.round(r.calories)} kcal`),
      el('span', { class: 'n-chip', style: 'pointer-events:none' }, `${Math.round(r.protein)}g protein`),
      el('span', { class: 'n-chip', style: 'pointer-events:none' }, `${(r.prep_time || 0) + (r.cook_time || 0)} min`),
      el('span', { class: 'n-chip', style: 'pointer-events:none' }, r.difficulty)),
  ]);
  card.addEventListener('click', () => {
    history.pushState('', document.title, `#recipe=${r.id}`);
    openDetail(r.id);
  });
  return card;
}

async function openDetail(id) {
  $('browse-app').hidden = true;
  $('loading').hidden = false;
  const { recipe, error } = await getRecipe(id);
  $('loading').hidden = true;
  if (error || !recipe) {
    $('browse-app').hidden = false;
    return;
  }

  $('detail-app').hidden = false;
  $('detail-name').textContent = recipe.name;
  $('detail-desc').textContent = recipe.description || '';
  $('detail-servings').textContent = `· serves ${recipe.servings}`;

  $('detail-stats').replaceChildren(
    ...[
      ['Calories', recipe.calories, 'kcal'],
      ['Protein', recipe.protein, 'g'],
      ['Carbs', recipe.carbs, 'g'],
      ['Fat', recipe.fats, 'g'],
      ['Fibre', recipe.fiber, 'g'],
      ['Prep + cook', (recipe.prep_time || 0) + (recipe.cook_time || 0), 'min'],
    ].map(([k, v, u]) => el('div', { class: 'n-stat' }, el('div', { class: 'k' }, k), el('div', { class: 'v' }, String(Math.round(v))), el('div', { class: 'u' }, u))),
  );

  const ingredients = [...(recipe.recipe_ingredients || [])].sort((a, b) => a.order_index - b.order_index);
  $('detail-ingredients').replaceChildren(
    ...ingredients.map((ri) => {
      const food = ri.foods ? normalizeFood(ri.foods) : null;
      const portion = food ? describePortion(food, ri.amount) : `${ri.amount} ${ri.unit}`;
      return el('div', { class: 'n-item', style: 'padding:.5rem 0' },
        el('span', { class: 'i-name' }, ri.foods?.name || 'Ingredient'),
        el('span', { class: 'n-muted' }, portion));
    }),
  );

  $('detail-steps').replaceChildren(...(recipe.instructions || []).map((s) => el('li', {}, s)));
}

function capitalise(s) {
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

init().catch((err) => {
  console.error(err);
  $('loading').hidden = true;
  document.querySelector('main').append(el('p', { class: 'n-gap critical' }, 'Failed to load recipes. Please refresh.'));
});
