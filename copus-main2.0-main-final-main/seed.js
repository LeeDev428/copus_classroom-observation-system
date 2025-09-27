// seed.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Employee = require('./model/employee'); // adjust path if different

// Sample data with easy-to-remember credentials
const seedEmployees = [
  {
      employeeId: 'admin',
      department: 'IT',
      lastname: 'Administrator',
      firstname: 'Super',
      role: 'super_admin',
      email: 'superadmin@copus.com',
      password: 'admin123'
    },
    {
      employeeId: 'admin2',
      department: 'Administration',
      lastname: 'Manager',
      firstname: 'Admin',
      role: 'admin',
      email: 'admin@copus.com',
      password: 'admin123'
    },
    {
      employeeId: 'faculty1',
      department: 'Computer Science',
      lastname: 'Teacher',
      firstname: 'Faculty',
      role: 'Faculty',
      email: 'faculty@copus.com',
      password: 'faculty123'
    },
    {
      employeeId: 'faculty2',
      department: 'Mathematics',
      lastname: 'Professor',
      firstname: 'Math',
      role: 'Faculty',
      email: 'math@copus.com',
      password: 'faculty123'
    },
    {
      employeeId: 'observer1',
      department: 'Quality Assurance',
      lastname: 'Watcher',
      firstname: 'Observer',
      role: 'Observer',
      email: 'observer@copus.com',
      password: 'observer123'
    },
    {
      employeeId: 'observer2',
      department: 'Quality Assurance',
      lastname: 'Monitor',
      firstname: 'ALC',
      role: 'Observer (ALC)',
      email: 'alc@copus.com',
      password: 'observer123'
    },
    {
      employeeId: 'observer3',
      department: 'Quality Assurance',
      lastname: 'Reviewer',
      firstname: 'SLC',
      role: 'Observer (SLC)',
      email: 'slc@copus.com',
      password: 'observer123'
    },
    {
      employeeId: 'test1',
      department: 'Testing',
      lastname: 'User',
      firstname: 'Test',
      role: 'Faculty',
      email: 'test@copus.com',
      password: 'test123'
    }
];

async function seedDB() {
  try {
    await mongoose.connect('mongodb+srv://copusAdmin:sK8ZGlLEuWsXavyc@cluster0.ugspmft.mongodb.net/copusDB?retryWrites=true&w=majority&appName=copusDB', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });      
    console.log('✅ Connected to DB');

    await Employee.deleteMany({});
    console.log('🧹 Old employees removed');

    for (let emp of seedEmployees) {
      // Don't hash password here - the schema pre-save middleware will handle it
      await Employee.create(emp);
    }

    console.log('🌱 Seed data inserted');
    process.exit();
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seedDB();
