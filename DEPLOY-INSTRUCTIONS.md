# Step-by-Step Deployment Instructions

Follow these steps in order. Don't skip any steps.

---

## 🖼️ STEP 1: Add Your PDF Cover Image (REQUIRED)

1. Save your PDF cover image as `pdf-cover.jpg`
2. Place it in the `images/` folder
3. Commit and push:
   ```bash
   git add images/pdf-cover.jpg
   git commit -m "Add PDF cover image"
   git push origin main
   ```

**Don't proceed until you've done this!**

---

## 🔑 STEP 2: Get NEW Razorpay API Keys

Since you shared your keys in chat, you must generate NEW ones:

1. Go to https://dashboard.razorpay.com/app/keys
2. Click "Regenerate" on your Live API Key
3. Copy and save BOTH:
   - **Key ID** (starts with `rzp_live_`)
   - **Key Secret** (long string)
4. **Keep these private!** Don't share in chat again

---

## 📧 STEP 3: Get Gmail App Password

1. Go to https://myaccount.google.com/security
2. Enable "2-Step Verification" if not already enabled
3. Go to "App passwords"
4. Generate password for "Mail"
5. Copy the 16-character password (no spaces)

---

## 🚀 STEP 4: Deploy to Vercel (Easy Method)

### Option A: Vercel Dashboard (RECOMMENDED - No token needed)

1. Open https://vercel.com in your browser
2. Click "Sign Up" (or "Log In" if you have account)
3. Choose "Continue with GitHub"
4. Authorize Vercel to access your repositories
5. Click "Add New Project"
6. Find and select `bhanuvashisht99.github.io`
7. Click "Deploy" (don't change any settings)
8. Wait 2-3 minutes for deployment
9. **Copy the deployment URL** (will be like `https://bhanuvashisht99-github-io.vercel.app`)

### Option B: Vercel CLI (Alternative)

```bash
# Install Vercel CLI
npm install -g vercel

# Login (opens browser)
vercel login

# Deploy
vercel --prod
```

---

## ⚙️ STEP 5: Add Environment Variables in Vercel

**CRITICAL: Use your NEW keys from Step 2!**

1. In Vercel dashboard, go to your project
2. Click "Settings" tab (top navigation)
3. Click "Environment Variables" (left sidebar)
4. Add each variable by clicking "Add New":

### Add These Variables:

| Variable Name | Value | Where to Get It |
|--------------|-------|-----------------|
| `RAZORPAY_KEY_ID` | `rzp_live_XXXXXXXXXX` | New key from Step 2 |
| `RAZORPAY_KEY_SECRET` | Your new secret | New secret from Step 2 |
| `EMAIL_HOST` | `smtp.gmail.com` | Type exactly this |
| `EMAIL_PORT` | `587` | Type exactly this |
| `EMAIL_USER` | `bhanuvashisht99@gmail.com` | Your Gmail address |
| `EMAIL_PASSWORD` | Your app password | From Step 3 |

5. For each variable:
   - Click "Add New"
   - Enter the name
   - Enter the value
   - Click "Add"
6. After adding all 6 variables, you MUST redeploy

---

## 🔄 STEP 6: Redeploy to Apply Variables

1. In Vercel dashboard, go to "Deployments" tab
2. Click the "..." menu on the latest deployment
3. Click "Redeploy"
4. Wait for redeployment to complete

---

## 📝 STEP 7: Update Razorpay Key in HTML

You need to add your NEW Razorpay Key ID to the product page:

1. Edit `lower-back-pain-guide.html`
2. Find line 593 (search for `key: 'rzp_test_`)
3. Replace with your NEW live key:

```javascript
// BEFORE:
key: 'rzp_test_XXXXXXXXXXXXXXXX',

// AFTER (use your actual new key):
key: 'rzp_live_S0s7ouWWnDinu9',  // Your NEW key here
```

4. Save the file
5. Commit and push:
```bash
git add lower-back-pain-guide.html
git commit -m "Add Razorpay live key"
git push origin main
```

Vercel will automatically redeploy (takes 1-2 minutes).

---

## 🧪 STEP 8: Test Your Payment System

1. Visit your Vercel URL: `https://your-project.vercel.app`
2. Go to `/lower-back-pain-guide.html`
3. Click "Buy Now"
4. Enter your email address
5. Enter your phone (optional)
6. **For testing**, use a real card with small amount (₹1)
7. Complete payment
8. Check your email for download link
9. Click download link to verify

**Testing Cards (Razorpay Test Mode):**
If you want to test without real money first:
- Card: `4111 1111 1111 1111`
- Expiry: Any future date
- CVV: Any 3 digits

But you'll need to switch back to live keys for real payments.

---

## ✅ STEP 9: Verify Everything Works

Check these:
- [ ] Payment page loads correctly
- [ ] Razorpay checkout opens when clicking "Buy Now"
- [ ] Payment processes successfully
- [ ] Email arrives with download link
- [ ] Thank you page displays after payment

---

## 🎉 STEP 10: Go Live!

Once testing is successful:

1. Share the product page URL on Instagram
2. Add link to Instagram bio
3. Mention it to your current clients
4. Track sales in Razorpay Dashboard

---

## 🆘 Troubleshooting

**"Failed to create order"**
- Check environment variables are correct in Vercel
- Make sure you redeployed after adding variables
- Check Vercel function logs for errors

**"No email received"**
- Verify Gmail app password is correct
- Check spam folder
- Test Gmail SMTP credentials

**"Payment successful but no email"**
- Check Vercel function logs
- Verify all environment variables are set
- Make sure EMAIL_USER and EMAIL_PASSWORD are correct

**"Razorpay checkout doesn't open"**
- Check browser console for errors
- Verify Razorpay key in HTML matches environment variable
- Clear browser cache

---

## 📊 View Logs in Vercel

If something doesn't work:

1. Go to Vercel dashboard
2. Click "Functions" tab
3. Click on any function (create-order, verify-payment)
4. See error logs

---

## 🔐 Security Checklist

Before going live, verify:
- [ ] Using NEW Razorpay keys (old ones were compromised)
- [ ] All environment variables are set in Vercel
- [ ] `.env` file is NOT committed to GitHub
- [ ] PDF file is NOT committed to GitHub
- [ ] Only using LIVE keys (`rzp_live_`) for production
- [ ] Gmail app password (not real password)

---

## 📞 Need Help?

If you get stuck at any step:
1. Check the step-by-step instructions again
2. Look at the error message carefully
3. Check Vercel logs (Functions tab)
4. Read the full SETUP-GUIDE.md

---

**Time to complete: 30-45 minutes**

Start with Step 1 and don't skip any steps!
