export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.query;

    // Basic token validation
    if (!token) {
      return res.status(400).json({ error: 'Download token is required' });
    }

    // Check token format (should be 64 hex characters)
    if (token.length < 32 || !/^[a-f0-9]+$/i.test(token)) {
      return res.status(400).json({ error: 'Invalid download token' });
    }

    // Log the download (you can check Vercel logs to see who downloaded)
    console.log(`PDF Download Request - Token: ${token.substring(0, 8)}... at ${new Date().toISOString()}`);

    // Google Drive direct download link
    const googleDriveFileId = '1MpqzbYwT2ymiAAo6ifInehRN1mhG4KwQ';
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${googleDriveFileId}`;

    // Redirect to Google Drive for download
    res.redirect(302, downloadUrl);

  } catch (error) {
    console.error('Error serving PDF:', error);
    return res.status(500).json({
      error: 'Failed to download PDF',
      message: error.message
    });
  }
}
