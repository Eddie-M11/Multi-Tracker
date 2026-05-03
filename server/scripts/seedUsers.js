require('dotenv').config();

const mongoose = require('mongoose');

const connectDB = require('../config/db');
const User = require('../models/User');

const users = [
  {
    name: 'Demo User',
    email: 'demo@example.com',
    password: 'password123',
  },
  {
    name: 'Demo Partner',
    email: 'partner@example.com',
    password: 'password123',
  },
];

async function seedUsers() {
  await connectDB();

  for (const userData of users) {
    const existingUser = await User.findOne({ email: userData.email });

    if (existingUser) {
      existingUser.name = userData.name;
      existingUser.password = userData.password;
      await existingUser.save();
      // eslint-disable-next-line no-console
      console.log(`Updated user: ${userData.email}`);
    } else {
      await User.create(userData);
      // eslint-disable-next-line no-console
      console.log(`Created user: ${userData.email}`);
    }
  }
}

seedUsers()
  .then(async () => {
    await mongoose.disconnect();
    // eslint-disable-next-line no-console
    console.log('Demo users are ready');
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to seed users:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
