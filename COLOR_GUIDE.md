# Zen Biomechanics Color System Guide

This website uses a centralized color system that makes it easy to change colors across the entire site. All 7 HTML pages now use the same color variables.

## 🎨 Current Colors (Zen Biomechanics Palette)

### Primary Colors
- **Primary (Slate Blue-Gray)**: `#2C3E50` - Used for headers, navigation, footer backgrounds
- **Accent (Sage/Eucalyptus)**: `#768D87` - Used for CTAs, highlights, accents

### Background Colors
- **Ink/Dark**: `#121212` - For hero sections and dark backgrounds
- **Cloud/Light**: `#ECF0F1` - For content sections and light backgrounds
- **Card/White**: `#FFFFFF` - For cards and pure white elements

### Text Colors
- **Primary Text**: `#121212` - Main body text (dark)
- **Secondary Text**: `#566573` - Secondary/muted text
- **Light Text**: `#FFFFFF` - Text on dark backgrounds
- **Muted Text**: `#95A5A6` - Subtle/disabled text

## 🔧 How to Change Colors

To change the entire site's color scheme, edit these core variables in **any HTML file's `:root` section**:

```css
:root {
    /* PRIMARY BRAND COLOR - Change this to update headers, nav, footer */
    --color-primary: #2C3E50;           /* Currently: Slate Blue-Gray */
    --color-primary-dark: #1C2833;      /* Darker version */
    --color-primary-light: #34495E;     /* Lighter version */

    /* ACCENT COLOR - Change this to update buttons, CTAs, highlights */
    --color-accent: #768D87;            /* Currently: Sage/Eucalyptus */
    --color-accent-light: #A8BFB8;      /* Lighter version */
    --color-accent-dark: #5A6F6A;       /* Darker version */

    /* BACKGROUNDS - Change these for section backgrounds */
    --color-bg-dark: #121212;           /* Dark sections */
    --color-bg-light: #ECF0F1;          /* Light sections */
    --color-bg-card: #FFFFFF;           /* Cards */

    /* TEXT COLORS - Change these for text colors */
    --color-text-primary: #121212;      /* Main text */
    --color-text-secondary: #566573;    /* Secondary text */
    --color-text-light: #FFFFFF;        /* Text on dark backgrounds */
    --color-text-muted: #95A5A6;        /* Muted text */
}
```

## 📄 Files Updated

All 7 HTML files now use this system:
1. ✅ `index.html` - Homepage
2. ✅ `about.html` - About page
3. ✅ `pricing.html` - Pricing page
4. ✅ `chronic-pain.html` - Chronic pain landing page
5. ✅ `calisthenics.html` - Calisthenics landing page
6. ✅ `lower-back-pain-guide.html` - PDF guide page
7. ✅ `testimonials.html` - Testimonials page

## 🎯 What Each Color Controls

### `--color-primary` (Slate #2C3E50)
- Navigation logo gradient
- Section headings
- Footer backgrounds
- Mobile menu toggle bars
- Primary borders

### `--color-accent` (Sage #768D87)
- Call-to-action buttons
- Hover states
- Gradient accents
- Highlight elements
- Active states

### `--color-bg-light` (Cloud #ECF0F1)
- Body backgrounds
- Content sections
- Card backgrounds (alternate)

### `--color-bg-dark` (Ink #121212)
- Hero section overlays
- Dark section backgrounds
- Method/skills sections

### `--color-text-primary` (Ink #121212)
- Main body text
- Paragraphs
- Section descriptions

### `--color-text-light` (White #FFFFFF)
- Text on dark backgrounds
- Hero section text
- Footer text
- Button text on dark buttons

## 🔄 Example: Changing to a Different Color Scheme

Want to try a different look? Just update the core colors:

### Example 1: Modern Blue + Orange
```css
--color-primary: #1E40AF;      /* Deep Blue */
--color-accent: #F97316;       /* Vibrant Orange */
```

### Example 2: Purple + Gold (Previous design)
```css
--color-primary: #667eea;      /* Purple */
--color-accent: #ff6b35;       /* Orange/Gold */
```

### Example 3: Dark Navy + Teal
```css
--color-primary: #0F172A;      /* Navy */
--color-accent: #14B8A6;       /* Teal */
```

## ⚠️ Important Notes

1. **Legacy Variables**: The old color names (`--purple-primary`, `--orange-primary`, etc.) are mapped to the new system for backwards compatibility. They'll automatically use whatever you set for the core colors.

2. **Gradients**: The gradients are generated from your primary and accent colors:
   - `--gradient-primary`: Primary → Accent
   - `--gradient-cta`: Accent (light → dark)

3. **Consistency**: All pages use the same color system, so one change updates everything!

4. **Text Contrast**: The current setup ensures proper text contrast:
   - Dark text on light backgrounds
   - Light text on dark backgrounds

## 🧪 Testing Locally

Before committing, test your changes:
1. Open each HTML file in your browser
2. Check that all text is readable
3. Verify buttons are visible and have good contrast
4. Test on both desktop and mobile views

## 📝 Readability Fixes Applied

Fixed these issues for proper contrast:
- ✅ Mobile menu toggle bars now use dark color (visible against white nav)
- ✅ Footer backgrounds now use primary color with white text (good contrast)
- ✅ Body text colors properly set to dark on all pages
- ✅ Fixed about.html CSS variable typo

---

**Created**: 2026-01-09
**Color Scheme**: Zen Biomechanics (Slate + Sage + Cloud)
**Status**: Ready for local testing
