import { User } from '../models/User.model.js';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';

export class AuthService {
  // Register new user
  static async register(userData) {
    const { username, email, password } = userData;
    
    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      throw new ApiError(409, 'User already exists with this email or username');
    }
    
    // Create user
    const user = new User({ username, email, password });
    await user.save();
    
    return user;
  }

  // Login user
  static async login(email, password) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiError(401, 'Invalid credentials');
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid credentials');
    }
    
    return user;
  }

  // Generate JWT tokens
  static generateTokens(userId) {
    const accessToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    return { accessToken };
  }

  // Verify token
  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      throw new ApiError(401, 'Invalid or expired token');
    }
  }

  // Update user status
  static async updateStatus(userId, status) {
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        status, 
        lastSeen: status === 'offline' ? new Date() : undefined 
      },
      { new: true }
    );
    return user;
  }
}