import mongoose from 'mongoose';

const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true
    },
    otp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300
    }
});

export default mongoose.model('OTP', OTPSchema);