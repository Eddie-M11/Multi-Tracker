const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user',
  },
  gender: {
    type: String,
    trim: true,
    default: '',
  },
  pronouns: {
    type: String,
    trim: true,
    default: '',
  },
  birthday: {
    type: Date,
    default: null,
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
  relationshipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Relationship',
    default: null,
  },
  xp: {
    type: Number,
    default: 0,
  },
  level: {
    type: Number,
    default: 1,
  },
  coins: {
    type: Number,
    default: 0,
  },
  avatar: {
    type: {
      type: String,
      default: 'bird',
    },
    mood: {
      type: String,
      default: 'happy',
    },
    levelStage: {
      type: Number,
      default: 1,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre('save', async function preSave() {
  if (!this.isModified('password')) {
    return;
  }

  const saltRounds = 10;
  this.password = await bcrypt.hash(this.password, saltRounds);
});

module.exports = mongoose.model('User', userSchema);
