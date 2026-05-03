require('dotenv').config();

const mongoose = require('mongoose');

const connectDB = require('../config/db');
const User = require('../models/User');

const adminUser = {
  name: 'Eddie Admin',
  email: 'eddieadmin@admin.com',
  password: 'eddieadmin123456789',
  role: 'admin',
};

async function seedAdmin() {
  await connectDB();

  const existingAdmin = await User.findOne({ email: adminUser.email });

  if (existingAdmin) {
    existingAdmin.name = adminUser.name;
    existingAdmin.password = adminUser.password;
    existingAdmin.role = 'admin';
    await existingAdmin.save();
    // eslint-disable-next-line no-console
    console.log(`Updated admin: ${adminUser.email}`);
  } else {
    await User.create(adminUser);
    // eslint-disable-next-line no-console
    console.log(`Created admin: ${adminUser.email}`);
  }
}

seedAdmin()
  .then(async () => {
    await mongoose.disconnect();
    // eslint-disable-next-line no-console
    console.log('Admin user is ready');
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to seed admin:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
