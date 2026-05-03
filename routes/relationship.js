const express = require('express');

const requireAuth = require('../middleware/requireAuth');
const Relationship = require('../models/Relationship');
const User = require('../models/User');

const router = express.Router();

function generateInviteCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';

  for (let i = 0; i < length; i += 1) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return code;
}

async function createUniqueInviteCode() {
  let inviteCode = generateInviteCode();
  let exists = await Relationship.exists({ inviteCode });

  while (exists) {
    inviteCode = generateInviteCode();
    exists = await Relationship.exists({ inviteCode });
  }

  return inviteCode;
}

router.post('/create', requireAuth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (currentUser.relationshipId) {
      return res.status(400).json({ message: 'User already has a relationship' });
    }

    const inviteCode = await createUniqueInviteCode();

    const relationship = await Relationship.create({
      users: [currentUser._id],
      inviteCode,
    });

    currentUser.relationshipId = relationship._id;
    await currentUser.save();

    return res.status(201).json({ inviteCode });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});


router.post('/join', requireAuth, async (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ message: 'inviteCode is required' });
    }

    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (currentUser.relationshipId) {
      return res.status(400).json({ message: 'User already has a relationship' });
    }

    const relationship = await Relationship.findOne({ inviteCode });

    if (!relationship) {
      return res.status(404).json({ message: 'Relationship not found' });
    }

    if (relationship.users.length >= 2) {
      return res.status(400).json({ message: 'Relationship already has 2 users' });
    }

    const alreadyInRelationship = relationship.users.some(
      (userId) => userId.toString() === currentUser._id.toString(),
    );

    if (!alreadyInRelationship) {
      relationship.users.push(currentUser._id);
    }

    currentUser.relationshipId = relationship._id;

    await relationship.save();
    await currentUser.save();

    return res.status(200).json({
      message: 'Joined relationship successfully',
      relationship,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
