import User from '../models/User.model.js';
import OTP from '../models/OTP.js';
import { sendOTPEmail } from '../config/nodemailer.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Generate OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Register User with OTP
export const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email or username'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            isVerified: false
        });

        await user.save();

        const otp = generateOTP();
        const otpRecord = new OTP({
            email: email.toLowerCase(),
            otp
        });
        await otpRecord.save();

        await sendOTPEmail(email, otp);

        const accessToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully. Please verify your email with OTP.',
            data: {
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    avatar: user.avatar,
                    status: user.status,
                    isVerified: user.isVerified
                },
                accessToken
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
};

// Verify OTP
export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        const otpRecord = await OTP.findOne({ 
            email: email.toLowerCase(), 
            otp 
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.isVerified = true;
        await user.save();

        await OTP.deleteOne({ _id: otpRecord._id });

        const accessToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            data: {
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    avatar: user.avatar,
                    status: user.status,
                    isVerified: user.isVerified,
                    friends: user.friends,
                    friendRequests: user.friendRequests,
                    lastSeen: user.lastSeen,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                },
                accessToken
            }
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({
            success: false,
            message: 'OTP verification failed',
            error: error.message
        });
    }
};

// Resend OTP
export const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: 'Email is already verified'
            });
        }

        await OTP.deleteMany({ email: email.toLowerCase() });

        const otp = generateOTP();
        const otpRecord = new OTP({
            email: email.toLowerCase(),
            otp
        });
        await otpRecord.save();

        await sendOTPEmail(email, otp);

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully. Please check your email.'
        });

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend OTP',
            error: error.message
        });
    }
};

// Login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        if (!user.isVerified) {
            return res.status(401).json({
                success: false,
                message: 'Please verify your email first. Check your email for OTP.'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        user.lastSeen = new Date();
        user.status = 'online';
        await user.save();

        const accessToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user,
                accessToken,
                refreshToken
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

// Logout
export const logout = async (req, res) => {
    try {
        const userId = req.userId;
        
        if (userId) {
            await User.findByIdAndUpdate(userId, { status: 'offline' });
        }

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed',
            error: error.message
        });
    }
};

// Refresh Token
export const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        
        const accessToken = jwt.sign(
            { userId: decoded.userId },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            success: true,
            data: { accessToken }
        });

    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token'
        });
    }
};