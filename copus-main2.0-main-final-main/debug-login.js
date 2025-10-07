// debug-login.js - Test login credentials
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./model/employee');

async function debugLogin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');

        // Test with your actual credentials
        const testCreds = [
            { employeeId: 'EMP011', password: 'password123' },
            { employeeId: 'EMP011', password: 'ahrix123' },
            { employeeId: 'EMP001', password: 'password123' }
        ];

        for (let cred of testCreds) {
            console.log(`\n🔍 Testing: ${cred.employeeId} with password "${cred.password}"`);
            
            const user = await User.findOne({ employeeId: cred.employeeId });
            if (!user) {
                console.log('❌ User not found');
                continue;
            }

            console.log('👤 User found:', {
                employeeId: user.employeeId,
                name: `${user.firstname} ${user.lastname}`,
                email: user.email,
                hashPrefix: user.password.substring(0, 10) + '...'
            });

            // Test password
            const isMatch = await bcrypt.compare(cred.password, user.password);
            console.log(`🔐 Password "${cred.password}" match:`, isMatch ? '✅ YES' : '❌ NO');

            // Test if password was double-hashed by trying to hash the input first
            const preHashedInput = await bcrypt.hash(cred.password, 10);
            const doubleHashTest = await bcrypt.compare(preHashedInput, user.password);
            console.log('🔐 Double-hash test:', doubleHashTest ? '⚠️ DOUBLE HASHED!' : 'Not double hashed');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
        process.exit();
    }
}

console.log('🧪 Starting Login Debug Test...\n');
debugLogin();