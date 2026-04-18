import Stripe from 'stripe';
import nodemailer from 'nodemailer';

const CORS_HEADERS = {
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  'Access-Control-Allow-Headers':
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
};

const PRODUCT_FILES = {
  'lower-back-pain-guide': '1MpqzbYwT2ymiAAo6ifInehRN1mhG4KwQ',
  'handstand-guide': '1f5XfaSx2EZyHioYHM4Z31lBfuh-IKLcK',
};

const PRODUCT_CONTENT = {
  'lower-back-pain-guide': {
    subject: 'Your Lower Back Pain Guide - Download Link',
    title: 'Your Lower Back Pain Guide is Ready',
    description: 'Thank you for investing in your health and recovery. Your PDF guide is ready to download.',
    helpText: 'If you want 1-on-1 coaching to address your specific situation, book a personal training session for $75 USD / €65 EUR / ₹6,750 INR.',
  },
  'handstand-guide': {
    subject: 'Your Handstand Guide - Download Link',
    title: 'Your Handstand Guide is Ready',
    description: 'Thank you for your purchase! Your step-by-step handstand guide is ready to download.',
    helpText: 'If you want 1-on-1 coaching to review your form and accelerate your progress, book a training session for $75 USD / €65 EUR / ₹6,750 INR.',
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
    const { session_id, product } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ success: false, error: 'Payment not completed' });
    }

    const customerEmail = session.customer_email || session.metadata?.customer_email;
    const productType = product || session.metadata?.product || 'lower-back-pain-guide';

    const fileId = PRODUCT_FILES[productType] || PRODUCT_FILES['lower-back-pain-guide'];
    const downloadLink = `https://drive.google.com/uc?export=download&id=${fileId}`;

    await sendDownloadEmail(customerEmail, downloadLink, productType);

    return res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error verifying Stripe session:', error);
    return res.status(500).json({ error: 'Failed to verify session', message: error.message });
  }
}

async function sendDownloadEmail(email, downloadLink, productType) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const content = PRODUCT_CONTENT[productType] || PRODUCT_CONTENT['lower-back-pain-guide'];

  await transporter.sendMail({
    from: `"Bhanu Vashisht" <${process.env.EMAIL_USER}>`,
    to: email,
    replyTo: process.env.EMAIL_USER,
    subject: content.subject,
    headers: { 'X-Priority': '1', 'X-MSMail-Priority': 'High', Importance: 'high' },
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #7c3aed 50%, #ff6b35 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 50px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header"><h1>Thank You for Your Purchase!</h1></div>
        <div class="content">
          <h2>${content.title}</h2>
          <p>${content.description}</p>
          <p style="text-align: center;"><a href="${downloadLink}" class="button">Download Your PDF Guide</a></p>
          <p><strong>Important:</strong></p>
          <ul>
            <li>Download and save the PDF to your device for lifetime access</li>
            <li>The PDF is password-protected against editing to preserve the content</li>
            <li>If you have any issues downloading, reply to this email</li>
          </ul>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <h3>Need More Personalized Help?</h3>
          <p>${content.helpText}</p>
          <p><a href="https://wa.me/918448222454">Contact me on WhatsApp</a></p>
        </div>
        <div class="footer">
          <p>Bhanu Vashisht - Online Personal Training</p>
          <p>Email: bhanuvashisht99@gmail.com | WhatsApp: +91 8448222454</p>
        </div>
      </body>
      </html>
    `,
  });
}
