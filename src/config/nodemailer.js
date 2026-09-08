import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// 1. OTP GENERATOR
export const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// 2. SEND OTP EMAIL
export const sendOTP = async (email, arg2, arg3) => {
    // Handle both sendOTP(email, otp) and sendOTP(email, name, otp)
    let name = "Valued Customer";
    let otp = arg2;

    if (arg3 !== undefined && arg3 !== null) {
        name = arg2 || "Valued Customer";
        otp = arg3;
    }

    console.log(`\n========================================`);
    console.log(`🔑 OTP generated for: ${email}`);
    console.log(`🔑 OTP Code: ${otp}`);
    console.log(`========================================\n`);

    const smtpUser = process.env.EMAIL_USER || process.env.SMTP_USER;
    const smtpPass = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
        console.warn("⚠️ SMTP credentials not fully configured in .env. Falling back to console OTP.");
        return { success: true, message: "OTP logged to console", otp };
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });

    try {
        const info = await transporter.sendMail({
            from: `"Message App" <${smtpUser}>`,
            to: email,
            subject: "Your OTP for Registration - Message App",
            html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP Verification</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5; margin: 0; padding: 20px; }
        .email-container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 35px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e4e7ec; }
        .header { text-align: center; border-bottom: 3px solid #4CAF50; padding-bottom: 20px; margin-bottom: 24px; }
        .header h1 { font-size: 26px; color: #1e293b; margin: 0; }
        .header span { color: #4CAF50; }
        .otp-box { background: #f8fafc; padding: 24px; text-align: center; border-radius: 12px; margin: 24px 0; border: 2px dashed #4CAF50; }
        .otp-code { font-size: 40px; color: #1e293b; letter-spacing: 12px; font-weight: 800; background: #ffffff; padding: 10px 20px; border-radius: 8px; display: inline-block; }
        .footer { border-top: 1px solid #e2e8f0; padding-top: 18px; text-align: center; color: #94a3b8; font-size: 12px; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>💬 Message <span>App</span></h1>
            <p style="color:#64748b; margin:4px 0 0 0; font-size:13px;">Connect with the World</p>
        </div>
        <div>
            <h2 style="font-size:18px; color:#1e293b;">Hello ${name}! 👋</h2>
            <p style="color:#475569; font-size:14px; line-height:1.6;">Thank you for registering! Please use the one-time password below to verify your email address.</p>
        </div>
        <div class="otp-box">
            <div style="font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:3px; margin-bottom:8px; font-weight:600;">One-Time Verification Code</div>
            <div class="otp-code">${otp}</div>
        </div>
        <p style="color:#64748b; font-size:13px; text-align:center;">⏰ Valid for <strong>5 minutes</strong> only. Never share this code with anyone.</p>
        <div class="footer">
            <p>© ${new Date().getFullYear()} Message App. All rights reserved.</p>
            <p style="margin-top:5px;">If you didn't request this, please ignore this email.</p>
        </div>
    </div>
</body>
</html>
`,
        });

        console.log("✅ Email sent successfully. MessageId:", info.messageId);
        return { success: true, messageId: info.messageId, otp };
    } catch (err) {
        console.error("❌ Error sending mail (OTP is still logged in console):", err.message);
        // Still return OTP for testing purposes
        return { success: false, error: err.message, otp };
    }
};

// 3. VERIFY OTP
export const verifyOTP = (userOTP, storedOTP, expiryTime) => {
    if (userOTP !== storedOTP) {
        return { success: false, message: "Invalid OTP" };
    }
    if (new Date() > new Date(expiryTime)) {
        return { success: false, message: "OTP has expired" };
    }
    return { success: true, message: "OTP verified successfully" };
};

// 4. RESEND OTP
export const resendOTP = async (email, name) => {
    const newOTP = generateOTP();
    await sendOTP(email, name, newOTP);
    return { success: true, otp: newOTP, message: "New OTP sent" };
};

// Default export
export default {
    generateOTP,
    sendOTP,
    verifyOTP,
    resendOTP
};