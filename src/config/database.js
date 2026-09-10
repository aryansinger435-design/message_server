import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const rawUri = process.env.mongodburl || process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app';
    const conn = await mongoose.connect(rawUri.trim());
    console.log(`🍃 MongoDB Connected: ${conn.connection.name} @ ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};