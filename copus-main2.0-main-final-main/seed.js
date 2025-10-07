// seed.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Employee = require('./model/employee'); // adjust path if different

// Sample data - Using simple password 'password123' for all accounts
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
    },
     {
      employeeId: 'EMP011',
      department: 'IT',
      lastname: 'Torres',
      firstname: 'Lee',
      role: 'super_admin',
      email: 'grafrafraftorres28@gmail.com',
      password: 'password123',
      status: 'Active',
      isFirstLogin: false
    }
];

// Load environment variables
require('dotenv').config();

async function seedDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);      
    console.log('✅ Connected to DB');

    await Employee.deleteMany({});
    console.log('🧹 Old employees removed');

    for (let emp of seedEmployees) {
      console.log(`Creating employee ${emp.employeeId} with password: "${emp.password}"`);
      
      // Employee model pre-save hook will handle password hashing automatically
      await Employee.create(emp);
      console.log(`✓ Created employee ${emp.employeeId}`);
    }

    console.log('🌱 Seed data inserted');
    process.exit();
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seedDB();
