-- ============================================================
-- COMPREHENSIVE NUTRITION SYSTEM - DATABASE SCHEMA
-- Supabase PostgreSQL
-- 14 Tables with Row-Level Security
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES TABLE (User Profile Extension)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,

  -- Profile info
  age INTEGER CHECK (age > 0 AND age < 150),
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  weight DECIMAL(5,2) CHECK (weight > 0), -- kg
  height DECIMAL(5,2) CHECK (height > 0), -- cm
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal TEXT CHECK (goal IN ('lose_weight', 'maintain', 'gain_muscle', 'health')),

  -- Calculated targets
  daily_calories INTEGER CHECK (daily_calories > 0),
  target_protein DECIMAL(5,2) CHECK (target_protein >= 0),
  target_carbs DECIMAL(5,2) CHECK (target_carbs >= 0),
  target_fats DECIMAL(5,2) CHECK (target_fats >= 0),

  -- Dietary restrictions (PostgreSQL arrays)
  allergies TEXT[] DEFAULT '{}',
  dietary_preferences TEXT[] DEFAULT '{}', -- ['vegetarian', 'vegan', 'halal', 'kosher', 'pescatarian']
  disliked_foods TEXT[] DEFAULT '{}',
  medical_conditions TEXT[] DEFAULT '{}', -- ['diabetes', 'celiac', 'hypertension']

  -- Meal preferences
  meals_per_day INTEGER DEFAULT 3 CHECK (meals_per_day BETWEEN 1 AND 6),
  cooking_skill TEXT CHECK (cooking_skill IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'intermediate',
  cooking_time INTEGER CHECK (cooking_time > 0), -- minutes
  cuisine_preferences TEXT[] DEFAULT '{}', -- ['indian', 'italian', 'mexican', 'chinese']

  -- Subscription
  subscription_plan TEXT CHECK (subscription_plan IN ('free', 'premium')) DEFAULT 'free',
  subscription_start_date TIMESTAMPTZ,
  subscription_expiry_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row-level security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- 2. FOODS TABLE
-- ============================================================
CREATE TABLE foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_aliases TEXT[] DEFAULT '{}', -- search aliases
  category TEXT NOT NULL CHECK (category IN ('protein', 'vegetable', 'fruit', 'grain', 'dairy', 'nuts', 'oils', 'legumes', 'processed')),

  -- Serving size
  serving_amount DECIMAL(10,2) NOT NULL CHECK (serving_amount > 0),
  serving_unit TEXT NOT NULL, -- "g", "ml", "cup", "tbsp"

  -- Macronutrients (per serving)
  calories DECIMAL(8,2),
  protein DECIMAL(8,2), -- g
  carbs DECIMAL(8,2),
  fats DECIMAL(8,2),
  fiber DECIMAL(8,2),
  sugar DECIMAL(8,2),
  sodium DECIMAL(8,2), -- mg
  cholesterol DECIMAL(8,2),

  -- Micronutrients (per serving)
  vitamin_a DECIMAL(8,2), -- mcg
  vitamin_c DECIMAL(8,2), -- mg
  vitamin_d DECIMAL(8,2),
  vitamin_e DECIMAL(8,2),
  vitamin_k DECIMAL(8,2),
  thiamin DECIMAL(8,2), -- B1
  riboflavin DECIMAL(8,2), -- B2
  niacin DECIMAL(8,2), -- B3
  vitamin_b6 DECIMAL(8,2),
  folate DECIMAL(8,2), -- B9
  vitamin_b12 DECIMAL(8,2),
  calcium DECIMAL(8,2),
  iron DECIMAL(8,2),
  magnesium DECIMAL(8,2),
  phosphorus DECIMAL(8,2),
  potassium DECIMAL(8,2),
  zinc DECIMAL(8,2),
  selenium DECIMAL(8,2),

  -- Allergens & dietary tags
  allergens TEXT[] DEFAULT '{}', -- ['dairy', 'gluten', 'soy', 'eggs', 'fish', 'shellfish', 'nuts', 'peanuts']
  dietary_tags TEXT[] DEFAULT '{}', -- ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'halal', 'kosher']

  -- Diabetes management
  glycemic_index INTEGER CHECK (glycemic_index BETWEEN 0 AND 100),

  -- Problem substances
  caffeine DECIMAL(8,2), -- mg
  alcohol DECIMAL(8,2), -- g
  added_sugar DECIMAL(8,2), -- g

  -- Metadata
  source TEXT CHECK (source IN ('usda', 'open_food_facts', 'manual')) DEFAULT 'manual',
  verified BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX foods_name_idx ON foods USING GIN(to_tsvector('english', name));
