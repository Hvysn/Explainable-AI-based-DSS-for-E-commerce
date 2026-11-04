/**
 * Node.js Express Backend & Authentication Gateway
 * JHJ eCommerce Reverse Logistics DSS
 * Authors: Hemavarshini Y, Jeyashree Narayanan A, Jayanth S
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const CREATOR_MASTER_PIN = "2026";
const TEAM_INVITE_CODE = "JHJ-2026";

// Initial User Database with Hemavarshini as the Super Admin / Creator
let users = {
  "hv@jhj": {
    userId: "hv@jhj",
    fullName: "Hemavarshini Y",
    password: "052027",
    role: "Creator / Super Admin",
    isCreator: true,
    status: "ACTIVE",
    question: "who is your spirit animal",
    answer: "kungfupanda",
    avatar: "HV"
  }
};

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'JHJ DSS Node.js Gateway',
    timestamp: new Date().toISOString()
  });
});

// 1. Auth Step 1: User ID & Password Check
app.post('/api/auth/step1', (req, res) => {
  const { userId, password } = req.body;
  const uid = (userId || '').trim().toLowerCase();
  const user = users[uid];

  if (!user) {
    return res.status(404).json({ error: "User ID not found. Click 'Register Your Account' if you have an invite code." });
  }

  if (user.password !== password) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  // Password valid -> Send 2FA Challenge Question
  res.json({
    status: 'ACTIVE_CHALLENGE_REQUIRED',
    fullName: user.fullName,
    userId: user.userId,
    question: user.question
  });
});

// 2. Auth Step 2: 2FA Answer Verification (Masked in dots)
app.post('/api/auth/step2', (req, res) => {
  const { userId, answer } = req.body;
  const uid = (userId || '').trim().toLowerCase();
  const user = users[uid];

  if (!user || user.status !== 'ACTIVE') {
    return res.status(400).json({ error: 'Invalid user session.' });
  }

  const cleanAns = (answer || '').trim().toLowerCase();
  if (cleanAns !== user.answer.toLowerCase()) {
    return res.status(401).json({ error: 'Security answer does not match our records.' });
  }

  res.json({
    message: '2FA Identity verified!',
    user: {
      userId: user.userId,
      fullName: user.fullName,
      role: user.role,
      avatar: user.avatar
    }
  });
});

// 3. Teammate Self-Registration (Decides own User ID, Password, Question & Answer)
app.post('/api/auth/register-teammate', (req, res) => {
  const { inviteCode, fullName, userId, password, question, answer } = req.body;

  if (inviteCode !== TEAM_INVITE_CODE) {
    return res.status(403).json({ error: 'Invalid Team Invite Code. Please request the code from Hemavarshini.' });
  }

  const uid = (userId || '').trim().toLowerCase();
  if (users[uid]) {
    return res.status(400).json({ error: 'This User ID is already taken. Please choose another one.' });
  }

  const initials = fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  users[uid] = {
    userId: uid,
    fullName: fullName,
    password: password,
    role: 'Co-Supervisor',
    isCreator: false,
    status: 'ACTIVE',
    question: question,
    answer: answer.trim().toLowerCase(),
    avatar: initials
  };

  res.json({
    message: `Account activated for ${fullName}!`,
    user: {
      userId: uid,
      fullName: fullName,
      role: 'Co-Supervisor',
      avatar: initials
    }
  });
});

// 4. Team List
app.get('/api/team', (req, res) => {
  const sanitized = Object.values(users).map(u => ({
    userId: u.userId,
    fullName: u.fullName,
    role: u.role,
    isCreator: u.isCreator,
    status: u.status
  }));
  res.json({ team: sanitized });
});

// 5. Creator Verifies PIN to retrieve Invite Code
app.post('/api/team/verify-creator', (req, res) => {
  const { creatorPin } = req.body;
  if (creatorPin !== CREATOR_MASTER_PIN) {
    return res.status(403).json({ error: 'Incorrect Creator Master PIN!' });
  }
  res.json({ inviteCode: TEAM_INVITE_CODE });
});

// 6. User Updates Own Security Settings
app.put('/api/user/security', (req, res) => {
  const { userId, newPassword, question, answer } = req.body;
  const uid = (userId || '').trim().toLowerCase();
  const user = users[uid];

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (newPassword) user.password = newPassword;
  if (question) user.question = question;
  if (answer) user.answer = answer.trim().toLowerCase();

  res.json({ message: 'Security credentials updated successfully!' });
});

app.listen(PORT, () => {
  console.log(`JHJ DSS Node.js Gateway running at http://localhost:${PORT}`);
});
