const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy',
    },
    xp: {
      type: Number,
      default: 20,
      min: 0,
    },
    coins: {
      type: Number,
      default: 5,
      min: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const noteSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const contributionSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    balanceAfter: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

const goalSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      enum: ['finance'],
      default: 'finance',
    },
    visibility: {
      type: String,
      enum: ['personal', 'shared'],
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    visualType: {
      type: String,
      enum: ['ring', 'loveMeter', 'vault'],
      default: 'ring',
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
    sharedToDashboard: {
      type: Boolean,
      default: false,
    },
    sharedAt: {
      type: Date,
      default: null,
    },
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'paused'],
      default: 'active',
    },
    tasks: [taskSchema],
    notes: [noteSchema],
    contributions: [contributionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Goal', goalSchema);
