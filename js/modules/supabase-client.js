/**
 * Supabase Client Module
 * Comprehensive Nutrition System
 *
 * This module initializes the Supabase client and provides helper functions
 * for authentication and database operations.
 */

// Import Supabase from CDN (loaded via HTML script tag)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const SUPABASE_URL = 'https://clzxkdddwxnfmtmfkafh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsenhrZGRkd3huZm10bWZrYWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMjEzNTcsImV4cCI6MjA4Mzg5NzM1N30.wvIC8k7VnfyvD_HJSQqgwgk-MUT_9aTpL3-Klr24VP4';

// Initialize Supabase client
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// AUTHENTICATION HELPERS
// ============================================================

/**
 * Get current authenticated user
 * @returns {Promise<{user: Object|null, session: Object|null}>}
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();

  return { user, session, error };
}

/**
 * Sign up a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} name - User full name
 * @returns {Promise<{user: Object, error: Object|null}>}
 */
export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name
      }
    }
  });

  if (error) {
    return { user: null, error };
  }

  // Create profile for the user
  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        email: email,
        name: name,
        subscription_plan: 'free'
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
    }
  }

  return { user: data.user, error: null };
}

/**
 * Sign in existing user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{user: Object, session: Object, error: Object|null}>}
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  return {
    user: data?.user || null,
    session: data?.session || null,
    error
  };
}

/**
 * Sign out current user
 * @returns {Promise<{error: Object|null}>}
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<{error: Object|null}>}
 */
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`
  });
  return { error };
}

/**
 * Update user password
 * @param {string} newPassword - New password
 * @returns {Promise<{error: Object|null}>}
 */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  return { error };
}

// ============================================================
// PROFILE HELPERS
// ============================================================

/**
 * Get user profile
 * @param {string} userId - User ID
 * @returns {Promise<{profile: Object|null, error: Object|null}>}
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  return { profile: data, error };
}

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} updates - Profile fields to update
 * @returns {Promise<{profile: Object|null, error: Object|null}>}
 */
export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  return { profile: data, error };
}

// ============================================================
// FOOD DATABASE HELPERS
// ============================================================

/**
 * Search foods by name
 * @param {string} query - Search query
 * @param {Object} filters - Optional filters {category, dietary_tags, allergens}
 * @param {number} limit - Max results (default 50)
 * @returns {Promise<{foods: Array, error: Object|null}>}
 */
export async function searchFoods(query, filters = {}, limit = 50) {
  let queryBuilder = supabase
    .from('foods')
    .select('*');

  // Text search on name
  if (query) {
    queryBuilder = queryBuilder.textSearch('name', query, {
      type: 'websearch',
      config: 'english'
    });
  }

  // Apply filters
  if (filters.category) {
    queryBuilder = queryBuilder.eq('category', filters.category);
  }

  if (filters.dietary_tags && filters.dietary_tags.length > 0) {
    queryBuilder = queryBuilder.contains('dietary_tags', filters.dietary_tags);
  }

  if (filters.exclude_allergens && filters.exclude_allergens.length > 0) {
    queryBuilder = queryBuilder.not('allergens', 'cs', `{${filters.exclude_allergens.join(',')}}`);
  }

  const { data, error } = await queryBuilder.limit(limit);

  return { foods: data || [], error };
}

/**
 * Get food by ID
 * @param {string} foodId - Food ID
 * @returns {Promise<{food: Object|null, error: Object|null}>}
 */
export async function getFood(foodId) {
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .eq('id', foodId)
    .single();

  return { food: data, error };
}

// ============================================================
// RECIPE HELPERS
// ============================================================

/**
 * Search recipes
 * @param {string} query - Search query
 * @param {Object} filters - Optional filters {meal_types, difficulty, cuisine, dietary_tags, exclude_allergens}
 * @returns {Promise<{recipes: Array, error: Object|null}>}
 */
export async function searchRecipes(query, filters = {}, limit = 50) {
  // `foods` has no `nutrition` column (it's individual macro/micro columns), and
  // the recipe card only needs the ingredient list, not each food's full row —
  // pulling name/category keeps this light.
  let queryBuilder = supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients(
        id, amount, unit, order_index,
        foods(id, name, category)
      )
    `)
    .eq('submission_status', 'approved');

  if (query) {
    queryBuilder = queryBuilder.ilike('name', `%${query}%`);
  }

  if (filters.meal_types && filters.meal_types.length > 0) {
    queryBuilder = queryBuilder.overlaps('meal_types', filters.meal_types);
  }

  if (filters.difficulty) {
    queryBuilder = queryBuilder.eq('difficulty', filters.difficulty);
  }

  if (filters.cuisine) {
    queryBuilder = queryBuilder.eq('cuisine', filters.cuisine);
  }

  if (filters.dietary_tags && filters.dietary_tags.length > 0) {
    queryBuilder = queryBuilder.contains('dietary_tags', filters.dietary_tags);
  }

  if (filters.exclude_allergens && filters.exclude_allergens.length > 0) {
    queryBuilder = queryBuilder.not('allergens', 'ov', `{${filters.exclude_allergens.join(',')}}`);
  }

  const { data, error } = await queryBuilder.order('name').limit(limit);

  return { recipes: data || [], error };
}

