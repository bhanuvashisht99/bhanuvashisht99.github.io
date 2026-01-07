# Quick Start Checklist

Follow these steps to get your PDF sales system live:

## ☐ Step 1: Add Your Files (5 minutes)

1. **Add PDF cover image**:
   - Place your PDF cover in `images/pdf-cover.jpg`
   - The images you showed me earlier will work perfectly

2. **Prepare your PDF**:
   - You'll upload this to cloud storage later (recommended)
   - Or place in `pdfs/lower-back-pain-guide.pdf` for testing

## ☐ Step 2: Sign Up for Services (15 minutes)

1. **Razorpay Account** (https://razorpay.com/signup):
   - Sign up with your business details
   - Verify your account (may take 1-2 days for full approval)
   - Navigate to Settings → API Keys
   - Generate Test Keys first (for testing)

2. **Vercel Account** (https://vercel.com/signup):
   - Sign up with your GitHub account
   - It will automatically connect to your repositories

3. **Gmail App Password**:
   - Enable 2-factor authentication on Gmail
   - Generate an App Password for mail
   - Save this password securely

## ☐ Step 3: Deploy to Vercel (10 minutes)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Deploy using Vercel Dashboard**:
   - Go to https://vercel.com
   - Click "Add New Project"
   - Select your GitHub repository
   - Click "Deploy"

3. **Set Environment Variables** in Vercel:
   - Go to Settings → Environment Variables
   - Add all variables from `.env.example`:
     ```
     RAZORPAY_KEY_ID=rzp_test_XXXXXXXX
     RAZORPAY_KEY_SECRET=your_secret_here
     EMAIL_HOST=smtp.gmail.com
     EMAIL_PORT=587
     EMAIL_USER=your_email@gmail.com
     EMAIL_PASSWORD=your_app_password
     ```

4. **Redeploy** to apply environment variables

## ☐ Step 4: Update Razorpay Key in Code (2 minutes)

Edit `lower-back-pain-guide.html` line 593:

```javascript
key: 'rzp_test_XXXXXXXXXXXXXXXX',  // Replace with your actual Razorpay test key
```

## ☐ Step 5: Test Payment (10 minutes)

1. Visit your product page (Vercel will give you a URL)
2. Click "Buy Now"
3. Enter a test email
4. Use Razorpay test card: `4111 1111 1111 1111`
5. Verify you receive the email

## ☐ Step 6: Go Live (5 minutes)

1. Switch Razorpay to LIVE mode
2. Generate LIVE API keys
3. Update environment variables in Vercel
4. Update the key in `lower-back-pain-guide.html`
5. Redeploy

## ☐ Step 7: Commit to GitHub

```bash
git add .
git commit -m "Add PDF product sales system with Razorpay integration"
git push origin main
```

---

## 💰 Pricing Recommendation

Based on your ₹4,000/session rate:
- **₹1,499** (currently set) - Good value proposition ✅
- ₹1,999 - Premium positioning
- ₹999 - Volume play

## 🚀 Marketing Ideas

1. Add to Instagram bio link
2. Mention in stories with PDF cover image
3. Recommend to clients after sessions
4. Create a bundle: PDF + 1 consultation

## ❓ Need Help?

Read the full `SETUP-GUIDE.md` for detailed instructions and troubleshooting.

---

**Total setup time: ~45 minutes**
