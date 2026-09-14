/**
 * options.js — shared option lists + small helpers for the nutrition pages.
 */

export const REGIONS = [
  { key: 'indian', label: 'Indian' },
  { key: 'western', label: 'Western / Continental' },
  { key: 'mediterranean', label: 'Mediterranean' },
  { key: 'east_asian', label: 'East Asian' },
  { key: 'middle_eastern', label: 'Middle Eastern' },
  { key: 'latin', label: 'Latin American' },
];

export const DIET_PATTERNS = [
  { key: 'omnivore', label: 'Eat everything' },
  { key: 'eggetarian', label: 'Vegetarian + eggs' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'pescatarian', label: 'Pescatarian' },
];

export const ALLERGENS = [
  { key: 'dairy', label: 'Dairy' },
  { key: 'gluten', label: 'Gluten' },
  { key: 'wheat', label: 'Wheat' },
  { key: 'eggs', label: 'Eggs' },
  { key: 'soy', label: 'Soy' },
  { key: 'fish', label: 'Fish' },
  { key: 'shellfish', label: 'Shellfish' },
  { key: 'nuts', label: 'Tree nuts' },
  { key: 'peanuts', label: 'Peanuts' },
  { key: 'sesame', label: 'Sesame' },
];

export const MODALITIES = [
  { key: 'strength', label: 'Weights / strength' },
  { key: 'calisthenics', label: 'Calisthenics' },
  { key: 'hiit', label: 'HIIT / circuits' },
  { key: 'cardio', label: 'Running / cycling' },
  { key: 'sport', label: 'Sport' },
  { key: 'yoga_mobility', label: 'Yoga / mobility' },
];

export const INTENSITIES = [
  { key: 'easy', label: 'Easy — could hold a conversation' },
  { key: 'moderate', label: 'Moderate — working but sustainable' },
  { key: 'hard', label: 'Hard — leaves me spent' },
];

export const JOB_ACTIVITY = [
  { key: 'sedentary', label: 'Mostly sitting (desk job)' },
  { key: 'light', label: 'On my feet part of the day' },
  { key: 'moderate', label: 'Lots of walking / light manual work' },
  { key: 'active', label: 'Manual labour' },
  { key: 'very_active', label: 'Heavy physical work' },
];

export const GOALS = [
  { key: 'lose_weight', label: 'Lose fat' },
  { key: 'recomp', label: 'Recomposition (lose fat, keep muscle)' },
  { key: 'maintain', label: 'Maintain' },
  { key: 'gain_muscle', label: 'Build muscle' },
  { key: 'health', label: 'General health' },
];

export const GOAL_RATES = [
  { key: 'easy', label: 'Gentle' },
  { key: 'moderate', label: 'Steady' },
  { key: 'aggressive', label: 'Aggressive' },
];

export const CONDITIONS = [
  { key: 'pcos', label: 'PCOS' },
  { key: 'hypothyroid', label: 'Hypothyroidism (underactive)' },
  { key: 'hyperthyroid', label: 'Hyperthyroidism (overactive)' },
  { key: 't2_diabetes', label: 'Type 2 diabetes' },
  { key: 'prediabetes', label: 'Prediabetes / insulin resistance' },
  { key: 'hypertension', label: 'High blood pressure' },
];

/** Small DOM helper. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/**
 * Append children to a parent, skipping null / undefined / false so
 * `parent.append(cond ? node : null)` never inserts the literal text "null".
 */
export function mount(parent, ...children) {
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    parent.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return parent;
}

export async function requireUser(supabaseHelpers, redirectGuestTo = null) {
  const { getCurrentUser } = supabaseHelpers;
  const { user } = await getCurrentUser();
  if (!user && redirectGuestTo) {
    window.location.href = redirectGuestTo;
    return null;
  }
  return user;
}
