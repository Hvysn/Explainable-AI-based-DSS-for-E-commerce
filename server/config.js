/**
 * Centralised, environment-driven configuration.
 * Secrets are NEVER hardcoded here; they must come from the environment
 * (root .env file or container secrets).
 */

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

function parseOrigins(raw) {
  return (raw || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET is missing or too short. Set a random value of at least 32 characters in .env ' +
      '(generate one with: openssl rand -hex 32).'
  );
}

const allowedOrigins = parseOrigins(
  process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173'
);

const config = {
  nodeEnv: NODE_ENV,
  isProd: IS_PROD,
  port: Number(process.env.PORT || 5000),

  jwt: {
    secret: JWT_SECRET,
    issuer: process.env.JWT_ISSUER || 'jhj-auth',
    audience: process.env.JWT_AUDIENCE || 'jhj-dss',
    accessTtl: process.env.ACCESS_TOKEN_TTL || '8h',
    challengeTtl: process.env.CHALLENGE_TOKEN_TTL || '5m'
  },

  cookie: {
    name: process.env.AUTH_COOKIE_NAME || 'jhj_token',
    secure: IS_PROD,
    sameSite: 'lax',
    maxAgeMs: 8 * 60 * 60 * 1000
  },

  corsOrigins: IS_PROD ? allowedOrigins : [...allowedOrigins, 'null'],

  inviteCode: process.env.TEAM_INVITE_CODE || '',
  creatorPin: process.env.CREATOR_MASTER_PIN || '',

  seedAdmin: {
    userId: process.env.SEED_ADMIN_USER_ID || '',
    password: process.env.SEED_ADMIN_PASSWORD || '',
    fullName: process.env.SEED_ADMIN_NAME || 'System Administrator',
    question: process.env.SEED_ADMIN_QUESTION || '',
    answer: process.env.SEED_ADMIN_ANSWER || ''
  },

  usersFile:
    process.env.USERS_FILE ||
    path.join(__dirname, 'data', 'users.json'),

  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),

  rateLimit: {
    authWindowMs: Number(process.env.AUTH_RATE_WINDOW_MS || 15 * 60 * 1000),
    authMax: Number(process.env.AUTH_RATE_MAX || 20),
    globalWindowMs: Number(process.env.GLOBAL_RATE_WINDOW_MS || 15 * 60 * 1000),
    globalMax: Number(process.env.GLOBAL_RATE_MAX || 300)
  },

  fastapiUrl: process.env.FASTAPI_URL || 'http://localhost:8000'
};

if (!config.inviteCode) {
  console.warn('[security] TEAM_INVITE_CODE is not set; teammate registration is disabled.');
}
if (!config.creatorPin) {
  console.warn('[security] CREATOR_MASTER_PIN is not set; invite-code unlock is disabled.');
}

module.exports = config;
module.exports.randomId = () => crypto.randomUUID();