/**
 * Get recipe by ID with ingredients
 * @param {string} recipeId - Recipe ID
 * @returns {Promise<{recipe: Object|null, error: Object|null}>}
 */
export async function getRecipe(recipeId) {
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients(
        *,
        foods(*),
        recipe_ingredient_alternatives(
          *,
          foods:alternative_food_id(*)
        )
      )
    `)
    .eq('id', recipeId)
    .single();

  return { recipe: data, error };
}

// ============================================================
// FOOD LOGGING HELPERS
// ============================================================

/**
 * Log a food or recipe
 * @param {string} userId - User ID
 * @param {Date} date - Date of consumption
 * @param {string} mealType - Meal type (breakfast, lunch, dinner, snack1, snack2)
 * @param {Object} item - Item to log {type, id, amount, unit, nutrition}
 * @returns {Promise<{success: boolean, error: Object|null}>}
 */
export async function logFood(userId, date, mealType, item) {
  // First, get or create food_log for the date
  const dateStr = date.toISOString().split('T')[0];

  let { data: foodLog, error: logError } = await supabase
    .from('food_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .single();

  if (logError && logError.code === 'PGRST116') {
    // Food log doesn't exist, create it
    const { data: newLog, error: createError } = await supabase
      .from('food_logs')
      .insert({
        user_id: userId,
        date: dateStr
      })
      .select()
      .single();

    if (createError) return { success: false, error: createError };
    foodLog = newLog;
  }

  // Insert logged item
  const loggedItem = {
    food_log_id: foodLog.id,
    user_id: userId,
    meal_type: mealType,
    item_type: item.type,
    ...(item.type === 'food' && { food_id: item.id }),
    ...(item.type === 'recipe' && { recipe_id: item.id }),
    servings: item.servings || null,
    amount: item.amount || null,
    unit: item.unit || null,
    calories: item.nutrition.calories,
    protein: item.nutrition.protein,
    carbs: item.nutrition.carbs,
    fats: item.nutrition.fats,
    fiber: item.nutrition.fiber || 0,
    sugar: item.nutrition.sugar || 0,
    sodium: item.nutrition.sodium || 0,
    caffeine: item.nutrition.caffeine || 0,
    alcohol: item.nutrition.alcohol || 0,
    added_sugar: item.nutrition.added_sugar || 0
  };

  const { error: itemError } = await supabase
    .from('logged_items')
    .insert(loggedItem);

  if (itemError) return { success: false, error: itemError };

  return { success: true, error: null };
}

/**
 * Get daily food log
 * @param {string} userId - User ID
 * @param {Date} date - Date to get log for
 * @returns {Promise<{foodLog: Object|null, items: Array, error: Object|null}>}
 */
export async function getDailyLog(userId, date) {
  const dateStr = date.toISOString().split('T')[0];

  const { data: foodLog, error: logError } = await supabase
    .from('food_logs')
    .select(`
      *,
      logged_items(*)
    `)
    .eq('user_id', userId)
    .eq('date', dateStr)
    .single();

  return {
    foodLog: foodLog || null,
    items: foodLog?.logged_items || [],
    error: logError
  };
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const { user } = await getCurrentUser();
  return user !== null;
}

/**
 * Require authentication (redirect if not logged in)
 * @param {string} redirectUrl - URL to redirect to if not authenticated
 */
export async function requireAuth(redirectUrl = '/index.html') {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    window.location.href = redirectUrl;
  }
}

/**
 * Listen for auth state changes
 * @param {Function} callback - Callback function (user) => void
 */
export function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null, event);
  });
}

// ============================================================
// NUTRITION SYSTEM
// ============================================================
// Helpers for the personalised nutrition feature (onboarding, weekly plan,
// nutrient-gap engine). Requires the database/nutrition-v2.sql migration.

const SEED_FOODS_CACHE_KEY = 'ydw.nutrition.foods.v3'; // v3: 176 foods (was 101)
const SEED_FOODS_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Get the current user's nutrition + training profile.
 * Returns the same row as getProfile() but named for clarity at call sites.
 * @param {string} userId
 * @returns {Promise<{profile: Object|null, onboarded: boolean, error: Object|null}>}
 */
export async function getNutritionProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  return {
    profile: data || null,
    onboarded: Boolean(data && data.nutrition_onboarded_at),
    // A missing profile row is not an error for our purposes.
    error: error && error.code !== 'PGRST116' ? error : null,
  };
}

/**
 * Persist the computed onboarding result to the profile.
 *
 * Uses upsert on the primary key so it works whether or not a profile row was
 * created at sign-up (the base signUp() insert can be skipped when e-mail
 * confirmation is pending and no session exists yet).
 *
 * @param {string} userId
 * @param {Object} data - profile columns to write (snake_case keys)
 * @param {string} [email] - stored on first insert; profiles.email is NOT NULL
 * @returns {Promise<{profile: Object|null, error: Object|null}>}
 */
export async function saveNutritionProfile(userId, data, email) {
  const payload = {
    id: userId,
    ...(email ? { email } : {}),
    ...data,
    nutrition_onboarded_at: data.nutrition_onboarded_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: row, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  return { profile: row || null, error };
}

/**
 * Load the seed food list (public, read-only). Cached in localStorage for a day
 * so plan edits recompute without a round-trip.
 * @param {Object} [opts]
 * @param {boolean} [opts.force] - bypass the cache
 * @returns {Promise<{foods: Array, error: Object|null, cached: boolean}>}
 */
export async function getSeedFoods({ force = false } = {}) {
  if (!force) {
    try {
      const raw = localStorage.getItem(SEED_FOODS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Date.now() - parsed.at < SEED_FOODS_TTL_MS && Array.isArray(parsed.foods)) {
          return { foods: parsed.foods, error: null, cached: true };
        }
      }
    } catch (_) {
      // ignore malformed / unavailable storage
    }
  }

  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .order('category', { ascending: true })
    .limit(2000);

  if (!error && Array.isArray(data)) {
    try {
      localStorage.setItem(SEED_FOODS_CACHE_KEY, JSON.stringify({ at: Date.now(), foods: data }));
    } catch (_) {
      // storage full / disabled — fine, we just re-fetch next time
    }
  }

  return { foods: data || [], error, cached: false };
}

/**
 * Get the user's per-food likes/dislikes.
 * @param {string} userId
 * @returns {Promise<{preferences: Array<{food_id:string, stance:string}>, error: Object|null}>}
 */
export async function getFoodPreferences(userId) {
  const { data, error } = await supabase
    .from('food_preferences')
    .select('food_id, stance')
    .eq('user_id', userId);

  return { preferences: data || [], error };
}

/**
 * Upsert a single food preference. Pass stance = null to clear it.
 * @param {string} userId
 * @param {string} foodId
 * @param {'love'|'like'|'dislike'|'never'|null} stance
 * @returns {Promise<{error: Object|null}>}
 */
export async function setFoodPreference(userId, foodId, stance) {
  if (!stance) {
    const { error } = await supabase
      .from('food_preferences')
      .delete()
      .eq('user_id', userId)
      .eq('food_id', foodId);
    return { error };
  }

  const { error } = await supabase
    .from('food_preferences')
    .upsert(
      { user_id: userId, food_id: foodId, stance, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,food_id' },
    );
  return { error };
}

/**
 * Bulk-replace the user's food preferences (used at the end of onboarding).
 * @param {string} userId
 * @param {Array<{foodId:string, stance:string}>} entries
 * @returns {Promise<{error: Object|null}>}
 */
export async function replaceFoodPreferences(userId, entries) {
  const { error: delError } = await supabase
    .from('food_preferences')
    .delete()
    .eq('user_id', userId);
  if (delError) return { error: delError };

  const rows = (entries || [])
    .filter((e) => e.foodId && e.stance)
    .map((e) => ({ user_id: userId, food_id: e.foodId, stance: e.stance }));
  if (!rows.length) return { error: null };

  const { error } = await supabase.from('food_preferences').insert(rows);
  return { error };
}

/**
 * The user's active meal plan plus its persisted nutrient gaps.
 * @param {string} userId
 * @returns {Promise<{plan: Object|null, gaps: Array, error: Object|null}>}
 */
export async function getActiveMealPlan(userId) {
  const { data: plan, error } = await supabase
    .from('meal_plans')
    .select(`
      *,
      meal_plan_meals(
        *,
        meal_plan_custom_foods(*)
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !plan) return { plan: plan || null, gaps: [], error };

  const { data: gaps } = await supabase
    .from('meal_plan_gaps')
    .select('*')
    .eq('meal_plan_id', plan.id);

  return { plan, gaps: gaps || [], error: null };
}