CREATE INDEX foods_category_idx ON foods(category);
CREATE INDEX foods_dietary_tags_idx ON foods USING GIN(dietary_tags);
CREATE INDEX foods_allergens_idx ON foods USING GIN(allergens);
CREATE INDEX foods_source_idx ON foods(source);

-- Full-text search support
CREATE INDEX foods_search_idx ON foods USING GIN(
  to_tsvector('english', name || ' ' || COALESCE(array_to_string(name_aliases, ' '), ''))
);

-- Public read access (everyone can search foods)
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Foods are viewable by everyone" ON foods
  FOR SELECT USING (true);

-- ============================================================
-- 3. FOOD ALTERNATIVES TABLE
-- ============================================================
CREATE TABLE food_alternatives (
  food_id UUID REFERENCES foods(id) ON DELETE CASCADE,
  alternative_food_id UUID REFERENCES foods(id) ON DELETE CASCADE,
  similarity_score DECIMAL(3,2) CHECK (similarity_score BETWEEN 0 AND 1), -- 0.00 to 1.00
  PRIMARY KEY (food_id, alternative_food_id),
  CHECK (food_id != alternative_food_id)
);

-- ============================================================
-- 4. RECIPES TABLE
-- ============================================================
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,

  instructions TEXT[] NOT NULL, -- step-by-step array
  prep_time INTEGER CHECK (prep_time >= 0), -- minutes
  cook_time INTEGER CHECK (cook_time >= 0),
  servings INTEGER NOT NULL CHECK (servings > 0),
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  cuisine TEXT,
  meal_types TEXT[] DEFAULT '{}', -- ['breakfast', 'lunch', 'dinner', 'snack']

  -- Calculated nutrition per serving
  calories DECIMAL(8,2),
  protein DECIMAL(8,2),
  carbs DECIMAL(8,2),
  fats DECIMAL(8,2),
  fiber DECIMAL(8,2),
  sugar DECIMAL(8,2),
  sodium DECIMAL(8,2),

  -- Aggregated from ingredients
  allergens TEXT[] DEFAULT '{}',
  dietary_tags TEXT[] DEFAULT '{}',

  -- Ratings & engagement
  rating DECIMAL(2,1) CHECK (rating BETWEEN 0 AND 5),
  ratings_count INTEGER DEFAULT 0,

  -- Media
  image_url TEXT,
  video_url TEXT, -- YouTube embed

  -- User submissions
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  submission_status TEXT CHECK (submission_status IN ('draft', 'pending', 'approved', 'rejected')) DEFAULT 'approved',
  verified BOOLEAN DEFAULT false,

  -- Meal prep features
  meal_prep_friendly BOOLEAN DEFAULT false,
  storage_instructions TEXT,
  reheating_instructions TEXT,
  batch_multiplier INTEGER CHECK (batch_multiplier > 0), -- servings in a batch

  -- AI generation
  generated_from_image BOOLEAN DEFAULT false,
  source_image_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX recipes_name_idx ON recipes USING GIN(to_tsvector('english', name));
CREATE INDEX recipes_meal_types_idx ON recipes USING GIN(meal_types);
CREATE INDEX recipes_dietary_tags_idx ON recipes USING GIN(dietary_tags);
CREATE INDEX recipes_difficulty_idx ON recipes(difficulty);
CREATE INDEX recipes_submission_status_idx ON recipes(submission_status);
CREATE INDEX recipes_created_by_idx ON recipes(created_by);

-- Row-level security
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved recipes are viewable by everyone" ON recipes
  FOR SELECT USING (submission_status = 'approved');

CREATE POLICY "Users can view own recipes" ON recipes
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create recipes" ON recipes
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own recipes" ON recipes
  FOR UPDATE USING (auth.uid() = created_by);

-- ============================================================
-- 5. RECIPE INGREDIENTS TABLE
-- ============================================================
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  food_id UUID REFERENCES foods(id) ON DELETE RESTRICT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  unit TEXT NOT NULL,
  optional BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX recipe_ingredients_recipe_idx ON recipe_ingredients(recipe_id);
CREATE INDEX recipe_ingredients_food_idx ON recipe_ingredients(food_id);

-- ============================================================
-- 6. RECIPE INGREDIENT ALTERNATIVES TABLE
-- ============================================================
CREATE TABLE recipe_ingredient_alternatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_ingredient_id UUID REFERENCES recipe_ingredients(id) ON DELETE CASCADE,
  alternative_food_id UUID REFERENCES foods(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  unit TEXT NOT NULL
);

