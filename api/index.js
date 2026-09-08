import app from '../src/server.js';

export default function handler(req, res) {
  try {
    // Pass a final callback so Express never leaves the request hanging
    app(req, res, (err) => {
      if (err) {
        console.error('Express uncaught error:', err);
        return res.status(500).json({
          success: false,
          error: err.message || 'Internal Server Error',
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        });
      }
      return res.status(404).json({
        success: false,
        message: `Cannot ${req.method} ${req.url}`,
      });
    });
  } catch (syncErr) {
    console.error('Handler sync error:', syncErr);
    return res.status(500).json({
      success: false,
      error: syncErr.message,
    });
  }
}
