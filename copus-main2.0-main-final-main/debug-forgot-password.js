// debug-forgot-password.js - Run this to test forgot password functionality
const mongoose = require('mongoose');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const User = require('./model/employee');

async function testForgotPassword() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');

        // Test email addresses from your seed data
        const testEmails = [
            'grafrafraftorres28@gmail.com', // Your real email
            'juan.santos@example.com',
            'ana.reyes@example.com', 
            'leo.garcia@example.com'
        ];

        for (let testEmail of testEmails) {
            console.log(`\n🔍 Testing email: ${testEmail}`);
            
            // Check if user exists
            const user = await User.findOne({ email: testEmail.toLowerCase() });
            if (!user) {
                console.log(`❌ User not found for email: ${testEmail}`);
                continue;
            }

            console.log(`✅ User found: ${user.firstname} ${user.lastname}`);
            console.log(`📧 Email in DB: ${user.email}`);

            // Generate reset token and create reset link
            const resetToken = crypto.randomBytes(32).toString('hex');
            user.resetToken = resetToken;
            user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
            await user.save();

            console.log(`🔑 Generated reset token: ${resetToken}`);
            
            // Create reset link
            const resetLink = `http://localhost:3000/reset-password/${resetToken}`;
            console.log(`🔗 Reset link: ${resetLink}`);

            // Test email sending
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'copus6251@gmail.com',
                    pass: 'ugpc lsxi pmro bwno'
                }
            });

            const mailOptions = {
                from: '"Admin" <copus6251@gmail.com>',
                to: user.email,
                subject: 'Password Reset Test - PHINMA Copus System',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px; border: 1px solid #ddd;">
                        <h2 style="color: #2c3e50;">Hello ${user.firstname} ${user.lastname},</h2>
                        <p>This is a test email for password reset functionality.</p>
                        <p>Click the button below to reset your password:</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
                        </div>
                        
                        <p>Or copy and paste this link in your browser:</p>
                        <p style="word-break: break-all; background-color: #f1f1f1; padding: 10px; border-radius: 4px;">${resetLink}</p>
                        
                        <p>This link is valid for 1 hour.</p>
                        <p>– PHINMA IT Team</p>
                    </div>
                `
            };

            try {
                await transporter.sendMail(mailOptions);
                console.log(`✅ Email sent successfully to ${user.email}`);
            } catch (emailError) {
                console.log(`❌ Email failed to send: ${emailError.message}`);
            }

            // Only test first email for now
            break;
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
        process.exit();
    }
}

console.log('🧪 Starting Forgot Password Test...\n');
testForgotPassword();