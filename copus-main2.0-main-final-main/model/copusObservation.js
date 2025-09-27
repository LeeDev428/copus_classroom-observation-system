const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for a single 2-minute interval's observation data
const intervalObservationSchema = new Schema({
    intervalNumber: {
        type: Number,
        required: true,
        min: 1
    },
    studentActions: {
        type: Map,
        of: Number, // This is crucial for accepting 0 or 1
        default: {}
    },
    teacherActions: {
        type: Map,
        of: Number, // This is crucial for accepting 0 or 1
        default: {}
    },
    engagementLevel: { // This structure matches the frontend's object payload
        High: { type: Number, default: 0 },
        Med: { type: Number, default: 0 },
        Low: { type: Number, default: 0 }
    },
    comment: {
        type: String,
        trim: true,
        default: ''
    },
    recordedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false }); // No _id for sub-documents

// Main Copus Observation Schema
const copusObservationSchema = new Schema({
    scheduleId: {
        type: Schema.Types.ObjectId,
        ref: 'Schedule',
        required: true
    },
    observerId: {
        type: Schema.Types.ObjectId,
        ref: 'employee', // <--- CRITICAL CHANGE: Changed from 'User' to 'employee'
        required: true
    },
    copusNumber: {
        type: Number,
        enum: [1, 2, 3],
        required: true
    },
    observations: [intervalObservationSchema], // Array of embedded documents

    overallComments: {
        type: String,
        trim: true
    },
    dateSubmitted: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true }); // Adds createdAt and updatedAt

const CopusObservation = mongoose.model('CopusObservation', copusObservationSchema);

module.exports = CopusObservation;