import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Download token is required' });
    }

    // In a real implementation, you would:
    // 1. Validate the token against your database
    // 2. Check if it's expired
    // 3. Log the download

    // For now, we'll just serve the PDF file
    const pdfPath = path.join(process.cwd(), 'pdfs', 'lower-back-pain-guide.pdf');

    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({
        error: 'PDF not found',
        message: 'Please contact support if you believe this is an error.'
      });
    }

    // Get file stats
    const stat = fs.statSync(pdfPath);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', 'attachment; filename="Take-Control-of-Your-Lower-Back-Pain.pdf"');

    // Stream the file
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error serving PDF:', error);
    return res.status(500).json({
      error: 'Failed to download PDF',
      message: error.message
    });
  }
}
