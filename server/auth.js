/**
 * JWT issuing / verification and route guards.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('./config');
const store = require('./store');

const ISSUER = config.jwt.issuer;
const AUDIENCE = config.jwt.audience;

function signChallengeToken(user) {
  return jwt.sign(
    { sub: user.userId, type: '2fa', ver: user.tokenVersion || 0 },
    config.jwt.secret,
    {
      algorithm: 'HS256',
      expiresIn: config.jwt.challengeTtl,
      issuer: ISSUER,
      audience: AUDIENCE
    }
  );
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.userId,
      type: 'access',
      role: user.role,
      name: user.fullName,
      ver: user.tokenVersion || 0
    },
    config.jwt.secret,
    {
      algorithm: 'HS256',
      expiresIn: config.jwt.accessTtl,
      issuer: ISSUER,
      audience: AUDIENCE
    }
  );
}

function verifyToken(token, expectedType) {
  const payload = jwt.verify(token, config.jwt.secret, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE
  });
  if (expectedType && payload.type !== expectedType) {
    throw new Error('Unexpected token type.');
  }
  return payload;
}

function setAuthCookie(res, token) {
  res.cookie(config.cookie.name, token, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: config.cookie.maxAgeMs,
    path: '/'
  });
}

function clearAuthCookie(res) {
  res.clearCookie(config.cookie.name, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: '/'
  });
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies[config.cookie.name]) return req.cookies[config.cookie.name];
  return null;
}

function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  let payload;
  try {
    payload = verifyToken(token, 'access');
  } catch (_) {
    return res.status(401).json({ error: 'Session is invalid or has expired.' });
  }

  const user = store.findByUserId(payload.sub);
  if (!user || user.status !== 'ACTIVE') {
    return res.status(401).json({ error: 'Account is not active.' });
  }
  if ((user.tokenVersion || 0) !== (payload.ver || 0)) {
    return res.status(401).json({ error: 'Session has been revoked. Please sign in again.' });
  }

  req.auth = { token, payload };
  req.user = user;
  return next();
}

function requireCreator(req, res, next) {
  if (!req.user || !req.user.isCreator) {
    return res.status(403).json({ error: 'Creator privileges required.' });
  }
  return next();
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

module.exports = {
  signChallengeToken,
  signAccessToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
  extractToken,
  authenticate,
  requireCreator,
  safeEqual
};
