# Meta Ads — London back-pain WhatsApp campaign

Creates a click-to-WhatsApp **Engagement / Conversations** campaign via the Meta
Marketing API. **Everything is created PAUSED** — nothing spends money until you
review it in Ads Manager and switch it to Active yourself.

## What it builds

- **Campaign:** `London – Back Pain – WhatsApp` (objective: Engagement)
- **Ad set:** London (UK), living-in, +40km · age 32–55 · ₹2,500/day · optimised
  for WhatsApp **Conversations**
- **2 ads:** "Tried Everything" + "Not Just Age" (both point to WhatsApp)

## Setup

1. **Connect WhatsApp to your Page** (once): Meta Business Suite → Settings →
   WhatsApp → Connect. The ad can't run without this.

2. **Get a token + IDs.** In [business.facebook.com](https://business.facebook.com)
   → Business Settings:
   - **System Users** → generate a token with `ads_management` +
     `business_management` scopes.
   - Note your **ad account id** (`act_…`) and **Page id**.

3. **Configure:**
   ```bash
   cd meta-ads
   cp .env.example .env
   # edit .env with your token + ids
   ```

4. **Add your image** — drop a `creative.jpg` (1080×1080 or 1080×1350) in this
   folder (or point `IMAGE_PATH` at it). Images are gitignored.

5. **Run:**
   ```bash
   node create-campaign.js
   ```

6. **Review & publish.** Open the link it prints, sanity-check the ads and the
   WhatsApp greeting, then switch the campaign to **Active**.

## Notes

- The **WhatsApp pre-filled greeting** and creative preview are best confirmed in
  the Ads Manager UI after the script runs.
- Budget is in ₹ (`DAILY_BUDGET_INR`), converted to paise for the API.
- Re-running creates a **duplicate** campaign — delete the old one first if you
  re-run.
- Click-to-WhatsApp is the fiddliest creative type; if a creative call fails,
  the error (with Meta's code) is printed so it can be adjusted.

## Live campaign (launched 2026-07-11)

Built via a mix of this script (campaign, ad set, image) + Ads Manager UI (the
creatives — the Meta app is in Development mode, which blocks creative creation
via the API with error #1885183).

- **Ad account** `act_1059465472287050` (main, INR). Postpaid VISA *0094 **plus**
  a prepaid **Funds** balance (~₹80k) that Meta spends FIRST, card only as backup.
  The API `balance` field only shows postpaid owed amount, NOT the Funds wallet.
- **Campaign** `120252160505480057` — "London – Pain & Strength – Instagram DM"
- **Ad set** `120252160552820057` — Instagram DM + Max Conversations, women 32–55,
  London +40km, no interests (advantage_audience off), ₹2,500/day (ABO, shared
  across both ads)
- **Ads:** two hooks — strength+pain+posture combined, and pure-pain

Gotchas: Europe blocks Max Conversations for WhatsApp (use Instagram DM single
destination); Europe removed location sub-types (omit `location_types`); campaign
needs `is_adset_budget_sharing_enabled` and the ad set needs an explicit
`bid_strategy`. Graph API Explorer tokens expire in ~1–2h.
