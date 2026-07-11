#!/usr/bin/env node
/**
 * Creates a click-to-WhatsApp "Engagement / Conversations" campaign in Meta Ads.
 *
 * Everything is created PAUSED. Nothing spends money until YOU review it in
 * Ads Manager and switch it to Active yourself.
 *
 * Run:   node create-campaign.js
 * Config comes from a local `.env` file (see .env.example) — never commit it.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Minimal .env loader (no dependency) -----------------------------------
function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env file — rely on real environment variables */
  }
}
loadEnv();

// --- Config ----------------------------------------------------------------
const API_VERSION = process.env.META_API_VERSION || 'v23.0';
const TOKEN = required('META_ACCESS_TOKEN');
const AD_ACCOUNT = required('META_AD_ACCOUNT_ID').replace(/^act_/, '');
const PAGE_ID = required('META_PAGE_ID');
const WA_NUMBER = required('META_WHATSAPP_NUMBER').replace(/[^0-9]/g, ''); // e.g. 918448222454
const DAILY_BUDGET_INR = Number(process.env.DAILY_BUDGET_INR || 2500);
const IMAGE_PATH = required('IMAGE_PATH');

const BASE = `https://graph.facebook.com/${API_VERSION}`;

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`\n❌ Missing required config: ${name}\n   Set it in meta-ads/.env (see .env.example)\n`);
    process.exit(1);
  }
  return v;
}

// --- Graph API helper ------------------------------------------------------
async function graph(path, params) {
  const body = new URLSearchParams({ access_token: TOKEN });
  for (const [k, v] of Object.entries(params || {})) {
    body.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  const res = await fetch(`${BASE}/${path}`, { method: 'POST', body });
  const json = await res.json();
  if (json.error) {
    throw new Error(`${json.error.message} (code ${json.error.code}${json.error.error_subcode ? '/' + json.error.error_subcode : ''})`);
  }
  return json;
}

async function graphGet(path, params) {
  const qs = new URLSearchParams({ access_token: TOKEN, ...params });
  const res = await fetch(`${BASE}/${path}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json;
}

// --- Creative copy (edit freely) -------------------------------------------
const ADS = [
  {
    name: 'Ad 1 - Tried Everything',
    message:
      "Still in pain after doctors, physio, rest, and endless exercises?\n\n" +
      "Lower back, neck, or shoulder pain doesn't have to be permanent. I coach you 1-on-1, online, to find what's actually causing it — and fix it for good using biomechanics, not guesswork.\n\n" +
      "Most clients move pain-free within 6–8 weeks. Message me and tell me where it hurts. 👇",
    headline: 'Move Without Pain — Online 1-on-1 Coaching',
    description: 'Personalised, biomechanics-based. Train from anywhere.',
  },
  {
    name: 'Ad 2 - Not Just Age',
    message:
      'You\'ve been told the back pain is "just your age." It isn\'t.\n\n' +
      'Most stiffness and pain comes from how you move — not how old you are. I fix the root cause with personalised, biomechanics-based coaching, 1-on-1 over video, from anywhere in the world.\n\n' +
      'No gym needed. No guesswork. Just a plan that actually works. Message me to start. 👇',
    headline: 'Your Back Pain Isn\'t "Just Age"',
    description: 'Online 1-on-1 coaching. Pain-free in 6–8 weeks.',
  },
];

// --- Main ------------------------------------------------------------------
async function main() {
  console.log(`\n🚀 Creating London back-pain WhatsApp campaign (all PAUSED)\n`);

  // 1. Resolve London (UK) geo key
  console.log('→ Looking up London (UK) targeting key…');
  const geo = await graphGet('search', {
    type: 'adgeolocation',
    location_types: JSON.stringify(['city']),
    q: 'London',
  });
  const london = geo.data.find((c) => c.country_code === 'GB' && /london/i.test(c.name));
  if (!london) throw new Error('Could not find London, GB in geo search.');
  console.log(`  ✓ London key = ${london.key}\n`);

  // 2. Campaign
  console.log('→ Creating campaign…');
  const campaign = await graph(`act_${AD_ACCOUNT}/campaigns`, {
    name: 'London – Back Pain – WhatsApp',
    objective: 'OUTCOME_ENGAGEMENT',
    status: 'PAUSED',
    special_ad_categories: [],
  });
  console.log(`  ✓ campaign ${campaign.id}\n`);

  // 3. Ad set — optimise for WhatsApp conversations
  console.log('→ Creating ad set…');
  const adset = await graph(`act_${AD_ACCOUNT}/adsets`, {
    name: 'London 32-55 – BackPain',
    campaign_id: campaign.id,
    status: 'PAUSED',
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'CONVERSATIONS',
    destination_type: 'WHATSAPP',
    daily_budget: Math.round(DAILY_BUDGET_INR * 100), // INR → paise
    promoted_object: { page_id: PAGE_ID },
    targeting: {
      geo_locations: {
        location_types: ['home'],
        cities: [{ key: london.key, radius: 40, distance_unit: 'kilometer' }],
      },
      age_min: 32,
      age_max: 55,
    },
  });
  console.log(`  ✓ ad set ${adset.id}  (₹${DAILY_BUDGET_INR}/day)\n`);

  // 4. Upload image (base64 bytes — no multipart needed)
  console.log('→ Uploading image…');
  const bytes = readFileSync(resolve(__dirname, IMAGE_PATH)).toString('base64');
  const img = await graph(`act_${AD_ACCOUNT}/adimages`, { bytes });
  const imageHash = Object.values(img.images)[0].hash;
  console.log(`  ✓ image hash ${imageHash}\n`);

  // 5 + 6. Creatives and ads
  const waLink = `https://api.whatsapp.com/send?phone=${WA_NUMBER}`;
  for (const ad of ADS) {
    console.log(`→ Creating creative + ad: ${ad.name}`);
    const creative = await graph(`act_${AD_ACCOUNT}/adcreatives`, {
      name: `${ad.name} – creative`,
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          message: ad.message,
          name: ad.headline,
          description: ad.description,
          image_hash: imageHash,
          link: waLink,
          call_to_action: {
            type: 'WHATSAPP_MESSAGE',
            value: { app_destination: 'WHATSAPP' },
          },
        },
      },
    });
    const madeAd = await graph(`act_${AD_ACCOUNT}/ads`, {
      name: ad.name,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    });
    console.log(`  ✓ ad ${madeAd.id}\n`);
  }

  console.log('✅ Done. Everything is PAUSED.');
  console.log('   Review it here, then switch to Active to go live:');
  console.log(`   https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${AD_ACCOUNT}\n`);
  console.log('   ⚠️  Before publishing: confirm the WhatsApp greeting + creative look right,');
  console.log('       and that your WhatsApp number is connected to the Page.\n');
}

main().catch((err) => {
  console.error(`\n❌ Failed: ${err.message}\n`);
  process.exit(1);
});
