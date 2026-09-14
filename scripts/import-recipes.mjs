/**
 * import-recipes.mjs — expand scripts/recipes-seed.json into `recipes` +
 * `recipe_ingredients` rows and upsert them into Supabase.
 *
 * Each ingredient's `food` name is looked up against the already-imported
 * `foods` table (run scripts/import-foods.mjs first). Requires SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY in .env (service role — the anon key can't write to
 * `recipes`/`recipe_ingredients`).
 *
 *   node scripts/import-recipes.mjs           # upsert all
 *   node scripts/import-recipes.mjs --dry     # print the first expanded recipe, no write
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');

async function loadEnv() {
  try {
    const raw = await readFile(path.join(projectDir, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env — rely on real env vars */
  }
}

function expand(r) {
  const [calories, protein, carbs, fats, fiber, sugar, sodium] = r.n;
  return {
    name: r.name,
    description: r.description || '',
    instructions: r.instructions || [],
    prep_time: r.prepTime ?? 0,
    cook_time: r.cookTime ?? 0,
    servings: r.servings ?? 1,
    difficulty: r.difficulty || 'medium',
    cuisine: r.cuisine || null,
    meal_types: r.mealTypes || [],
    calories, protein, carbs, fats, fiber, sugar, sodium,
    allergens: r.alg || [],
    dietary_tags: r.tags || [],
    submission_status: 'approved',
    verified: true,
    ingredients: (r.ingredients || []).map((ing, i) => ({ ...ing, order_index: i })),
  };
}

async function main() {
  await loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun = process.argv.includes('--dry');

  const parsed = JSON.parse(await readFile(path.join(__dirname, 'recipes-seed.json'), 'utf8'));
  const recipes = parsed.recipes.map(expand);
  console.log(`Expanded ${recipes.length} recipes from recipes-seed.json`);

  if (dryRun) {
    console.log(JSON.stringify(recipes[0], null, 2));
    return;
  }

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  // Build a food-name -> id lookup once.
  const foodsRes = await fetch(`${url}/rest/v1/foods?select=id,name&limit=2000`, { headers });
  if (!foodsRes.ok) {
    console.error('Failed to load foods for ingredient lookup:', await foodsRes.text());
    process.exit(1);
  }
  const foodByName = new Map((await foodsRes.json()).map((f) => [f.name, f.id]));

  let ok = 0;
  for (const r of recipes) {
    const missing = r.ingredients.filter((ing) => !foodByName.has(ing.food));
    if (missing.length) {
      console.error(`Skipping "${r.name}" — unknown food(s): ${missing.map((m) => m.food).join(', ')}`);
      continue;
    }

    // Remove any previous version of this recipe (name has no DB unique
    // constraint, so this script owns idempotency: delete-then-insert).
    const existing = await fetch(`${url}/rest/v1/recipes?name=eq.${encodeURIComponent(r.name)}&select=id`, { headers });
    const existingRows = existing.ok ? await existing.json() : [];
    for (const row of existingRows) {
      await fetch(`${url}/rest/v1/recipes?id=eq.${row.id}`, { method: 'DELETE', headers });
    }

    const { ingredients, ...recipeRow } = r;
    const insertRes = await fetch(`${url}/rest/v1/recipes`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(recipeRow),
    });
    if (!insertRes.ok) {
      console.error(`Failed to insert "${r.name}":`, await insertRes.text());
      continue;
    }
    const [inserted] = await insertRes.json();

    const ingredientRows = ingredients.map((ing) => ({
      recipe_id: inserted.id,
      food_id: foodByName.get(ing.food),
      amount: ing.amount,
      unit: ing.unit,
      order_index: ing.order_index,
    }));
    const ingRes = await fetch(`${url}/rest/v1/recipe_ingredients`, {
      method: 'POST',
      headers,
      body: JSON.stringify(ingredientRows),
    });
    if (!ingRes.ok) {
      console.error(`Failed to insert ingredients for "${r.name}":`, await ingRes.text());
      continue;
    }

    ok++;
    console.log(`  upserted ${ok}/${recipes.length}: ${r.name}`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
