import Razorpay from 'razorpay';
import { resolveAmountInSmallestUnit } from './_price-catalog.js';

const ALLOWED_ORIGIN = process.env.BASE_URL || 'https://youdeservewell.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      currency = 'INR',
      customerEmail,
      productOption,
      product = 'lower-back-pain-guide',
    } = req.body;

    // Validate input
    if (!customerEmail || !productOption) {
      return res.status(400).json({
        error: 'Customer email and product option are required'
      });
    }

    // Price is looked up server-side from the product catalog — the client
    // only selects *which* product/option/currency, it never sets the price.
    // This prevents a tampered request from creating an order for an
    // arbitrary (e.g. near-zero) amount.
    const amount = resolveAmountInSmallestUnit(product, productOption, currency);
    if (amount === null) {
      return res.status(400).json({
        error: 'Unknown product, option, or currency'
      });
    }

    // Initialize Razorpay with your credentials
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // Create order
    const options = {
      amount: amount, // amount in paise, derived from the server-side catalog
      currency: currency,
      receipt: `order_${Date.now()}`,
      notes: {
        product,
        product_option: productOption,
        customer_email: customerEmail
      }
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return res.status(500).json({
      error: 'Failed to create order',
      message: error.message
    });
  }
}
