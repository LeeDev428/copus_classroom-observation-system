// quick-fix-seed.js - Complete seed script for all users
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Employee = require('./model/employee');

// All users from the original seed.js
const seedEmployees = [
  {
      employeeId: 'EMP001',
      department: 'IT',
      lastname: 'Santos',
      firstname: 'Juan',
      role: 'super_admin',
      email: 'juan.santos@example.com',
      password: 'password123',
      status: 'Active',
      isFirstLogin: false
    },
    {
      employeeId: 'EMP002',
      department: 'Math',
      lastname: 'Reyes',
      firstname: 'Ana',
      role: 'admin',
      email: 'ana.reyes@example.com',
      password: 'password123',
      status: 'Active',
      isFirstLogin: false
    },
    {
      employeeId: 'EMP003',
      department: 'English',
      lastname: 'Garcia',
      firstname: 'Leo',
      role: 'Faculty',
      email: 'leo.garcia@example.com',
      password: 'password123',
      status: 'Active',
      isFirstLogin: false
    },
    {
      employeeId: 'EMP004',
      department: 'Science',
      lastname: 'Lopez',
      firstname: 'Maria',
      role: 'Faculty',
      email: 'maria.lopez@example.com',
      password: 'password123',
      status: 'Active',
      isFirstLogin: false
    },
    {
      employeeId: 'EMP005',
      department: 'PE',
      lastname: 'Cruz',
      firstname: 'Pedro',
      role: 'Observer',
      email: 'pedro.cruz@example.com',
      password: 'password123',
      status: 'Active',
      isFirstLogin: false
    },
    {
      employeeId: 'EMP006',
      department: 'IT',
      lastname: 'Fernandez',
      firstname: 'Jose',
      role: 'admin',
      email: 'jose.fernandez@example.com',
      password: 'password123',
      status: 'Active',
      isFirstLogin: false
    },
    {
      employeeId: 'EMP007',
      department: 'Math',
      lastname: 'Ramos',
      firstname: 'Celia',
      role: 'Observer',
      email: 'celia.ramos@example.com',
      password: 'password123',
      status: 'Active',
      isFirstLogin: false
    },
    {
      employeeId: 'EMP008',
      department: 'English',
      lastname: 'Torres',
      firstname: 'Luis',
      role: 'Faculty',
      email: 'luis.torres@example.com',
      password: 'password123',
      status: 'Active',
      isFirstLogin: false
    },
    {
      employeeId: 'EMP009',
      department: 'Science',
      lastname: 'Delos Santos',
      firstname: 'Rhea',
      role: 'Faculty',
      email: 'rhea.delos@example.com',
      password: 'password123',
      status: 'Active',
      isFirstLogin: false
    },
    {
      employeeId: 'EMP010',
      department: 'PE',
      lastname: 'Morales',
      firstname: 'Tito',
      role: 'Observer',
      email: 'tito.morales@example.com',
      password: 'password123',
      status: 'Active',
      isFirstLogin: false
    }
];

async function quickSeed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to DB');

        // Delete all existing users
        await Employee.deleteMany({});
        console.log('🧹 Cleared all users');

        const saltRounds = 10;
        let successCount = 0;

        for (const emp of seedEmployees) {
            try {
                const hashedPassword = await bcrypt.hash(emp.password, saltRounds);
                
                // Test the hash immediately
                const testMatch = await bcrypt.compare(emp.password, hashedPassword);
                if (!testMatch) {
                    throw new Error(`Hash creation failed for ${emp.employeeId}`);
                }

                const newEmployee = {
                    ...emp,
                    password: hashedPassword
                };

                const created = await Employee.create(newEmployee);
                console.log(`✅ Created user: ${created.employeeId} - ${created.firstname} ${created.lastname} (${created.role})`);
                successCount++;
            } catch (error) {
                console.error(`❌ Failed to create ${emp.employeeId}:`, error.message);
            }
        }

        console.log(`\n🎉 SUCCESS! Created ${successCount}/${seedEmployees.length} users`);
        console.log('All users can login with password: password123');
        
        // Test one user to make sure login works
        const testUser = await Employee.findOne({ employeeId: 'EMP002' });
        if (testUser) {
            const finalTest = await bcrypt.compare('password123', testUser.password);
            console.log('Login test for EMP002:', finalTest ? '✅ PASS' : '❌ FAIL');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Quick seed failed:', err);
        process.exit(1);
    }
}

quickSeed();