-- ============================================================
-- 7. RECIPE COLLECTIONS TABLE
-- ============================================================
CREATE TABLE recipe_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  cover_image_url TEXT,

  tags TEXT[] DEFAULT '{}',
  difficulty TEXT,
  duration TEXT, -- "30 days", "1 week"

  created_by UUID REFERENCES profiles(id),
  is_published BOOLEAN DEFAULT false,

  subscriber_count INTEGER DEFAULT 0,
  rating DECIMAL(2,1),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX recipe_collections_slug_idx ON recipe_collections(slug);
CREATE INDEX recipe_collections_tags_idx ON recipe_collections USING GIN(tags);
CREATE INDEX recipe_collections_published_idx ON recipe_collections(is_published);

-- Row-level security
ALTER TABLE recipe_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published collections viewable by everyone" ON recipe_collections
  FOR SELECT USING (is_published = true);

-- ============================================================
-- 8. RECIPE COLLECTION ITEMS TABLE
-- ============================================================
CREATE TABLE recipe_collection_items (
  collection_id UUID REFERENCES recipe_collections(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  PRIMARY KEY (collection_id, recipe_id)
);

-- ============================================================
-- 9. MEAL PLANS TABLE
-- ============================================================
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT CHECK (status IN ('active', 'completed', 'archived')) DEFAULT 'active',

  target_calories INTEGER,
  target_protein DECIMAL(8,2),
  target_carbs DECIMAL(8,2),
  target_fats DECIMAL(8,2),

  generated_by TEXT CHECK (generated_by IN ('algorithm', 'manual')) DEFAULT 'algorithm',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX meal_plans_user_status_idx ON meal_plans(user_id, status);
CREATE INDEX meal_plans_user_date_idx ON meal_plans(user_id, start_date);

-- Row-level security
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal plans" ON meal_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own meal plans" ON meal_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal plans" ON meal_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal plans" ON meal_plans
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 10. MEAL PLAN MEALS TABLE
-- ============================================================
CREATE TABLE meal_plan_meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack1', 'snack2')),

  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_servings DECIMAL(5,2),

  -- Calculated nutrition for this meal
  calories DECIMAL(8,2),
  protein DECIMAL(8,2),
  carbs DECIMAL(8,2),
  fats DECIMAL(8,2),

  time TIME, -- suggested time "08:00"
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX meal_plan_meals_plan_idx ON meal_plan_meals(meal_plan_id);
CREATE INDEX meal_plan_meals_date_idx ON meal_plan_meals(date);

-- ============================================================
-- 11. MEAL PLAN CUSTOM FOODS TABLE
-- ============================================================
CREATE TABLE meal_plan_custom_foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_plan_meal_id UUID REFERENCES meal_plan_meals(id) ON DELETE CASCADE NOT NULL,
  food_id UUID REFERENCES foods(id) ON DELETE RESTRICT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  unit TEXT NOT NULL
);

-- ============================================================
-- 12. FOOD LOGS TABLE (Daily Tracking Summary)
-- ============================================================
CREATE TABLE food_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,

  -- Daily totals (calculated from logged_items)
  total_calories DECIMAL(8,2) DEFAULT 0,
  total_protein DECIMAL(8,2) DEFAULT 0,
  total_carbs DECIMAL(8,2) DEFAULT 0,
  total_fats DECIMAL(8,2) DEFAULT 0,
  total_fiber DECIMAL(8,2) DEFAULT 0,
  total_sugar DECIMAL(8,2) DEFAULT 0,
  total_sodium DECIMAL(8,2) DEFAULT 0,

  -- Substance tracking
  total_caffeine DECIMAL(8,2) DEFAULT 0,
  total_alcohol DECIMAL(8,2) DEFAULT 0,
  total_added_sugar DECIMAL(8,2) DEFAULT 0,

  -- Goal adherence
  calories_diff DECIMAL(8,2),
  protein_diff DECIMAL(8,2),
  carbs_diff DECIMAL(8,2),
  fats_diff DECIMAL(8,2),
  adherence_percentage INTEGER CHECK (adherence_percentage BETWEEN 0 AND 100),

  water_intake INTEGER DEFAULT 0, -- ml
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date)
);

CREATE INDEX food_logs_user_date_idx ON food_logs(user_id, date);

