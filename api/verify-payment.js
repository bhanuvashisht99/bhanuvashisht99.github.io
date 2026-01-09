import crypto from 'crypto';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customer_email
    } = req.body;

    // Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !customer_email) {
      return res.status(400).json({
        error: 'Missing required payment details'
      });
    }

    // Verify payment signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Direct Google Drive download link (simpler, more reliable)
    const googleDriveFileId = '1MpqzbYwT2ymiAAo6ifInehRN1mhG4KwQ';
    const downloadLink = `https://drive.google.com/uc?export=download&id=${googleDriveFileId}`;
    const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days (informational)

    // Send email with download link
    await sendDownloadEmail(customer_email, downloadLink, expiryDate);

    // In a real implementation, you would store the order details in a database
    // For now, we'll just return success

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      downloadLink: downloadLink
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      error: 'Failed to verify payment',
      message: error.message
    });
  }
}

async function sendDownloadEmail(email, downloadLink, expiryDate) {
  // Create email transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // Email content
  const mailOptions = {
    from: `"Bhanu Vashisht" <${process.env.EMAIL_USER}>`,
    to: email,
    replyTo: process.env.EMAIL_USER,
    subject: 'Your Lower Back Pain Guide - Download Link',
    headers: {
      'X-Priority': '1',
      'X-MSMail-Priority': 'High',
      'Importance': 'high'
    },
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #7c3aed 50%, #ff6b35 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Thank You for Your Purchase!</h1>
        </div>
        <div class="content">
          <h2>Your Lower Back Pain Guide is Ready</h2>
          <p>Thank you for investing in your health and recovery. Your PDF guide is ready to download.</p>

          <p style="text-align: center;">
            <a href="${downloadLink}" class="button">Download Your PDF Guide</a>
          </p>

          <p><strong>Important:</strong></p>
          <ul>
            <li>Download and save the PDF to your device for lifetime access</li>
            <li>The PDF is password-protected against editing to preserve the content</li>
            <li>If you have any issues downloading, reply to this email</li>
          </ul>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

          <h3>Need More Personalized Help?</h3>
          <p>If you want 1-on-1 coaching to address your specific situation, book a personal training session for $75 USD / €65 EUR / ₹6,750 INR.</p>
          <p><a href="https://wa.me/918448222454">Contact me on WhatsApp</a></p>
        </div>
        <div class="footer">
          <p>Bhanu Vashisht - Online Personal Training</p>
          <p>Email: bhanuvashisht99@gmail.com | WhatsApp: +91 8448222454</p>
        </div>
      </body>
      </html>
    `,
  };

  // Send email
  await transporter.sendMail(mailOptions);
}
