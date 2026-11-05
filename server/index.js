/**
 * Node.js Express Authentication Gateway
 * JHJ eCommerce Reverse Logistics DSS
 *
 * Security posture:
 *  - Passwords and 2FA answers are hashed with bcrypt (never stored in plaintext).
 *  - Stateless JWT access tokens (short-lived) issued in an httpOnly cookie and
 *    also returned for non-cookie clients.
 *  - Challenge tokens are single-purpose and expire in minutes.
 *  - Secrets come from the environment, never source code.
 *  - Helmet, strict CORS allow-list, rate limiting and schema validation.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const store = require('./store');
const auth = require('./auth');
const {
  validate,
  step1Schema,
  step2Schema,
  registerSchema,
  updateSecuritySchema,
  creatorPinSchema
} = require('./validation');

const app = express();

app.disable('x-powered-by');
if (config.isProd) {
  app.set('trust proxy', 1);
}

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.globalWindowMs,
  max: config.rateLimit.globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  // Health checks and FastAPI's session-introspection calls should not consume
  // the per-IP request budget shared by all authenticated users.
  skip: (req) =>
    (req.method === 'GET' && req.path === '/api/health') ||
    (req.method === 'GET' && req.path === '/api/auth/me'),
  message: { error: 'Too many requests. Please slow down.' }
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again later.' }
});

app.use('/api', globalLimiter);

// A dummy hash keeps "unknown user" and "wrong password" work factors similar.
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO1sLq2fJ7zWJpG0kNn8Y8XbGq2qQ7kK6';

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'JHJ DSS Node.js Gateway',
    timestamp: new Date().toISOString()
  });
});

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

// Step 1: verify User ID + password, return a short-lived 2FA challenge.
app.post('/api/auth/step1', authLimiter, validate(step1Schema), async (req, res, next) => {
  try {
    const { userId, password } = req.validated;
    const user = store.findByUserId(userId);

    const passwordOk = user
      ? await store.verifyPassword(user, password)
      : await store.verifyPassword({ passwordHash: DUMMY_HASH }, password);

    if (!user || !passwordOk || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Invalid User ID or password.' });
    }

    const challengeToken = auth.signChallengeToken(user);
    return res.json({
      status: 'ACTIVE_CHALLENGE_REQUIRED',
      challengeToken,
      userId: user.userId,
      fullName: user.fullName,
      question: user.question
    });
  } catch (err) {
    return next(err);
  }
});

// Step 2: verify the 2FA answer against the signed challenge, issue a session.
app.post('/api/auth/step2', authLimiter, validate(step2Schema), async (req, res, next) => {
  try {
    const { challengeToken, answer } = req.validated;

    let payload;
    try {
      payload = auth.verifyToken(challengeToken, '2fa');
    } catch (_) {
      return res.status(401).json({ error: 'Challenge expired or invalid. Please sign in again.' });
    }

    const user = store.findByUserId(payload.sub);
    if (!user || user.status !== 'ACTIVE' || (user.tokenVersion || 0) !== (payload.ver || 0)) {
      return res.status(401).json({ error: 'Invalid user session.' });
    }

    const answerOk = await store.verifyAnswer(user, answer);
    if (!answerOk) {
      return res.status(401).json({ error: 'Security answer does not match our records.' });
    }

    const token = auth.signAccessToken(user);
    auth.setAuthCookie(res, token);

    return res.json({
      message: '2FA identity verified.',
      token,
      user: store.publicUser(user)
    });
  } catch (err) {
    return next(err);
  }
});

// Teammate self-registration using a creator-issued invite code.
app.post('/api/auth/register-teammate', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    if (!config.inviteCode || !auth.safeEqual(req.validated.inviteCode, config.inviteCode)) {
      return res.status(403).json({ error: 'Invalid Team Invite Code.' });
    }

    const user = await store.createUser({
      userId: req.validated.userId,
      fullName: req.validated.fullName,
      password: req.validated.password,
      question: req.validated.question,
      answer: req.validated.answer,
      role: 'Co-Supervisor',
      isCreator: false
    });

    const token = auth.signAccessToken(user);
    auth.setAuthCookie(res, token);

    return res.status(201).json({
      message: `Account activated for ${user.fullName}.`,
      token,
      user: store.publicUser(user)
    });
  } catch (err) {
    return next(err);
  }
});

app.post('/api/auth/logout', (req, res) => {
  auth.clearAuthCookie(res);
  res.json({ message: 'Signed out.' });
});

app.get('/api/auth/me', auth.authenticate, (req, res) => {
  res.json({ user: store.publicUser(req.user) });
});

/* -------------------------------------------------------------------------- */
/* Team management                                                            */
/* -------------------------------------------------------------------------- */

app.get('/api/team', auth.authenticate, (req, res) => {
  res.json({ team: store.listUsers() });
});

// Creator verifies the master PIN to reveal the team invite code.
app.post(
  '/api/team/verify-creator',
  authLimiter,
  auth.authenticate,
  auth.requireCreator,
  validate(creatorPinSchema),
  (req, res) => {
    if (!config.creatorPin) {
      return res.status(503).json({ error: 'Creator PIN is not configured on this server.' });
    }
    if (!auth.safeEqual(req.validated.creatorPin, config.creatorPin)) {
      return res.status(403).json({ error: 'Incorrect Creator Master PIN.' });
    }
    if (!config.inviteCode) {
      return res.status(503).json({ error: 'Team invite code is not configured on this server.' });
    }
    return res.json({ inviteCode: config.inviteCode });
  }
);

/* -------------------------------------------------------------------------- */
/* Account security                                                           */
/* -------------------------------------------------------------------------- */

// Users may only update their own credentials. A current password is required.
app.put(
  '/api/user/security',
  auth.authenticate,
  validate(updateSecuritySchema),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword, question, answer } = req.validated;

      const passwordOk = await store.verifyPassword(req.user, currentPassword);
      if (!passwordOk) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }

      const updated = await store.updateUser(req.user.userId, {
        newPassword,
        question,
        answer
      });

      // Re-issue a token because the token version may have changed.
      const token = auth.signAccessToken(updated);
      auth.setAuthCookie(res, token);

      return res.json({
        message: 'Security credentials updated successfully.',
        token,
        user: store.publicUser(updated)
      });
    } catch (err) {
      return next(err);
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((err, req, res, _next) => {
  if (err && err.status === 409) {
    return res.status(409).json({ error: err.message });
  }
  if (err && err.message === 'Origin not allowed by CORS.') {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body.' });
  }
  console.error('[server] Unhandled error:', err && err.message);
  return res.status(500).json({ error: 'Internal server error.' });
});

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                  */
/* -------------------------------------------------------------------------- */

async function start() {
  await store.seedAdminIfNeeded();
  app.listen(config.port, () => {
    console.log(`JHJ DSS auth gateway listening on http://localhost:${config.port}`);
    console.log(`CORS origins: ${config.corsOrigins.join(', ')}`);
  });
}

start().catch((err) => {
  console.error('[server] Failed to start:', err.message);
  process.exit(1);
});

module.exports = app;