/**
 * Save a generated/edited plan. Archives any prior active plan, inserts the new
 * plan header, its meals, their custom foods, and the nutrient-gap rows.
 *
 * @param {string} userId
 * @param {Object} args
 * @param {Object} args.targets - computeTargets() output
 * @param {Object} args.plan - generatePlan() output ({ days: [...] })
 * @param {Array}  args.gaps - analyseGaps().gaps
 * @param {string} [args.name]
 * @param {string} [args.startDate] - ISO date; defaults to today
 * @returns {Promise<{planId: string|null, error: Object|null}>}
 */
export async function saveMealPlan(userId, { targets, plan, gaps = [], name, startDate }) {
  const start = startDate ? new Date(startDate) : new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const iso = (d) => d.toISOString().split('T')[0];

  // Archive previous active plans.
  const { error: archiveError } = await supabase
    .from('meal_plans')
    .update({ status: 'archived' })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (archiveError) return { planId: null, error: archiveError };

  const { data: header, error: headerError } = await supabase
    .from('meal_plans')
    .insert({
      user_id: userId,
      name: name || `Week of ${iso(start)}`,
      start_date: iso(start),
      end_date: iso(end),
      status: 'active',
      target_calories: Math.round(targets.calories),
      target_protein: targets.protein,
      target_carbs: targets.carbs,
      target_fats: targets.fat,
      generated_by: 'algorithm',
    })
    .select()
    .single();
  if (headerError) return { planId: null, error: headerError };

  // Insert meals, then their custom foods.
  const mealRows = [];
  (plan.days || []).forEach((day, dayIdx) => {
    const date = new Date(start);
    date.setDate(date.getDate() + dayIdx);
    (day.meals || []).forEach((meal) => {
      mealRows.push({
        _key: `${dayIdx}:${meal.key}`,
        meal_plan_id: header.id,
        date: iso(date),
        meal_type: normaliseMealType(meal.key),
        title: meal.title || null,
        calories: sumField(meal.items, 'calories'),
        protein: sumField(meal.items, 'protein'),
        carbs: sumField(meal.items, 'carbs'),
        fats: sumField(meal.items, 'fat'),
      });
    });
  });

  const { data: insertedMeals, error: mealsError } = await supabase
    .from('meal_plan_meals')
    .insert(mealRows.map(({ _key, ...row }) => row))
    .select();
  if (mealsError) return { planId: header.id, error: mealsError };

  // Map inserted meals back to their day/meal so we can attach foods.
  const customFoods = [];
  insertedMeals.forEach((row, i) => {
    const src = mealRows[i];
    const [dayIdx, mealKey] = src._key.split(':');
    const meal = plan.days[Number(dayIdx)].meals.find((m) => m.key === mealKey);
    (meal.items || []).forEach((item) => {
      if (!item.foodId || !(item.grams > 0)) return;
      customFoods.push({
        meal_plan_meal_id: row.id,
        food_id: item.foodId,
        amount: Math.round(item.grams),
        unit: item.food?.unit || 'g',
      });
    });
  });

  if (customFoods.length) {
    const { error: foodsError } = await supabase
      .from('meal_plan_custom_foods')
      .insert(customFoods);
    if (foodsError) return { planId: header.id, error: foodsError };
  }

  if (gaps.length) {
    const gapRows = gaps.map((g) => ({
      meal_plan_id: header.id,
      nutrient: g.nutrient,
      severity: g.severity,
      status: 'open',
      intake: g.intake,
      target: g.target,
      suggested_food_ids: (g.remedyFoods || []).map((f) => f.id).filter(Boolean),
    }));
    const { error: gapError } = await supabase.from('meal_plan_gaps').insert(gapRows);
    if (gapError) return { planId: header.id, error: gapError };
  }

  return { planId: header.id, error: null };
}

