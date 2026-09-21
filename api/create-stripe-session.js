import Stripe from 'stripe';
import { resolveAmountInSmallestUnit } from './_price-catalog.js';

const ALLOWED_ORIGIN = process.env.BASE_URL || 'https://youdeservewell.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const PRODUCT_NAMES = {
  'lower-back-pain-guide': {
    'pdf-only': 'Lower Back Pain PDF Guide',
    'pdf-consultation': 'PDF Guide + 30min Consultation',
    'pdf-sessions': 'PDF Guide + 2 Training Sessions',
  },
  'handstand-guide': {
    'pdf-only': 'Handstand Guide PDF',
    'pdf-consultation': 'Handstand PDF + 30min Consultation',
    'pdf-sessions': 'Handstand PDF + 2 Training Sessions',
  },
};

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      currency = 'USD',
      customerEmail,
      productOption,
      product = 'lower-back-pain-guide',
    } = req.body;

    if (!customerEmail || !productOption) {
      return res.status(400).json({ error: 'Customer email and product option are required' });
    }

    // Price is looked up server-side from the product catalog — the client
    // only selects *which* product/option/currency, it never sets the price.
    const amount = resolveAmountInSmallestUnit(product, productOption, currency);
    if (amount === null) {
      return res.status(400).json({ error: 'Unknown product, option, or currency' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const names = PRODUCT_NAMES[product] || PRODUCT_NAMES['lower-back-pain-guide'];
    const productName = names[productOption] || 'Digital Guide';

    const baseUrl = process.env.BASE_URL || 'https://youdeservewell.com';

    const session = await stripe.checkout.sessions.create({
      automatic_payment_methods: { enabled: true },
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: productName, description: 'By Bhanu Vashisht' },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: customerEmail,
      success_url: `${baseUrl}/thank-you.html?session_id={CHECKOUT_SESSION_ID}&product=${encodeURIComponent(product)}`,
      cancel_url: `${baseUrl}/${product}.html`,
      metadata: { product, product_option: productOption, customer_email: customerEmail },
    });

    return res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    console.error('Error creating Stripe session:', error);
    return res.status(500).json({ error: 'Failed to create checkout session', message: error.message });
  }
}
