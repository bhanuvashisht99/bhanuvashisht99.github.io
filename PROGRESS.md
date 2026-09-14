# In-Progress Work

Living doc for work that's underway but not finished/shipped. Keep this
updated as things progress — it's the place to look (in the repo, no memory
required) to pick a workstream back up.

---

## Nutrition System — feature-complete, unpushed, nav hidden

**Status (2026-09-14):** Built, tested, and pushed to `main` deployed to
production. Nav link is intentionally **hidden** on the homepage (still
considered dev/testing) — the pages are live at `/nutrition` for direct
testing only, not linked from the site.

To re-enable public nav: unhide the two `<li>` entries commented out in
`index.html` (search for "Nutrition system is still in dev/testing").

### What's built

| Surface | Files |
|---|---|
| Hub / dashboard | `nutrition.html`, `js/nutrition/hub-page.js` |
| Onboarding quiz (9 steps → computed targets) | `nutrition-onboarding.html`, `js/nutrition/onboarding-page.js` |
| Weekly plan (generator + nutrient-gap engine) | `nutrition-plan.html`, `js/nutrition/plan-page.js` |
| Daily food log | `nutrition-log.html`, `js/nutrition/log-page.js` |
| Recipe browser (13 seeded recipes) | `recipes.html`, `js/nutrition/recipes-page.js` |
| Logic core (unit-tested, no DOM) | `js/modules/nutrition/*.js` — `energy.js`, `targets.js`, `conditions.js`, `rda.js`, `food-model.js`, `food-filter.js`, `plan-generator.js`, `nutrient-gap.js`, `portion.js` |
| DB access layer | `js/modules/supabase-client.js` (nutrition section, bottom of file) |

**107 unit tests passing** — `npm test`. Local manual testing:
`node scripts/static-server.mjs 4173` → http://localhost:4173/nutrition
(demo login: `demo@youdeservewell.test` / `demo-Test-123456`).

### Live Supabase state (already done — don't redo)

- `database-schema.sql` + `database/nutrition-v2.sql` both applied to
  production Supabase. (`database-schema.sql` had a real bug fixed along the
  way: `foods_search_idx` used `array_to_string` in an index expression,
  illegal since it's not IMMUTABLE — replaced with a plain GIN index on
  `name_aliases`.)
- **176 foods** seeded (`scripts/seed-foods.json` → `npm run seed:foods`), all
  with household units (eggs, cups, tbsp, ml — see `portion.js`), tagged
  across indian/western/mediterranean/east_asian/middle_eastern/latin/universal.
- **13 recipes** seeded (`scripts/recipes-seed.json` → `npm run seed:recipes`).
- Fixed a pre-existing bug in `searchRecipes()` in `supabase-client.js` — it
  selected a `foods.nutrition` column that never existed (every call 400'd).
- Sign-up confirmation emails: using **Supabase's default built-in mailer**
  (not custom SMTP) — fine at current expected signup volume. The repo's
  `EMAIL_*` env vars are for a *different* flow (Razorpay/Stripe PDF-purchase
  delivery via nodemailer) and are unrelated to Supabase Auth.

### Known limitation (design tradeoff, not a bug)

The plan generator is a macro-correct greedy solver, not a recipe engine — it
hits calorie/protein/fibre targets and respects diet/allergy/glycemic-load
constraints well (verified across 8 diverse profiles: Indian, vegan,
pescatarian, T2D, hypertension — 98–101% of calorie target, sane item counts,
glycemic-load ceiling respected exactly), but individual meal *combinations*
can still read as mechanical rather than like a dish a person would actually
plan. The recipe browser is a first step toward fixing that, but the weekly
plan generator doesn't pull from recipes yet — that's the natural next step.

### Security note

The Supabase DB password was rotated 2026-09-11 (the old one had been
committed in plaintext in `SETUP_COMPLETE.md`, since scrubbed from the current
file — new password lives only in the local, gitignored `.env` as
`SUPABASE_DB_PASSWORD`). **The old, now-dead password is still sitting in a
past git commit's history** — low risk since it's rotated and inert, but
should be scrubbed with `git filter-repo` + a force-push at some point.

### Next steps

1. Let the plan generator slot in whole recipes, not just raw foods.
2. Expand food/recipe variety further.
3. When ready to go fully live: unhide the nav link, scrub the old DB password
   from git history.
