-- ============================================================
-- NUTRITION SYSTEM - MIGRATION v2
-- Run this in the Supabase SQL editor AFTER database-schema.sql
-- Forward-only. Safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES: training quiz + computed nutrition targets
-- ------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_fat_pct              DECIMAL(4,1) CHECK (body_fat_pct > 0 AND body_fat_pct < 75);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_sessions_per_week INTEGER     CHECK (training_sessions_per_week BETWEEN 0 AND 21);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_avg_minutes      INTEGER      CHECK (training_avg_minutes BETWEEN 0 AND 360);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_intensity        TEXT         CHECK (training_intensity IN ('easy', 'moderate', 'hard'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_modalities       TEXT[]       DEFAULT '{}';  -- ['strength','calisthenics','hiit','cardio','sport','yoga_mobility']
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_activity             TEXT          CHECK (job_activity IN ('sedentary', 'light', 'moderate', 'active', 'very_active'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS est_training_kcal_week    INTEGER      CHECK (est_training_kcal_week >= 0);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS est_training_kcal_day     INTEGER      CHECK (est_training_kcal_day >= 0);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goal_rate                TEXT          CHECK (goal_rate IN ('easy', 'moderate', 'aggressive')) DEFAULT 'moderate';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_fiber             DECIMAL(6,2)  CHECK (target_fiber >= 0);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS micronutrient_targets    JSONB         DEFAULT '{}'::jsonb;  -- { iron: 18, calcium: 1000, ... } snapshot at onboarding
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region_preferences       TEXT[]        DEFAULT '{}';  -- ['indian','western','mediterranean','east_asian','middle_eastern','latin']
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS diet_pattern             TEXT          CHECK (diet_pattern IN ('omnivore', 'vegetarian', 'vegan', 'pescatarian', 'eggetarian')) DEFAULT 'omnivore';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS intolerances             TEXT[]        DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS budget_tier              TEXT          CHECK (budget_tier IN ('low', 'medium', 'high')) DEFAULT 'medium';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS units                    TEXT          CHECK (units IN ('metric', 'imperial')) DEFAULT 'metric';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS condition_notes          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nutrition_onboarded_at   TIMESTAMPTZ;

-- Existing schema restricts goal to ('lose_weight','maintain','gain_muscle','health').
-- Add 'recomp' as an allowed goal.
DO $$
BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_goal_check;
  ALTER TABLE profiles ADD CONSTRAINT profiles_goal_check
    CHECK (goal IN ('lose_weight', 'maintain', 'gain_muscle', 'health', 'recomp'));
END $$;

-- ------------------------------------------------------------
-- 2. FOODS: regional tagging so onboarding can show a focused subset
-- ------------------------------------------------------------
ALTER TABLE foods ADD COLUMN IF NOT EXISTS regions TEXT[] DEFAULT '{}';
-- values: 'indian','western','mediterranean','east_asian','middle_eastern','latin','universal'
CREATE INDEX IF NOT EXISTS foods_regions_idx ON foods USING GIN(regions);

-- Iodine is tracked by the thyroid guidance + gap engine but is absent from the
-- original schema. Add it (mcg per serving).
ALTER TABLE foods ADD COLUMN IF NOT EXISTS iodine DECIMAL(8,2);

-- Household ("countable") unit so the UI can show "2 eggs" / "1 cup" / "250 ml"
-- instead of only grams. Nutrition is still stored per 100 g/ml; these are for
-- display + input convenience only.
ALTER TABLE foods ADD COLUMN IF NOT EXISTS household_unit  TEXT;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS household_grams DECIMAL(8,2) CHECK (household_grams > 0);
ALTER TABLE foods ADD COLUMN IF NOT EXISTS household_kind  TEXT CHECK (household_kind IN ('count', 'measure', 'liquid'));
ALTER TABLE foods ADD COLUMN IF NOT EXISTS is_liquid       BOOLEAN DEFAULT false;

-- Unique name so the seed importer can upsert (ON CONFLICT (name)).
CREATE UNIQUE INDEX IF NOT EXISTS foods_name_unique_idx ON foods(name);

-- ------------------------------------------------------------
-- 3. FOOD PREFERENCES: per-user like / dislike (structured, replaces free-text)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_preferences (
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  food_id    UUID REFERENCES foods(id) ON DELETE CASCADE,
  stance     TEXT NOT NULL CHECK (stance IN ('love', 'like', 'dislike', 'never')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, food_id)
);

CREATE INDEX IF NOT EXISTS food_preferences_user_idx ON food_preferences(user_id);

ALTER TABLE food_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'food_preferences' AND policyname = 'Users manage own food preferences'
  ) THEN
    CREATE POLICY "Users manage own food preferences" ON food_preferences
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. MEAL PLAN MEALS: free-text meal name
-- ------------------------------------------------------------
ALTER TABLE meal_plan_meals ADD COLUMN IF NOT EXISTS title TEXT;

-- ------------------------------------------------------------
-- 5. MEAL PLAN GAPS: the "necessity engine" state
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meal_plan_gaps (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_plan_id         UUID REFERENCES meal_plans(id) ON DELETE CASCADE NOT NULL,
  nutrient             TEXT NOT NULL,              -- 'iron', 'protein', 'fiber', 'sodium', ...
  severity             TEXT NOT NULL CHECK (severity IN ('critical', 'low', 'excess')),
  status               TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'dismissed')) DEFAULT 'open',
  intake               DECIMAL(10,2),
  target               DECIMAL(10,2),
  suggested_food_ids   UUID[] DEFAULT '{}',
  resolved_with_food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (meal_plan_id, nutrient)
);

CREATE INDEX IF NOT EXISTS meal_plan_gaps_plan_idx ON meal_plan_gaps(meal_plan_id);

ALTER TABLE meal_plan_gaps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'meal_plan_gaps' AND policyname = 'Users manage gaps on own meal plans'
  ) THEN
    CREATE POLICY "Users manage gaps on own meal plans" ON meal_plan_gaps
      FOR ALL USING (
        EXISTS (SELECT 1 FROM meal_plans mp WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid())
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM meal_plans mp WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid())
      );
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6. TIMESTAMP TRIGGERS for the new tables
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS update_food_preferences_updated_at ON food_preferences;
CREATE TRIGGER update_food_preferences_updated_at BEFORE UPDATE ON food_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meal_plan_gaps_updated_at ON meal_plan_gaps;
CREATE TRIGGER update_meal_plan_gaps_updated_at BEFORE UPDATE ON meal_plan_gaps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'Nutrition migration v2 applied.';
END $$;
