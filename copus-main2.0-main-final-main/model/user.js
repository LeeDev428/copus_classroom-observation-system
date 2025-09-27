const mongoose = require('mongoose');

// Define your schema (this part should be correct now)
const employeeSchema = new mongoose.Schema({
    firstname: {
        type: String,
        required: true
    },
    lastname: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    employeeId: {
        type: String,
        unique: true,
        sparse: true
    },
    role: {
        type: String,
        enum: ['Admin', 'Faculty', 'Observer', 'Lead Observer'],
        default: 'Faculty'
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
}, {
    timestamps: true
});

// IMPORTANT FIX: Check if the model already exists before compiling it.
// This prevents the OverwriteModelError.
const Employee = mongoose.models.employee || mongoose.model('employee', employeeSchema);

module.exports = Employee;