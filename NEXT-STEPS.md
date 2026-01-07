# Next Steps - Do This Now

## 🎯 Immediate Actions (Before Deploying)

### 1. Add PDF Cover Image (NOW)

You showed me the PDF cover earlier. Save that image as:
```
images/pdf-cover.jpg
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Commit Everything to GitHub

```bash
git add .
git commit -m "Add PDF sales system with Razorpay integration

- Product page for Lower Back Pain guide
- Razorpay payment integration
- Email delivery system
- Serverless backend with Vercel
- Thank you page"
git push origin main
```

---

## 🔑 Get Your API Keys

### Razorpay (5 minutes)

1. Go to https://razorpay.com/signup
2. Sign up and verify your email
3. Go to Settings → API Keys → Generate Test Key
4. Save these somewhere safe:
   - Key ID: `rzp_test_XXXXXXXXXXXX`
   - Key Secret: `XXXXXXXXXXXXXXXXXXXXXXXX`

### Gmail App Password (5 minutes)

1. Go to your Google Account → Security
2. Enable 2-Step Verification (if not already enabled)
3. Go to 2-Step Verification → App passwords
4. Generate password for "Mail"
5. Save this password

---

## 🚀 Deploy to Vercel (Easy Way - No Tokens Needed)

### Option 1: Vercel Dashboard (RECOMMENDED)

1. Go to https://vercel.com
2. Click "Sign Up" → Choose "Continue with GitHub"
3. Authorize Vercel to access your GitHub
4. Click "Add New Project"
5. Select `bhanuvashisht99.github.io`
6. Click "Deploy" (don't change any settings yet)
7. Wait for deployment to finish
8. **IMPORTANT**: Don't test yet - you need to add environment variables first

### Option 2: Vercel CLI (Alternative)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login (will open browser)
vercel login

# Deploy
vercel --prod
```

---

## ⚙️ Configure Environment Variables in Vercel

After deploying:

1. Go to your project in Vercel dashboard
2. Click "Settings" tab
3. Click "Environment Variables" in left sidebar
4. Add these one by one:

| Name | Value | Example |
|------|-------|---------|
| `RAZORPAY_KEY_ID` | Your test key | `rzp_test_XXXXXXXXX` |
| `RAZORPAY_KEY_SECRET` | Your secret | `XXXXXXXXXXXXXXXX` |
| `EMAIL_HOST` | `smtp.gmail.com` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` | `587` |
| `EMAIL_USER` | Your email | `bhanuvashisht99@gmail.com` |
| `EMAIL_PASSWORD` | App password | Your Gmail app password |

5. Click "Save" after each variable
6. Go to "Deployments" tab → Click "..." → "Redeploy"

---

## 📝 Update Razorpay Key in HTML

Edit `lower-back-pain-guide.html` (line 593):

Find:
```javascript
key: 'rzp_test_XXXXXXXXXXXXXXXX',
```

Replace with your actual Razorpay TEST key:
```javascript
key: 'rzp_test_AbCdEfGhIjKlMn',  // Your real test key here
```

Commit and push:
```bash
git add lower-back-pain-guide.html
git commit -m "Update Razorpay key"
git push origin main
```

Vercel will auto-deploy the update.

---

## 🧪 Test the Payment Flow

1. Visit your Vercel URL (will be like `https://youdeservewell-xyz.vercel.app`)
2. Go to `/lower-back-pain-guide.html`
3. Click "Buy Now"
4. Enter your email
5. Use test card: `4111 1111 1111 1111`
6. Any future expiry date, any CVV
7. Complete payment
8. Check your email for download link

---

## ✅ Go Live Checklist

When ready to accept real payments:

- [ ] Razorpay account fully verified (KYC complete)
- [ ] Switch to LIVE mode in Razorpay
- [ ] Generate LIVE API keys
- [ ] Update environment variables in Vercel with LIVE keys
- [ ] Update HTML with LIVE key (starts with `rzp_live_`)
- [ ] Test with real card (small amount)
- [ ] Announce on Instagram!

---

## 📊 After Going Live

Track your sales:
- Check Razorpay Dashboard for payments
- Gmail will have copies of all emails sent
- Consider adding Google Analytics to track page views

---

## 🆘 Common Issues

**"Failed to create order"**
- Check environment variables in Vercel
- Make sure you redeployed after adding them

**"No email received"**
- Check Gmail app password is correct
- Check spam folder
- Check Vercel function logs for errors

**"Payment works but no PDF"**
- You need to upload the actual PDF file
- Or use a cloud storage link (recommended)

---

Need help? The full guide is in `SETUP-GUIDE.md`
