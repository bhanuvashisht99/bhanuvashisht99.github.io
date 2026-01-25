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
 * @param {Object} filters - Optional filters
 * @returns {Promise<{recipes: Array, error: Object|null}>}
 */
export async function searchRecipes(query, filters = {}, limit = 50) {
  let queryBuilder = supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients(
        *,
        foods(name, category, nutrition)
      )
    `)
    .eq('submission_status', 'approved');

  if (query) {
    queryBuilder = queryBuilder.textSearch('name', query);
  }

  if (filters.meal_types && filters.meal_types.length > 0) {
    queryBuilder = queryBuilder.contains('meal_types', filters.meal_types);
  }

  if (filters.difficulty) {
    queryBuilder = queryBuilder.eq('difficulty', filters.difficulty);
  }

  const { data, error } = await queryBuilder.limit(limit);

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
// INITIALIZATION
// ============================================================

console.log('✅ Supabase client initialized');
console.log('📊 Project:', SUPABASE_URL);
