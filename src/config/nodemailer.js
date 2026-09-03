import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Check if email config exists
const isEmailConfigured = process.env.EMAIL_USER && process.env.EMAIL_PASSWORD;

// Create transporter only if email is configured
let transporter = null;
if (isEmailConfigured) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
}

// ONLY ONE EXPORT - Either use export const OR export { }
export const sendOTPEmail = async (email, otp) => {
    try {
        // If email not configured, use testing mode
        if (!isEmailConfigured) {
            console.log('=================================');
            console.log('📧 TESTING MODE - Email not configured');
            console.log(`📧 TO: ${email}`);
            console.log(`🔑 OTP: ${otp}`);
            console.log('=================================');
            return true;
        }

        // Send real email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your OTP for Registration - Message App',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #333; text-align: center;">Email Verification</h2>
                    <p style="font-size: 16px; color: #555;">Thank you for registering! Please use the following OTP to verify your email address:</p>
                    <div style="background-color: #f5f5f5; padding: 15px; text-align: center; margin: 20px 0; border-radius: 4px;">
                        <h1 style="color: #4CAF50; letter-spacing: 5px; margin: 0; font-size: 32px;">${otp}</h1>
                    </div>
                    <p style="font-size: 14px; color: #888;">This OTP is valid for 5 minutes. Please do not share this OTP with anyone.</p>
                    <hr style="border: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999; text-align: center;">If you didn't request this, please ignore this email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ OTP sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Email sending error:', error);
        // If email fails, still show OTP in console for testing
        console.log('=================================');
        console.log('📧 EMAIL FAILED - Showing OTP in console');
        console.log(`📧 TO: ${email}`);
        console.log(`🔑 OTP: ${otp}`);
        console.log('=================================');
        throw new Error('Failed to send OTP email');
    }
};

// Remove this line if it exists:
// export { sendOTPEmail };  // ← DELETE THIS LINE

// Default export (optional)
export default transporter;