const mongoose = require('mongoose');

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME || 'tracker_dev';

  if (!mongoUri) {
    throw new Error('MONGO_URI is required');
  }

  try {
    await mongoose.connect(mongoUri, { dbName });
    // eslint-disable-next-line no-console
    console.log(`MongoDB connected successfully to ${dbName}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
}

module.exports = connectDB;
