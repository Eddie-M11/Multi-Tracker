const Relationship = require('../models/Relationship');
const User = require('../models/User');

const AVATAR_THRESHOLDS = [
  { level: 15, stage: 5 },
  { level: 10, stage: 4 },
  { level: 6, stage: 3 },
  { level: 3, stage: 2 },
  { level: 1, stage: 1 },
];

function calculateLevel(xp) {
  return Math.floor(Math.max(0, Number(xp || 0)) / 250) + 1;
}

function calculateAvatarStage(level) {
  const threshold = AVATAR_THRESHOLDS.find((item) => level >= item.level);
  return threshold?.stage || 1;
}

function nextEvolutionLevel(level) {
  return [3, 6, 10, 15].find((threshold) => threshold > level) || null;
}

function generateInviteCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';

  for (let index = 0; index < length; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
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

function syncRelationshipProgress(relationship) {
  relationship.sharedXp = Math.max(0, Number(relationship.sharedXp || 0));
  relationship.coins = Math.max(0, Number(relationship.coins || 0));
  relationship.sharedLevel = calculateLevel(relationship.sharedXp);
  relationship.avatar = {
    type: relationship.avatar?.type || 'cosmic',
    stage: calculateAvatarStage(relationship.sharedLevel),
    mood: relationship.avatar?.mood || 'bright',
  };
}

async function ensureRelationshipForUser(user) {
  if (!user || user.role === 'admin') {
    const error = new Error('Shared dashboard is only available to couple users');
    error.status = 403;
    throw error;
  }

  if (user.relationshipId) {
    const existingRelationship = await Relationship.findById(user.relationshipId).populate('users', 'name email xp level coins avatar');
    if (existingRelationship) {
      syncRelationshipProgress(existingRelationship);
      await existingRelationship.save();
      return existingRelationship;
    }
  }

  const users = await User.find({ role: 'user' }).sort({ createdAt: 1 });
  const currentUser = users.find((candidate) => candidate._id.toString() === user._id.toString());

  if (!currentUser) {
    const error = new Error('User is not part of the couple workspace');
    error.status = 403;
    throw error;
  }

  const relationshipUsers = users.slice(0, 2);
  const inviteCode = await createUniqueInviteCode();
  const relationship = await Relationship.create({
    users: relationshipUsers.map((candidate) => candidate._id),
    inviteCode,
  });

  await User.updateMany(
    { _id: { $in: relationshipUsers.map((candidate) => candidate._id) } },
    { relationshipId: relationship._id }
  );

  syncRelationshipProgress(relationship);
  await relationship.save();

  return relationship.populate('users', 'name email xp level coins avatar');
}

function serializeRelationshipProgress(relationship) {
  syncRelationshipProgress(relationship);

  const currentLevelStart = (relationship.sharedLevel - 1) * 250;
  const nextLevelXp = relationship.sharedLevel * 250;
  const nextEvolution = nextEvolutionLevel(relationship.sharedLevel);

  return {
    id: relationship._id,
    sharedXp: relationship.sharedXp,
    sharedLevel: relationship.sharedLevel,
    coins: relationship.coins,
    avatar: relationship.avatar,
    levelProgress: {
      current: relationship.sharedXp - currentLevelStart,
      target: nextLevelXp - currentLevelStart,
      percent: Math.min(Math.round(((relationship.sharedXp - currentLevelStart) / 250) * 100), 100),
    },
    nextEvolutionLevel: nextEvolution,
    xpToNextEvolution: nextEvolution ? Math.max(0, ((nextEvolution - 1) * 250) - relationship.sharedXp) : 0,
  };
}

async function awardCoupleProgress(user, { xp = 0, coins = 0, type, title, metadata = {} }) {
  if (!user || user.role === 'admin') return null;

  const relationship = await ensureRelationshipForUser(user);
  relationship.sharedXp = Math.max(0, Number(relationship.sharedXp || 0) + Number(xp || 0));
  relationship.coins = Math.max(0, Number(relationship.coins || 0) + Number(coins || 0));
  relationship.avatar.mood = Number(xp || 0) >= 0 ? 'energized' : 'steady';

  syncRelationshipProgress(relationship);

  relationship.activityFeed.unshift({
    type,
    title,
    actorId: user._id,
    actorName: user.name,
    xp,
    coins,
    metadata,
  });
  relationship.activityFeed = relationship.activityFeed.slice(0, 40);

  await relationship.save();
  return relationship;
}

module.exports = {
  awardCoupleProgress,
  calculateAvatarStage,
  calculateLevel,
  ensureRelationshipForUser,
  serializeRelationshipProgress,
};
