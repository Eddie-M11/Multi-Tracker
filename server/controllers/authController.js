const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/User');

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    gender: user.gender,
    pronouns: user.pronouns,
    birthday: user.birthday,
    xp: user.xp,
    level: user.level,
    coins: user.coins,
    avatar: user.avatar,
  };
}

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

async function register(req, res) {
  return res.status(403).json({ message: 'Registration is managed by the admin account' });
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = createToken(user._id);
    setAuthCookie(res, token);

    return res.status(200).json({ user: serializeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function me(req, res) {
  try {
    return res.status(200).json({ user: serializeUser(req.user) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function logout(req, res) {
  clearAuthCookie(res);
  return res.status(200).json({ message: 'Logged out successfully' });
}

module.exports = { login, logout, me, register };
