# PDF Product Setup Guide

This guide will help you set up the PDF payment system for your website.

## 📋 Overview

You now have a complete digital product sales system with:
- Product page (`lower-back-pain-guide.html`)
- Razorpay payment integration
- Secure payment verification
- Automatic email delivery of download links
- Thank you page

## 🚀 Quick Start

### 1. Prerequisites

- GitHub account (you already have this)
- Razorpay account (sign up at https://razorpay.com)
- Gmail account for sending emails (or any SMTP email service)
- Vercel account (free - sign up at https://vercel.com)

### 2. Setup Razorpay

1. Go to https://dashboard.razorpay.com/signup
2. Complete the signup process
3. Navigate to Settings → API Keys
4. Generate API keys (you'll see `Key ID` and `Key Secret`)
5. **Important**: Keep these secret! Never commit them to Git

#### Enable International Payments (Optional)
1. In Razorpay Dashboard, go to Settings → Payment Methods
2. Enable "International Payments"
3. Complete KYC verification if required

### 3. Setup Email (Gmail Example)

1. Go to your Gmail account
2. Enable 2-factor authentication
3. Generate an "App Password":
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Save this password (you'll use it as `EMAIL_PASSWORD`)

### 4. Add Your PDF File

1. Place your PDF in the `pdfs/` folder
2. Name it: `lower-back-pain-guide.pdf`
3. **Important**: Don't commit the PDF to GitHub (it's in .gitignore)

### 5. Add Your PDF Cover Image

1. Place your PDF cover image in the `images/` folder
2. Name it: `pdf-cover.jpg`

### 6. Deploy to Vercel

#### Method 1: Using Vercel Dashboard (Easiest)

1. Go to https://vercel.com and sign up/login
2. Click "Add New Project"
3. Import your GitHub repository `bhanuvashisht99.github.io`
4. Click "Deploy"

#### Method 2: Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### 7. Set Environment Variables in Vercel

1. In your Vercel project dashboard, go to Settings → Environment Variables
2. Add the following variables:

```
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=your_secret_key_here
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_specific_password
```

3. Click "Save"
4. Redeploy your project to apply the changes

### 8. Update Razorpay Key in HTML

Edit `lower-back-pain-guide.html` and replace:
```javascript
key: 'rzp_test_XXXXXXXXXXXXXXXX',
```

With your actual Razorpay Key ID:
```javascript
key: 'rzp_live_XXXXXXXXXXXXXXXX',  // Use your real key ID
```

### 9. Test the Payment Flow

**Important**: Test with Razorpay TEST mode first!

1. Use test key (starts with `rzp_test_`)
2. Click "Buy Now" on your product page
3. Use Razorpay test card:
   - Card: 4111 1111 1111 1111
   - Expiry: Any future date
   - CVV: Any 3 digits
4. Verify you receive the email with download link

### 10. Go Live

1. In Razorpay Dashboard, switch to LIVE mode
2. Generate LIVE API keys
3. Update environment variables in Vercel with LIVE keys
4. Update the `key` in HTML with your LIVE key ID
5. Redeploy on Vercel

## 📁 File Structure

```
your-repo/
├── lower-back-pain-guide.html  # Product page
├── thank-you.html              # Success page
├── images/
│   └── pdf-cover.jpg           # Your PDF cover image
├── pdfs/
│   └── lower-back-pain-guide.pdf  # Your actual PDF (don't commit!)
├── api/
│   ├── create-order.js         # Creates Razorpay orders
│   ├── verify-payment.js       # Verifies payments & sends emails
│   └── download-pdf.js         # Serves PDF downloads
├── package.json                # Node.js dependencies
├── vercel.json                 # Vercel configuration
├── .env.example                # Example environment variables
├── .gitignore                  # Files to ignore in Git
└── SETUP-GUIDE.md              # This file
```

## 🔒 Security Checklist

- [ ] PDF file is NOT committed to GitHub
- [ ] Environment variables are set in Vercel (not in code)
- [ ] `.env` file is in `.gitignore`
- [ ] Using LIVE Razorpay keys for production
- [ ] Email app password (not your actual Gmail password)
- [ ] Tested payment flow end-to-end

## 🎨 Customization

### Change Price

Edit `lower-back-pain-guide.html`:
1. Update the displayed price (line ~467): `₹1,499`
2. Update the amount in JavaScript (line ~578): `149900` (in paise)

### Change Product Name

Edit in these files:
- `lower-back-pain-guide.html`
- `api/verify-payment.js` (email content)
- `api/download-pdf.js` (filename)

### Customize Email Template

Edit `api/verify-payment.js`, function `sendDownloadEmail()` to customize the email HTML.

## 🐛 Troubleshooting

### Payment works but no email received

1. Check Vercel logs for errors
2. Verify email credentials in environment variables
3. Check spam folder
4. Ensure Gmail "App Password" is correct

### "Failed to create order"

1. Check Razorpay API keys in Vercel environment variables
2. Ensure you're using the correct mode (Test vs Live)
3. Check Vercel function logs

### Download link not working

1. Ensure PDF file is uploaded to `/pdfs/` folder
2. Check file name matches exactly: `lower-back-pain-guide.pdf`
3. Vercel may have limits on file size (max 50MB)

## 💰 Pricing Recommendation

Based on your ₹4,000/session rate, here are suggested price points:

- **₹1,499** - Sweet spot (37.5% of session price) ✅ Currently set
- ₹1,999 - Premium positioning
- ₹999 - Aggressive pricing for volume

## 📊 Tracking Sales

To track sales, you can:
1. Check Razorpay Dashboard for payments
2. Implement Google Analytics on the product page
3. (Future) Add a database to store orders

## 🚀 Next Steps

After setup:
1. Add link to product page from your homepage
2. Create Instagram posts about the PDF
3. Add testimonials to the product page
4. Consider creating a bundle: PDF + 1 session at discount

## 📞 Support

If you need help:
- Razorpay support: https://razorpay.com/support/
- Vercel support: https://vercel.com/support
- Email me at: bhanuvashisht99@gmail.com

## 🎯 Marketing Your PDF

1. **Homepage Integration**: Add a banner or card linking to the product page
2. **Instagram Stories**: Share the cover image with swipe-up link
3. **Email Signature**: Add "New: Lower Back Pain Guide - ₹1,499"
4. **Client Follow-ups**: Recommend to clients who complete training

---

**Need help with setup?** Feel free to reach out!
