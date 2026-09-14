/**
 * import-foods.mjs — expand scripts/seed-foods.json (compact rows) into full
 * `foods` table rows and upsert them into Supabase.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (service role — the
 * anon key cannot write to `foods`). Run AFTER database/nutrition-v2.sql.
 *
 *   node scripts/import-foods.mjs           # upsert all
 *   node scripts/import-foods.mjs --dry     # print the first expanded row, no write
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');

// --- minimal .env loader (no dependency) ---
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

const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fats', 'fiber', 'sugar', 'sodium'];
const MICRO_KEYS = [
  'iron', 'calcium', 'magnesium', 'potassium', 'zinc', 'iodine',
  'selenium', 'folate', 'vitamin_b12', 'vitamin_d', 'vitamin_a', 'vitamin_c',
];

/** compact row -> full foods row */
function expand(row) {
  const isLiquid = Boolean(row.liq) || row.h?.[2] === 'liquid';
  const out = {
    name: row.n,
    name_aliases: row.aliases || [],
    category: row.cat,
    serving_amount: 100,
    serving_unit: isLiquid ? 'ml' : row.unit || 'g',
    glycemic_index: row.gi ?? null,
    regions: row.reg && row.reg.length ? row.reg : ['universal'],
    dietary_tags: row.tags || [],
    allergens: row.alg || [],
    // household ("countable") unit: h = [label, grams_per_unit, kind]
    household_unit: row.h?.[0] ?? null,
    household_grams: row.h?.[1] ?? null,
    household_kind: row.h?.[2] ?? null,
    is_liquid: isLiquid,
    source: 'manual',
    verified: true,
  };
  MACRO_KEYS.forEach((k, i) => (out[k] = row.m?.[i] ?? 0));
  MICRO_KEYS.forEach((k, i) => (out[k] = row.mi?.[i] ?? 0));
  return out;
}

async function main() {
  await loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun = process.argv.includes('--dry');

  const parsed = JSON.parse(await readFile(path.join(__dirname, 'seed-foods.json'), 'utf8'));
  const rows = parsed.foods.map(expand);
  console.log(`Expanded ${rows.length} foods from seed-foods.json`);

  if (dryRun) {
    console.log(JSON.stringify(rows[0], null, 2));
    return;
  }

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  // Upsert in batches on the unique `name` column. Requires a unique index on
  // foods(name); if absent, this inserts. De-dupe by name first to be safe.
  const seen = new Set();
  const unique = rows.filter((r) => (seen.has(r.name) ? false : seen.add(r.name)));

  const batchSize = 50;
  let ok = 0;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const res = await fetch(`${url}/rest/v1/foods?on_conflict=name`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error(`Batch ${i / batchSize + 1} failed: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    ok += batch.length;
    console.log(`  upserted ${ok}/${unique.length}`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
