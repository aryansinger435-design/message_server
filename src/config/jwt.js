import 'dotenv/config';

export const JWT_SECRET =
  (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) ||
  'aurawave_secret_key_2026_super_secure_jwt';

export const JWT_FALLBACK_SECRETS = [
  JWT_SECRET,
  'aurawave_secret_key_2026_super_secure_jwt',
  'aurawave_secret_key_2026_secure',
  'your-secret-key',
];

/**
 * Robustly verify a JWT token against current secret, with fallback to legacy secrets
 * so users with tokens generated across restarts don't get logged out abruptly.
 */
export const verifyJwtToken = (token, jwtInstance) => {
  for (const secret of JWT_FALLBACK_SECRETS) {
    try {
      return jwtInstance.verify(token, secret);
    } catch (err) {
      // If it's expired, throw immediately
      if (err.name === 'TokenExpiredError') {
        throw err;
      }
      // If invalid signature, try next secret in fallback array
    }
  }
  const err = new Error('Invalid token');
  err.name = 'JsonWebTokenError';
  throw err;
};
