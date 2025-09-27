// D:\copus-main2.0-FINAL\copus-main2.0-main-final-main\model\employee.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Crucial for password hashing

const employeeSchema = new mongoose.Schema({
    employeeId: {
        type: String,
        required: true,
        unique: true,
        trim: true // Remove whitespace
    },
    department: {
        type: String,
        trim: true
        // Consider if 'required: true' is needed here
    },
    lastname: {
        type: String,
        required: true,
        trim: true
    },
    firstname: {
        type: String,
        required: true,
        trim: true
    },
    role: {        
        type: String,
        enum: ['super_admin', 'admin', 'Observer', 'Faculty', 'Observer (ALC)', 'Observer (SLC)'], // Use your enum for roles
        required: true // Roles are typically required
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true, // Store emails in lowercase for consistency
        match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please fill a valid email address'] // Basic email regex
    },
    password: {
        type: String,
        required: true // Password must be required
    },
    resetToken: String, // For password reset functionality
    resetTokenExpiry: Date, // For password reset functionality
    status: {
        type: String,
        enum: ['Active', 'Inactive'], // Restrict to specific statuses
        default: 'Active'
    },
    isFirstLogin: { // For forcing password change on first login
        type: Boolean,
        default: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Middleware to hash password before saving
employeeSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next(); // Continue with the save operation
});

// Optional: Add a method to compare passwords for login
employeeSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Export the model, using the correct schema
module.exports = mongoose.model('employee', employeeSchema);