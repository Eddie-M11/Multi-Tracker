const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['goal_contribution', 'goal_task', 'goal_task_undo', 'debt_payment', 'share_goal', 'share_plan', 'plan_note'],
      required: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorName: {
      type: String,
      trim: true,
      default: '',
    },
    xp: {
      type: Number,
      default: 0,
    },
    coins: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

const relationshipSchema = new mongoose.Schema(
  {
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    sharedXp: {
      type: Number,
      default: 0,
      min: 0,
    },
    sharedLevel: {
      type: Number,
      default: 1,
      min: 1,
    },
    coins: {
      type: Number,
      default: 0,
      min: 0,
    },
    avatar: {
      type: {
        type: String,
        enum: ['cosmic'],
        default: 'cosmic',
      },
      stage: {
        type: Number,
        default: 1,
        min: 1,
        max: 5,
      },
      mood: {
        type: String,
        default: 'bright',
      },
    },
    activityFeed: {
      type: [activitySchema],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Relationship', relationshipSchema);