-- Row-level security
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own food logs" ON food_logs
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 13. LOGGED ITEMS TABLE
-- ============================================================
CREATE TABLE logged_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  food_log_id UUID REFERENCES food_logs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack1', 'snack2')),
  logged_at TIMESTAMPTZ DEFAULT NOW(),

  -- Item type
  item_type TEXT CHECK (item_type IN ('recipe', 'food')) NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  food_id UUID REFERENCES foods(id) ON DELETE SET NULL,

  -- Amount
  servings DECIMAL(5,2),
  amount DECIMAL(10,2),
  unit TEXT,

  -- Snapshot of nutrition at time of logging
  calories DECIMAL(8,2),
  protein DECIMAL(8,2),
  carbs DECIMAL(8,2),
  fats DECIMAL(8,2),
  fiber DECIMAL(8,2),
  sugar DECIMAL(8,2),
  sodium DECIMAL(8,2),
  caffeine DECIMAL(8,2),
  alcohol DECIMAL(8,2),
  added_sugar DECIMAL(8,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK (
    (item_type = 'recipe' AND recipe_id IS NOT NULL) OR
    (item_type = 'food' AND food_id IS NOT NULL)
  )
);

CREATE INDEX logged_items_food_log_idx ON logged_items(food_log_id);
CREATE INDEX logged_items_user_idx ON logged_items(user_id);
CREATE INDEX logged_items_meal_type_idx ON logged_items(meal_type);

-- Row-level security
ALTER TABLE logged_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logged items" ON logged_items
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 14. REDUCTION PLANS TABLE
-- ============================================================
CREATE TABLE reduction_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  substance TEXT NOT NULL CHECK (substance IN ('sugar', 'caffeine', 'alcohol', 'sodium')),
  start_date DATE NOT NULL,
  target_date DATE NOT NULL,

  initial_amount DECIMAL(8,2) NOT NULL CHECK (initial_amount >= 0),
  target_amount DECIMAL(8,2) NOT NULL CHECK (target_amount >= 0),
  unit TEXT NOT NULL,

  weekly_reduction DECIMAL(8,2) NOT NULL,
  status TEXT CHECK (status IN ('active', 'completed', 'paused')) DEFAULT 'active',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK (target_amount < initial_amount)
);

CREATE INDEX reduction_plans_user_idx ON reduction_plans(user_id);
CREATE INDEX reduction_plans_status_idx ON reduction_plans(status);

-- Row-level security
ALTER TABLE reduction_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reduction plans" ON reduction_plans
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 15. REDUCTION PROGRESS TABLE
-- ============================================================
CREATE TABLE reduction_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES reduction_plans(id) ON DELETE CASCADE NOT NULL,

  substance TEXT NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number > 0),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,

  target_amount DECIMAL(8,2) NOT NULL,
  actual_amount DECIMAL(8,2),

  adherence_percentage INTEGER CHECK (adherence_percentage BETWEEN 0 AND 100),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(plan_id, week_number)
);

CREATE INDEX reduction_progress_user_idx ON reduction_progress(user_id);
CREATE INDEX reduction_progress_plan_idx ON reduction_progress(plan_id);

-- Row-level security
ALTER TABLE reduction_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reduction progress" ON reduction_progress
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 16. USER FAVORITES TABLE
-- ============================================================
CREATE TABLE user_favorites (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  favorite_recipes UUID[] DEFAULT '{}',
  favorite_foods UUID[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row-level security
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites" ON user_favorites
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 17. FREQUENTLY EATEN TABLE
-- ============================================================
CREATE TABLE frequently_eaten (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  item_type TEXT CHECK (item_type IN ('recipe', 'food')) NOT NULL,
  item_id UUID NOT NULL,
  count INTEGER DEFAULT 1,
  last_eaten DATE,

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, item_type, item_id)
);

CREATE INDEX frequently_eaten_user_idx ON frequently_eaten(user_id);

-- Row-level security
ALTER TABLE frequently_eaten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own frequently eaten" ON frequently_eaten
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_foods_updated_at BEFORE UPDATE ON foods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipe_collections_updated_at BEFORE UPDATE ON recipe_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_plans_updated_at BEFORE UPDATE ON meal_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_food_logs_updated_at BEFORE UPDATE ON food_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reduction_plans_updated_at BEFORE UPDATE ON reduction_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reduction_progress_updated_at BEFORE UPDATE ON reduction_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Database schema created successfully!';
    RAISE NOTICE '✅ 17 tables created with Row-Level Security';
    RAISE NOTICE '✅ All indexes and triggers configured';
    RAISE NOTICE '✅ Ready to start building!';
END $$;
