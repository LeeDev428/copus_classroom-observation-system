// seedUsers.js - Script to populate database with test users
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./model/employee');
const Schedule = require('./model/schedule');

async function seedUsers() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/copusDb');
        console.log('Connected to MongoDB');

        // Clear schedules collection
        const deletedSchedules = await Schedule.deleteMany({});
        console.log(`🗑️ Cleared ${deletedSchedules.deletedCount} schedules from database`);

        // Clear existing users (optional)
        // await User.deleteMany({});
        // console.log('Cleared existing users');

        // Create test users
        const users = [
            {
                employeeId: 'ADMIN001',
                firstname: 'Admin',
                lastname: 'Manager',
                email: 'admin@copus.edu',
                password: await bcrypt.hash('admin123', 10),
                role: 'admin',
                department: 'Administration',
                status: 'Active'
            },
            {
                employeeId: 'FAC001',
                firstname: 'Faculty',
                lastname: 'Teacher',
                email: 'faculty@copus.edu',
                password: await bcrypt.hash('faculty123', 10),
                role: 'Faculty',
                department: 'Computer Science',
                status: 'Active'
            },
            {
                employeeId: 'FAC002',
                firstname: 'Math',
                lastname: 'Professor',
                email: 'math@copus.edu',
                password: await bcrypt.hash('math123', 10),
                role: 'Faculty',
                department: 'Mathematics',
                status: 'Active'
            },
            {
                employeeId: 'FAC003',
                firstname: 'Science',
                lastname: 'Instructor',
                email: 'science@copus.edu',
                password: await bcrypt.hash('science123', 10),
                role: 'Faculty',
                department: 'Natural Sciences',
                status: 'Active'
            },
            {
                employeeId: 'OBS001',
                firstname: 'Observer',
                lastname: 'ALC',
                email: 'observer@copus.edu',
                password: await bcrypt.hash('observer123', 10),
                role: 'Observer (ALC)',
                department: 'Academic Learning Center',
                status: 'Active'
            }
        ];

        // Insert users
        for (const userData of users) {
            try {
                const existingUser = await User.findOne({ employeeId: userData.employeeId });
                if (!existingUser) {
                    const user = new User(userData);
                    await user.save();
                    console.log(`✓ Created user: ${userData.firstname} ${userData.lastname} (${userData.role})`);
                } else {
                    console.log(`- User already exists: ${userData.employeeId}`);
                }
            } catch (userErr) {
                console.error(`✗ Error creating user ${userData.employeeId}:`, userErr.message);
            }
        }

        // Check final count
        const totalUsers = await User.countDocuments();
        const facultyUsers = await User.countDocuments({ role: 'Faculty' });
        
        console.log('\n=== Database Status ===');
        console.log(`Total users: ${totalUsers}`);
        console.log(`Faculty users: ${facultyUsers}`);
        
        mongoose.disconnect();
        console.log('Database connection closed');
        
    } catch (err) {
        console.error('Error seeding users:', err);
        mongoose.disconnect();
    }
}

// Run the seed function
seedUsers();