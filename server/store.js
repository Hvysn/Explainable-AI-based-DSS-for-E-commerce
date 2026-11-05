/**
 * File-backed user store with atomic writes.
 * Replace with a real database (Postgres/DynamoDB) for multi-instance deployments.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('./config');

const usersFile = config.usersFile;

function ensureParent() {
  fs.mkdirSync(path.dirname(usersFile), { recursive: true });
}

function emptyState() {
  return { users: {} };
}

function readState() {
  try {
    const raw = fs.readFileSync(usersFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.users !== 'object') {
      return emptyState();
    }
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') return emptyState();
    throw err;
  }
}

let state = readState();

function persist() {
  ensureParent();
  const tmp = `${usersFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, usersFile);
  try {
    fs.chmodSync(usersFile, 0o600);
  } catch (_) {
    /* best effort on platforms without chmod */
  }
}

function publicUser(user) {
  if (!user) return null;
  return {
    userId: user.userId,
    fullName: user.fullName,
    role: user.role,
    isCreator: Boolean(user.isCreator),
    status: user.status,
    avatar: user.avatar
  };
}

function findByUserId(userId) {
  return state.users[String(userId || '').trim().toLowerCase()] || null;
}

async function createUser({ userId, fullName, password, question, answer, role, isCreator }) {
  const uid = userId.trim().toLowerCase();
  if (state.users[uid]) {
    const err = new Error('This User ID is already taken.');
    err.status = 409;
    throw err;
  }

  const [passwordHash, answerHash] = await Promise.all([
    bcrypt.hash(password, config.bcryptRounds),
    bcrypt.hash(answer, config.bcryptRounds)
  ]);

  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'US';

  const user = {
    userId: uid,
    fullName,
    passwordHash,
    question,
    answerHash,
    role: role || 'Co-Supervisor',
    isCreator: Boolean(isCreator),
    status: 'ACTIVE',
    avatar: initials,
    tokenVersion: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.users[uid] = user;
  persist();
  return user;
}

async function verifyPassword(user, password) {
  if (!user || !user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

async function verifyAnswer(user, answer) {
  if (!user || !user.answerHash) return false;
  return bcrypt.compare(String(answer || '').trim().toLowerCase(), user.answerHash);
}

async function updateUser(userId, updates) {
  const user = findByUserId(userId);
  if (!user) return null;

  if (updates.newPassword) {
    user.passwordHash = await bcrypt.hash(updates.newPassword, config.bcryptRounds);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
  }
  if (updates.question) user.question = updates.question;
  if (updates.answer) {
    user.answerHash = await bcrypt.hash(updates.answer, config.bcryptRounds);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
  }
  user.updatedAt = new Date().toISOString();
  persist();
  return user;
}

function listUsers() {
  return Object.values(state.users).map(publicUser);
}

function countUsers() {
  return Object.keys(state.users).length;
}

async function seedAdminIfNeeded() {
  const seed = config.seedAdmin;
  if (countUsers() > 0) return;
  if (!seed.userId || !seed.password || !seed.question || !seed.answer) {
    console.warn(
      '[security] No users exist and SEED_ADMIN_* variables are incomplete. ' +
        'Set SEED_ADMIN_USER_ID/PASSWORD/QUESTION/ANSWER to bootstrap the first Creator account.'
    );
    return;
  }

  const passwordOk =
    seed.password.length >= 8 && /[A-Za-z]/.test(seed.password) && /[0-9]/.test(seed.password);
  if (!passwordOk) {
    console.warn(
      '[security] SEED_ADMIN_PASSWORD must be 8+ chars and contain a letter and a number. ' +
        'Skipping admin seed.'
    );
    return;
  }

  await createUser({
    userId: seed.userId,
    fullName: seed.fullName,
    password: seed.password,
    question: seed.question,
    answer: seed.answer,
    role: 'Creator / Super Admin',
    isCreator: true
  });
  console.log(`[security] Seeded Creator account "${seed.userId}". Change the password after first login.`);
}

module.exports = {
  findByUserId,
  createUser,
  verifyPassword,
  verifyAnswer,
  updateUser,
  listUsers,
  publicUser,
  countUsers,
  seedAdminIfNeeded
};
