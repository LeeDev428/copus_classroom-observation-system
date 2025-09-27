const mongoose = require('mongoose');

// Define the schema for the Status model
const StatusSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true, // Status names should be unique (e.g., 'pending', 'approved', 'completed')
        trim: true,
        lowercase: true // Store status names in lowercase for consistency
    },
    description: {
        type: String,
        required: false,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Add a pre-save hook to update the 'updatedAt' field
StatusSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Create the model from the schema
const Status = mongoose.model('Status', StatusSchema); // 'Status' will map to the 'statuses' collection

module.exports = Status;