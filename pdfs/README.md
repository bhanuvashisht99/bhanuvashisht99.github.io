# PDF Files

Place your PDF file here:

- **Filename**: `lower-back-pain-guide.pdf`
- **Important**: Do NOT commit PDF files to Git (they're in .gitignore)
- **Upload**: When deploying to Vercel, you'll need to upload the PDF separately or use Vercel's file upload

## How to Upload PDF to Vercel

After deploying your site:

1. The PDF should be uploaded via Vercel CLI or through a cloud storage solution (recommended)
2. Alternative: Use a cloud storage service like:
   - Google Drive (with direct download link)
   - Dropbox
   - AWS S3
   - Cloudinary

## Recommended Approach (Cloud Storage)

Instead of hosting the PDF on Vercel, use cloud storage:

1. Upload your PDF to Google Drive
2. Get a direct download link
3. Update `api/download-pdf.js` to redirect to that link
4. This avoids Vercel's 50MB file size limit

This folder is currently empty and will remain empty in Git.
