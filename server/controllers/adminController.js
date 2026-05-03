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
    notes: user.notes,
    xp: user.xp,
    level: user.level,
    coins: user.coins,
    avatar: user.avatar,
    createdAt: user.createdAt,
  };
}

async function listUsers(req, res) {
  try {
    const users = await User.find({ role: 'user' }).sort({ createdAt: 1 }).select('-password');

    return res.status(200).json({ users: users.map(serializeUser) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

async function createUser(req, res) {
  try {
    const { name, email, password, gender = '', pronouns = '', birthday = null, notes = '' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const regularUserCount = await User.countDocuments({ role: 'user' });
    if (regularUserCount >= 2) {
      return res.status(400).json({ message: 'This app is limited to two regular users' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'user',
      gender,
      pronouns,
      birthday: birthday || null,
      notes,
    });

    return res.status(201).json({ user: serializeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { createUser, listUsers };
