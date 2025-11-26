import mongoose from 'mongoose';
import { MemoryDB } from '../utils/memoryDB.js';

let dbType = 'none';
export let memoryDB = new MemoryDB();

export const initDatabase = async () => {
  console.log('🔗 Attempting MongoDB connection...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 8000,
    });
    
    dbType = 'mongodb';
    console.log('✅ MongoDB connected successfully');
    
    // Create admin user if not exists
    const User = mongoose.model('User');
    const existingAdmin = await User.findOne({ username: 'admin' });
    if (!existingAdmin) {
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await User.create({
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        name: 'System Administrator'
      });
      console.log('✅ MongoDB: Admin user created');
    }

    return true;
  } catch (error) {
    console.log('❌ MongoDB connection failed:', error.message);
    console.log('🔄 Using in-memory database (data will reset on server restart)');
    dbType = 'memory';
    return true;
  }
};

export const getDBType = () => dbType;