// ============================================================
// DAILY FOOD LOG (tracking what was actually eaten)
// ============================================================
// Uses food_logs (one row per user per date) + logged_items (rows within it).
// Both tables already existed in the base schema; nothing new to migrate.

/**
 * Load one day's log: the summary row (if any) and its logged items, each
 * carrying the foodId so the caller can join against its cached food list for
 * name/household-unit display.
 * @param {string} userId
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {Promise<{log: Object|null, items: Array, error: Object|null}>}
 */
export async function getFoodLogDay(userId, dateStr) {
  const { data: log, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .maybeSingle();

  if (error || !log) return { log: log || null, items: [], error };

  const { data: items, error: itemsError } = await supabase
    .from('logged_items')
    .select('*')
    .eq('food_log_id', log.id)
    .order('logged_at', { ascending: true });

  return { log, items: items || [], error: itemsError || null };
}

/**
 * Replace a whole day's log in one call: upserts the food_logs summary row,
 * then replaces its logged_items wholesale (simplest correct semantics for a
 * page that edits the whole day at once, same pattern as replaceFoodPreferences
 * and saveMealPlan).
 *
 * @param {string} userId
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {Object} args
 * @param {Array<{mealType:string, foodId:string, food:Object, grams:number}>} args.items
 * @param {Object} args.totals - { calories, protein, carbs, fat, fiber, sugar, sodium }
 * @param {Object} [args.targets] - used to compute calories_diff etc. and adherence
 * @param {number} [args.waterIntake] - ml
 * @param {string} [args.notes]
 * @returns {Promise<{logId: string|null, error: Object|null}>}
 */
export async function saveFoodLogDay(userId, dateStr, { items, totals, targets, waterIntake, notes }) {
  const diff = (key, targetKey) =>
    targets && targets[targetKey] != null ? Math.round((totals[key] ?? 0) - targets[targetKey]) : null;

  const adherence = targets?.calories
    ? Math.max(0, Math.min(100, Math.round(100 - (Math.abs(totals.calories - targets.calories) / targets.calories) * 100)))
    : null;

  const { data: header, error: headerError } = await supabase
    .from('food_logs')
    .upsert(
      {
        user_id: userId,
        date: dateStr,
        total_calories: Math.round(totals.calories || 0),
        total_protein: totals.protein || 0,
        total_carbs: totals.carbs || 0,
        total_fats: totals.fat || 0,
        total_fiber: totals.fiber || 0,
        total_sugar: totals.sugar || 0,
        total_sodium: totals.sodium || 0,
        calories_diff: diff('calories', 'calories'),
        protein_diff: diff('protein', 'protein'),
        carbs_diff: diff('carbs', 'carbs'),
        fats_diff: diff('fat', 'fat'),
        adherence_percentage: adherence,
        water_intake: waterIntake ?? 0,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' },
    )
    .select()
    .single();

  if (headerError) return { logId: null, error: headerError };

  const { error: delError } = await supabase.from('logged_items').delete().eq('food_log_id', header.id);
  if (delError) return { logId: header.id, error: delError };

  const rows = (items || [])
    .filter((it) => it.foodId && it.grams > 0)
    .map((it) => {
      const per100 = (k) => (it.food?.[k] ?? 0) * (it.grams / 100);
      return {
        food_log_id: header.id,
        user_id: userId,
        meal_type: it.mealType,
        item_type: 'food',
        food_id: it.foodId,
        amount: Math.round(it.grams),
        unit: it.food?.unit || 'g',
        calories: per100('calories'),
        protein: per100('protein'),
        carbs: per100('carbs'),
        fats: per100('fat'),
        fiber: per100('fiber'),
        sugar: per100('sugar'),
        sodium: per100('sodium'),
        added_sugar: per100('added_sugar'),
      };
    });

  if (rows.length) {
    const { error: insError } = await supabase.from('logged_items').insert(rows);
    if (insError) return { logId: header.id, error: insError };
  }

  return { logId: header.id, error: null };
}

function normaliseMealType(key) {
  if (key === 'breakfast' || key === 'lunch' || key === 'dinner') return key;
  if (key === 'second_dinner') return 'dinner';
  if (key === 'snack1' || key === 'snack') return 'snack1';
  return 'snack2';
}

function sumField(items, field) {
  return (items || []).reduce((sum, it) => {
    const per100 = it.food?.[field] ?? 0;
    return sum + (per100 * (it.grams || 0)) / 100;
  }, 0);
}

// ============================================================
// INITIALIZATION
// ============================================================

console.log('✅ Supabase client initialized');
console.log('📊 Project:', SUPABASE_URL);
